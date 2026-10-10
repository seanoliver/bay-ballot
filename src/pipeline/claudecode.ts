import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExtractClient } from "./extract";

type Env = Record<string, string | undefined>;

/** Where model calls go: the Anthropic API (the default, and the only option in CI) or Claude Code on Sean's subscription. */
export type ModelVia = "api" | "claude-code";

export function modelVia(flagValue: string | undefined, envValue: string | undefined): ModelVia {
  const v = flagValue ?? (envValue?.trim() || undefined) ?? "api";
  if (v === "api" || v === "claude-code") return v;
  throw new Error(`--via must be 'api' or 'claude-code', not '${v}'`);
}

export type RunResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean; missing: boolean };
export type Run = (bin: string, args: string[], opts: { env: Env; cwd: string; input: string; timeoutMs: number }) => Promise<RunResult>;

export type ClaudeCodeOptions = {
  /** The API client to use when Claude Code fails; null turns fallback off. Called at most once. */
  fallback: (() => ExtractClient) | null;
  log?: (line: string) => void;
  env?: Env;
  run?: Run;
  timeoutMs?: number;
};

const TIMEOUT_MS = 30 * 60 * 1000;

/** CLAUDE_BIN, else the native install, else PATH. Never a shell, so an alias for another account can't apply. */
export function claudeBin(env: Env = process.env): string {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN;
  const local = path.join(env.HOME ?? os.homedir(), ".local", "bin", "claude");
  return fs.existsSync(local) ? local : "claude";
}

/** Only the personal login may bill: drop every API key, token, base URL and third-party provider switch. */
export function childEnv(env: Env, maxTokens: number): Env {
  const kept = Object.entries(env).filter(
    ([k]) => !k.startsWith("ANTHROPIC_") && !k.startsWith("CLAUDE_CODE_") && k !== "BAYBALLOT_ANTHROPIC_API_KEY" && k !== "CLAUDE_CONFIG_DIR",
  );
  return {
    ...Object.fromEntries(kept),
    CLAUDE_CONFIG_DIR: env.BAYBALLOT_CLAUDE_CONFIG_DIR || path.join(env.HOME ?? os.homedir(), ".claude-personal"),
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxTokens),
  };
}

type Params = Anthropic.Messages.MessageStreamParams;

export const systemText = (params: Params) =>
  typeof params.system === "string" ? params.system : (params.system ?? []).map((b) => b.text).join("\n\n");

/** The API's effort when a request sets none. Claude Code would use the user's effortLevel setting instead. */
export const apiDefaultEffort = (model: string) => (/opus-5-5|haiku-5-5/.test(model) ? "medium" : "high");

/** The system prompt goes in a file: with a whole ballot in it, it is too long to pass safely as an argument. */
export function cliArgs(params: Params, systemFile: string): string[] {
  const schema = params.output_config?.format?.schema;
  const effort = params.output_config?.effort ?? apiDefaultEffort(params.model);
  return [
    "-p",
    // stream-json input carries PDF document blocks as they are; it requires stream-json output.
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--model", params.model,
    "--system-prompt-file", systemFile,
    "--tools", "",
    "--strict-mcp-config",
    "--safe-mode",
    // No user, project or local settings: effortLevel, model or env there would change the call.
    "--setting-sources", "",
    "--no-session-persistence",
    ...(schema ? ["--json-schema", JSON.stringify(schema)] : []),
    "--effort", effort,
  ];
}

export function stdinFor(params: Params): string {
  if (params.messages.length !== 1 || params.messages[0].role !== "user") throw new Error("claude-code: only a single user message is supported");
  return `${JSON.stringify({ type: "user", message: { role: "user", content: params.messages[0].content } })}\n`;
}

type Failure = { kind: "missing" | "auth" | "limit" | "timeout" | "schema" | "error"; detail: string };
type CliResult = {
  subtype?: string;
  is_error?: boolean;
  result?: string;
  stop_reason?: string | null;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
};

const subscription = new WeakSet<Anthropic.Messages.Usage>();
/** Usage from a Claude Code call: billed to the subscription, so it has no API cost. */
export const onSubscription = (u: Anthropic.Messages.Usage) => subscription.has(u);

function toMessage(params: Params, r: CliResult): Anthropic.Messages.Message {
  const usage: Anthropic.Messages.Usage = {
    input_tokens: r.usage?.input_tokens ?? 0,
    output_tokens: r.usage?.output_tokens ?? 0,
    cache_creation_input_tokens: r.usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: r.usage?.cache_read_input_tokens ?? 0,
    cache_creation: null,
    inference_geo: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
  };
  subscription.add(usage);
  const text = r.structured_output !== undefined ? JSON.stringify(r.structured_output) : (r.result ?? "");
  return {
    id: "claude-code",
    type: "message",
    role: "assistant",
    model: params.model,
    container: null,
    diagnostics: null,
    content: [{ type: "text", text, citations: null }],
    // The CLI ends a structured-output turn with a tool call; to the callers that is a finished answer.
    stop_reason: r.stop_reason === "refusal" ? "refusal" : r.stop_reason === "max_tokens" ? "max_tokens" : "end_turn",
    stop_details: null,
    stop_sequence: null,
    usage,
  };
}

