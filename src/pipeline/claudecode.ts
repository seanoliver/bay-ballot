import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExtractClient } from "./extract";

type Env = Record<string, string | undefined>;

/** Where model calls go: Claude Code on Sean's subscription (the default, locally and in CI) or the Anthropic API. */
export type ModelVia = "api" | "claude-code";

export function modelVia(flagValue: string | undefined, envValue: string | undefined): ModelVia {
  const v = flagValue ?? (envValue?.trim() || undefined) ?? "claude-code";
  if (v === "api" || v === "claude-code") return v;
  throw new Error(`--via must be 'api' or 'claude-code', not '${v}'`);
}

export type ClaudeCodeClient = ExtractClient & {
  /** Calls sent to the API after the usage limit, including ones that later failed. */
  apiCalls: () => number;
};

export type RunResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean; missing: boolean };
export type Run = (bin: string, args: string[], opts: { env: Env; cwd: string; input: string; timeoutMs: number }) => Promise<RunResult>;

export type ClaudeCodeOptions = {
  /** The API client to use once the subscription's usage limit is reached; null turns fallback off. Called at most once. */
  fallback: (() => ExtractClient) | null;
  log?: (line: string) => void;
  /** Called once, when the first call goes to the API: before any of it is billed or can fail. */
  onFallback?: () => void;
  env?: Env;
  run?: Run;
  timeoutMs?: number;
};

// An extract takes about a minute; two hung calls must not use up the CI job's 90 minutes.
const TIMEOUT_MS = 10 * 60 * 1000;
const KILL_GRACE_MS = 10 * 1000;

/** CLAUDE_BIN, else the native install, else PATH. Never a shell, so an alias for another account can't apply. */
export function claudeBin(env: Env = process.env): string {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN;
  const local = path.join(env.HOME ?? os.homedir(), ".local", "bin", "claude");
  return fs.existsSync(local) ? local : "claude";
}

/**
 * Only Sean's subscription may bill: drop every API key, token, base URL and third-party provider switch.
 * CI has no login, so it passes his `claude setup-token` token as BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN. A
 * CLAUDE_CODE_OAUTH_TOKEN already in the shell could belong to another account, so it is dropped with the rest.
 */
export function childEnv(env: Env, maxTokens: number): Env {
  const kept = Object.entries(env).filter(
    ([k]) => !k.startsWith("ANTHROPIC_") && !k.startsWith("CLAUDE_CODE_") && !k.startsWith("BAYBALLOT_") && k !== "CLAUDE_CONFIG_DIR",
  );
  return {
    ...Object.fromEntries(kept),
    CLAUDE_CONFIG_DIR: env.BAYBALLOT_CLAUDE_CONFIG_DIR || path.join(env.HOME ?? os.homedir(), ".claude-personal"),
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxTokens),
    ...(env.BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN ? { CLAUDE_CODE_OAUTH_TOKEN: env.BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN } : {}),
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
  // stream-json writes the CLI's internal apiError as api_error, on the assistant line and on the result line.
  const limitError = lines.some((l) => (l.type === "assistant" || l.type === "result") && l.api_error === "usage_limit_reached");
  // The CLI's usage-limit refusal is a rejected event with isUsingOverage false. A rejected event with isUsingOverage
  // true means the call ran on extra usage and succeeded; a throttle or 429 with no such event is an ordinary failure.
  const limited = lines.some((l) => {
    const info = l.type === "rate_limit_event" ? (l.rate_limit_info as { status?: string; isUsingOverage?: boolean } | undefined) : undefined;
    return info?.status === "rejected" && info.isUsingOverage !== true;
  }) || limitError;
  const result = lines.findLast((l) => l.type === "result") as CliResult | undefined;
  const detail = (result?.result || out.stderr.trim().split("\n").at(-1) || `exit code ${out.code}`).slice(0, 200);
  const failed = !result || result.is_error || result.subtype !== "success";
  if (errors.includes("authentication_failed")) return { kind: "auth", detail };
  if (failed && limited) return { kind: "limit", detail };
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
    let kill: NodeJS.Timeout | undefined;
    const done = (r: RunResult) => {
      clearTimeout(timer);
      clearTimeout(kill);
      resolve(r);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // A CLI that ignores SIGTERM, or a grandchild holding the pipes open, must not hang the run.
      kill = setTimeout(() => {
        child.kill("SIGKILL");
        done({ code: null, stdout, stderr, timedOut, missing: false });
      }, KILL_GRACE_MS);
    }, timeoutMs);
    // Decoded as a stream: a character split across two chunks would otherwise turn into U+FFFD and fail the quote checks.
    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));
    // A CLI that exits before reading its input closes the pipe; the exit code reports the failure.
    child.stdin.on("error", () => {});
    child.on("error", (e: NodeJS.ErrnoException) => done({ code: null, stdout, stderr: stderr || e.message, timedOut, missing: e.code === "ENOENT" }));
    child.on("close", (code) => done({ code, stdout, stderr, timedOut, missing: false }));
    child.stdin.end(input);
  });

/** Failures that will repeat on every call: after one, the rest of the run skips the CLI. */
const STICKY = new Set<Failure["kind"]>(["missing", "auth", "limit"]);
const REASON: Record<Failure["kind"], string> = {
  missing: "CLI not found",
  auth: "not logged in",
  limit: "usage limit reached",
  timeout: "timed out",
  schema: "output failed the schema twice",
  error: "failed",
};

/**
 * A model client that runs each call through `claude -p` on Sean's subscription. Only a usage limit sends calls to
 * the API, and then for the rest of the run; any other failure fails the call, so a broken login never bills the API.
 */
export function claudeCodeClient(opts: ClaudeCodeOptions): ClaudeCodeClient {
  const env = opts.env ?? process.env;
  const run = opts.run ?? runCli;
  const log = opts.log ?? ((l: string) => console.warn(l));
  let api: ExtractClient | undefined;
  let stuck: Failure | undefined;
  let apiCalls = 0;

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
    if (r.kind !== "limit") throw new Error(why);
    if (!opts.fallback) throw new Error(`${why}; API fallback is off`);
    // Built before onFallback: with no API key it throws here, and no API call is reported.
    api ??= opts.fallback();
    if (fresh) {
      log(`${why}; falling back to the API for the rest of this run`);
      opts.onFallback?.();
    }
    // Counted before the call: a guide that fails after reaching the API has no usage to price, and still billed.
    apiCalls++;
    return api.messages.stream(params).finalMessage();
  }

  const stream = (params: Params) => ({ finalMessage: () => finalMessage(params) });
  return { messages: { stream }, apiCalls: () => apiCalls } as unknown as ClaudeCodeClient;
}