/** Reads the CLI's stream-json lines into a message, or says why the call failed. */
export function readOutput(params: Params, out: RunResult): Anthropic.Messages.Message | Failure {
  if (out.missing) return { kind: "missing", detail: "Claude Code CLI not found" };
  if (out.timedOut) return { kind: "timeout", detail: "timed out" };
  const lines = out.stdout.split("\n").flatMap((l) => {
    try {
      return [JSON.parse(l) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
  const errors = lines.flatMap((l) => (l.type === "assistant" && typeof l.error === "string" ? [l.error] : []));
  const limited = lines.some((l) => l.type === "rate_limit_event" && (l.rate_limit_info as { status?: string } | undefined)?.status === "rejected");
  const result = lines.findLast((l) => l.type === "result") as CliResult | undefined;
  const detail = (result?.result || out.stderr.trim().split("\n").at(-1) || `exit code ${out.code}`).slice(0, 200);
  if (errors.includes("authentication_failed")) return { kind: "auth", detail };
  if (limited || errors.includes("rate_limit") || errors.includes("billing_error")) return { kind: "limit", detail };
  if (result?.subtype === "error_max_structured_output_retries") return { kind: "schema", detail: "the CLI gave up on the schema" };
  if (!result || result.is_error) return { kind: "error", detail };
  if (result.stop_reason === "refusal" || result.stop_reason === "max_tokens") return toMessage(params, result);
  if (result.subtype !== "success") return { kind: "error", detail: result.subtype ?? detail };
  const schema = params.output_config?.format?.schema;
  if (schema) {
    if (result.structured_output === undefined) return { kind: "schema", detail: "no structured output" };
    const check = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]).safeParse(result.structured_output);
    if (!check.success) return { kind: "schema", detail: `output did not match the schema: ${check.error.issues[0]?.message}` };
  }
  return toMessage(params, result);
}

const runCli: Run = (bin, args, { env, cwd, input, timeoutMs }) =>
  new Promise((resolve) => {
    const child = spawn(bin, args, { env: env as NodeJS.ProcessEnv, cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    // A CLI that exits before reading its input closes the pipe; the exit code reports the failure.
    child.stdin.on("error", () => {});
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr || e.message, timedOut, missing: e.code === "ENOENT" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, missing: false });
    });
    child.stdin.end(input);
  });

/** Failures that will repeat on every call, so the rest of the run goes straight to the API. */
const STICKY = new Set<Failure["kind"]>(["missing", "auth", "limit"]);
const REASON: Record<Failure["kind"], string> = {
  missing: "CLI not found",
  auth: "not logged in",
  limit: "usage limit reached",
  timeout: "timed out",
  schema: "output failed the schema twice",
  error: "failed",
};

/** A model client that runs each call through `claude -p` on Sean's subscription, falling back to the API per call. */
export function claudeCodeClient(opts: ClaudeCodeOptions): ExtractClient {
  const env = opts.env ?? process.env;
  const run = opts.run ?? runCli;
  const log = opts.log ?? ((l: string) => console.warn(l));
  let api: ExtractClient | undefined;
  let stuck: Failure | undefined;

  async function viaCli(params: Params): Promise<Anthropic.Messages.Message | Failure> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-claude-code-"));
    try {
      const systemFile = path.join(dir, "system.txt");
      fs.writeFileSync(systemFile, systemText(params));
      const call = async () =>
        readOutput(params, await run(claudeBin(env), cliArgs(params, systemFile), {
          env: childEnv(env, params.max_tokens), cwd: dir, input: stdinFor(params), timeoutMs: opts.timeoutMs ?? TIMEOUT_MS,
        }));
      const first = await call();
      return "kind" in first && first.kind === "schema" ? call() : first;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async function finalMessage(params: Params): Promise<Anthropic.Messages.Message> {
    const fresh = !stuck;
    const r = stuck ?? (await viaCli(params));
    if (!("kind" in r)) return r;
    if (STICKY.has(r.kind)) stuck = r;
    const why = `claude-code ${REASON[r.kind]} (${params.model}): ${r.detail}`;
    if (!opts.fallback) throw new Error(`${why}; fallback is off`);
    if (fresh) log(`${why}; falling back to the API${STICKY.has(r.kind) ? " for the rest of this run" : " for this call"}`);
    api ??= opts.fallback();
    return api.messages.stream(params).finalMessage();
  }

  const stream = (params: Params) => ({ finalMessage: () => finalMessage(params) });
  return { messages: { stream } } as unknown as ExtractClient;
}
