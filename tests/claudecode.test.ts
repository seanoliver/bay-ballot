import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { loadElection } from "@/lib/data";
import type { EndorsementFile, Guide } from "@/lib/schema";
import { childEnv, claudeBin, claudeCodeClient, cliArgs, modelVia, systemText, onSubscription, type Run, type RunResult } from "@/pipeline/claudecode";
import { extract, MODEL, type ExtractClient, type ExtractOutput, type Source } from "@/pipeline/extract";
import { costOf, costText, type GuideResult } from "@/pipeline/refresh";
import { verify, VERIFY_MODEL, type VerifyOutput } from "@/pipeline/verify";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");
const guide: Guide = { id: "growsf", name: "GrowSF", description: "", type: "advocacy", homepage: "https://growsf.org/", areas: ["sf"] };
const sources: Source[] = [
  { url: "https://growsf.org/guide", fetched: { kind: "text", text: "No on Prop B." } },
  { url: "https://growsf.org/guide.pdf", fetched: { kind: "pdf", text: "Yes on C", base64: "JVBERi0xLjQ=" } },
];
const extractOut: ExtractOutput = {
  hasReasoning: false,
  picks: [{ contestId: "prop-b", vote: "N", candidates: [], ranked: false, rankedCount: null, quotes: [], note: null }],
};
const verifyOut: VerifyOutput = { picks: [{ contestId: "prop-b", verdict: "confirmed", evidence: "No on Prop B" }], quotes: [], missing: [] };
const file: EndorsementFile = {
  guide: "growsf", election: "2026-11", status: "published", source: "https://growsf.org/guide", fetchedAt: "2026-10-05", hasReasoning: false,
  picks: { "prop-b": { pick: "N", ranked: false, quotes: [] } },
};

const USAGE = { input_tokens: 12, output_tokens: 34, cache_creation_input_tokens: 56, cache_read_input_tokens: 78 };
const lines = (...objs: object[]) => objs.map((o) => JSON.stringify(o)).join("\n");
const ok = (structured: unknown, extra: object = {}): RunResult => ({
  code: 0, stderr: "", timedOut: false, missing: false,
  stdout: lines(
    { type: "system", subtype: "init", tools: ["StructuredOutput"] },
    { type: "rate_limit_event", rate_limit_info: { status: "allowed" } },
    { type: "result", subtype: "success", is_error: false, stop_reason: "tool_use", usage: USAGE, structured_output: structured, ...extra },
  ),
});
const fail = (stdout: string, code = 1): RunResult => ({ code, stdout, stderr: "", timedOut: false, missing: false });
const NOT_LOGGED_IN = fail(lines(
  { type: "assistant", message: { content: [{ type: "text", text: "Not logged in · Please run /login" }] }, error: "authentication_failed" },
  { type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" },
));
const LIMITED = fail(lines(
  { type: "rate_limit_event", rate_limit_info: { status: "rejected", rateLimitType: "five_hour" } },
  { type: "result", subtype: "success", is_error: true, result: "Claude usage limit reached" },
));

/** An API client whose answers follow the requested model, like the real one. */
function apiFake() {
  const stream = vi.fn((req: { model: string }) => ({
    finalMessage: async () => ({
      stop_reason: "end_turn",
      stop_details: null,
      usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      content: [{ type: "text", text: JSON.stringify(req.model === VERIFY_MODEL ? verifyOut : extractOut) }],
    }),
  }));
  return { client: { messages: { stream } } as unknown as ExtractClient, stream };
}

function setup(results: RunResult[], { fallback = true } = {}) {
  const run = vi.fn<Run>(async () => results.shift() ?? ok(extractOut));
  const api = apiFake();
  const makeApi = vi.fn(() => api.client);
  const log = vi.fn();
  const env = { HOME: "/home/sean", PATH: "/usr/bin", ANTHROPIC_API_KEY: "sk-work", BAYBALLOT_ANTHROPIC_API_KEY: "sk-bb" };
  const client = claudeCodeClient({ fallback: fallback ? makeApi : null, run, log, env });
  return { client, run, api, makeApi, log };
}

describe("modelVia", () => {
  it("defaults to the API", () => expect(modelVia(undefined, undefined)).toBe("api"));
  it("reads BAYBALLOT_MODEL_VIA, and the flag wins over it", () => {
    expect(modelVia(undefined, "claude-code")).toBe("claude-code");
    expect(modelVia("api", "claude-code")).toBe("api");
  });
  it("rejects anything else", () => expect(() => modelVia("claude", undefined)).toThrow("--via must be 'api' or 'claude-code', not 'claude'"));
});

describe("claudeBin", () => {
  it("prefers CLAUDE_BIN, then ~/.local/bin/claude, then PATH, never a shell alias", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "bb-cc-home-"));
    expect(claudeBin({ HOME: home })).toBe("claude");
    fs.mkdirSync(path.join(home, ".local", "bin"), { recursive: true });
    fs.writeFileSync(path.join(home, ".local", "bin", "claude"), "");
    expect(claudeBin({ HOME: home })).toBe(path.join(home, ".local", "bin", "claude"));
    expect(claudeBin({ HOME: home, CLAUDE_BIN: "/opt/claude" })).toBe("/opt/claude");
  });
});

describe("childEnv", () => {
  const parent = {
    HOME: "/home/sean", PATH: "/usr/bin",
    ANTHROPIC_API_KEY: "sk-work", ANTHROPIC_AUTH_TOKEN: "tok", ANTHROPIC_BASE_URL: "https://proxy", BAYBALLOT_ANTHROPIC_API_KEY: "sk-bb",
    CLAUDE_CODE_OAUTH_TOKEN: "work-oauth", CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CONFIG_DIR: "/home/sean/.claude-work",
  };

  it("removes every way to bill something other than the personal login", () => {
    const env = childEnv(parent, 64000);
    for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "BAYBALLOT_ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK"]) {
      expect(env).not.toHaveProperty(k);
    }
    expect(env).toMatchObject({ HOME: "/home/sean", PATH: "/usr/bin", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "64000" });
  });

  it("points at ~/.claude-personal, not the shell's config dir, unless BAYBALLOT_CLAUDE_CONFIG_DIR says otherwise", () => {
    expect(childEnv(parent, 1).CLAUDE_CONFIG_DIR).toBe("/home/sean/.claude-personal");
    expect(childEnv({ ...parent, BAYBALLOT_CLAUDE_CONFIG_DIR: "/tmp/cfg" }, 1).CLAUDE_CONFIG_DIR).toBe("/tmp/cfg");
  });
});

describe("cliArgs", () => {
  const params = {
    model: "claude-opus-5-5",
    max_tokens: 100,
    system: [{ type: "text" as const, text: "Audit this." }],
    messages: [{ role: "user" as const, content: "hi" }],
    output_config: { effort: "high" as const, format: { type: "json_schema" as const, schema: { type: "object" } } },
  };
  const args = cliArgs(params, "/tmp/system.txt");
  const value = (f: string) => args[args.indexOf(f) + 1];

  it("replaces the system prompt and passes the model, schema and effort", () => {
    expect(args[0]).toBe("-p");
    expect(value("--model")).toBe("claude-opus-5-5");
    expect(value("--system-prompt-file")).toBe("/tmp/system.txt");
    expect(systemText(params)).toBe("Audit this.");
    expect(value("--json-schema")).toBe('{"type":"object"}');
    expect(value("--effort")).toBe("high");
    expect(args.filter((a) => a.includes("append-system-prompt"))).toEqual([]);
  });

  it("disables every tool, MCP server, customization and saved session, and never uses --bare", () => {
    expect(value("--tools")).toBe("");
    for (const f of ["--strict-mcp-config", "--safe-mode", "--no-session-persistence"]) expect(args).toContain(f);
    expect(args).not.toContain("--bare");
  });

  it("reads the user message as stream-json on stdin", () => {
    expect(value("--input-format")).toBe("stream-json");
    expect(value("--output-format")).toBe("stream-json");
    expect(args).not.toContain("hi");
  });
});

describe("claudeCodeClient", () => {
  it("runs extraction through the CLI and maps its result for extract()", async () => {
    const t = setup([ok(extractOut)]);
    const r = await extract(t.client, ballot, guide, sources);
    expect(r.output).toEqual(extractOut);
    expect(r.usage).toMatchObject(USAGE);
    expect(onSubscription(r.usage)).toBe(true);
    expect(t.makeApi).not.toHaveBeenCalled();

    const [bin, args, opts] = t.run.mock.calls[0];
    expect(bin).toBe("claude");
    expect(args[args.indexOf("--model") + 1]).toBe(MODEL);
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1]).properties.picks.type).toBe("array");
    expect(args).not.toContain("--effort");
    expect(opts.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(opts.env).not.toHaveProperty("BAYBALLOT_ANTHROPIC_API_KEY");
    expect(opts.env.CLAUDE_CONFIG_DIR).toBe("/home/sean/.claude-personal");
    const msg = JSON.parse(opts.input);
    expect(msg).toMatchObject({ type: "user", message: { role: "user" } });
    expect(msg.message.content.map((b: { type: string }) => b.type)).toEqual(["text", "document", "text"]);
  });

  it("runs the verifier on its own model at high effort", async () => {
    const t = setup([ok(verifyOut)]);
    const r = await verify(t.client, ballot, guide, file, sources);
    expect(r.output).toEqual(verifyOut);
    const args = t.run.mock.calls[0][1];
    expect(args[args.indexOf("--model") + 1]).toBe(VERIFY_MODEL);
    expect(VERIFY_MODEL).not.toBe(MODEL);
    expect(args[args.indexOf("--effort") + 1]).toBe("high");
  });

  it("reports zero tokens when the CLI gives no usage", async () => {
    const t = setup([ok(extractOut, { usage: undefined })]);
    const r = await extract(t.client, ballot, guide, sources);
    expect(r.usage).toMatchObject({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
  });

  it("passes a refusal through to the caller instead of falling back", async () => {
    const t = setup([ok(undefined, { stop_reason: "refusal" })]);
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow("refused");
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it("retries once when the output fails the schema, without falling back", async () => {
    const t = setup([ok({ hasReasoning: "yes", picks: [] }), ok(extractOut)]);
    expect((await extract(t.client, ballot, guide, sources)).output).toEqual(extractOut);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it("falls back to the API for the call when the output fails the schema twice", async () => {
    const t = setup([ok({ picks: [] }), fail(lines({ type: "result", subtype: "error_max_structured_output_retries", is_error: true }))]);
    const r = await extract(t.client, ballot, guide, sources);
    expect(r.output).toEqual(extractOut);
    expect(onSubscription(r.usage)).toBe(false);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.api.stream.mock.calls[0][0].model).toBe(MODEL);
    expect(t.log).toHaveBeenCalledOnce();
    expect(t.log.mock.calls[0][0]).toMatch(/^claude-code output failed the schema twice \(claude-sonnet-5-5\): .*; falling back to the API for this call$/);

    await extract(t.client, ballot, guide, sources);
    expect(t.run).toHaveBeenCalledTimes(3);
  });

  it("falls back for a timed-out call and tries the CLI again on the next", async () => {
    const t = setup([{ code: null, stdout: "", stderr: "", timedOut: true, missing: false }]);
    await extract(t.client, ballot, guide, sources);
    await extract(t.client, ballot, guide, sources);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.api.stream).toHaveBeenCalledOnce();
    expect(t.log.mock.calls[0][0]).toContain("claude-code timed out");
  });

  it.each([
    ["CLI not found", { code: null, stdout: "", stderr: "spawn claude ENOENT", timedOut: false, missing: true }],
    ["not logged in", NOT_LOGGED_IN],
    ["usage limit reached", LIMITED],
  ])("uses the API for the rest of the run once the CLI is %s, logging it once", async (reason, result) => {
    const t = setup([result]);
    await extract(t.client, ballot, guide, sources);
    await verify(t.client, ballot, guide, file, sources);
    expect(t.run).toHaveBeenCalledOnce();
    expect(t.api.stream.mock.calls.map((c) => c[0].model)).toEqual([MODEL, VERIFY_MODEL]);
    expect(t.makeApi).toHaveBeenCalledOnce();
    expect(t.log).toHaveBeenCalledOnce();
    expect(t.log.mock.calls[0][0]).toContain(`claude-code ${reason}`);
    expect(t.log.mock.calls[0][0]).toContain("for the rest of this run");
  });

  it("throws instead of using the API when fallback is off", async () => {
    const t = setup([LIMITED], { fallback: false });
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow("claude-code usage limit reached (claude-sonnet-5-5): Claude usage limit reached; fallback is off");
    expect(t.api.stream).not.toHaveBeenCalled();
  });
});

describe("the default runner", () => {
  // A shell stub, not node: it has to record argv, env and stdin, and print one result line.
  const stub = (body: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-cc-bin-"));
    const bin = path.join(dir, "claude");
    fs.writeFileSync(bin, `#!/bin/sh\ncd "${dir}"\n${body}\n`, { mode: 0o755 });
    return { dir, bin };
  };
  const result = JSON.stringify({ type: "result", subtype: "success", is_error: false, usage: USAGE, structured_output: extractOut });

  it("spawns CLAUDE_BIN with the scrubbed env and the message on stdin", async () => {
    const { dir, bin } = stub(`printf '%s\\n' "$@" > argv\nenv > env\ncat > input\nprintf '%s\\n' '${result}'`);
    const api = apiFake();
    const client = claudeCodeClient({
      fallback: () => api.client,
      env: { ...process.env, CLAUDE_BIN: bin, ANTHROPIC_API_KEY: "sk-work", BAYBALLOT_ANTHROPIC_API_KEY: "sk-bb", BAYBALLOT_CLAUDE_CONFIG_DIR: "/tmp/personal" },
    });
    expect((await extract(client, ballot, guide, sources)).output).toEqual(extractOut);
    expect(api.stream).not.toHaveBeenCalled();
    const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
    expect(read("argv").split("\n")).toContain("--json-schema");
    const env = read("env").split("\n");
    expect(env).toContain("CLAUDE_CONFIG_DIR=/tmp/personal");
    expect(env.filter((l) => /^(ANTHROPIC_API_KEY|BAYBALLOT_ANTHROPIC_API_KEY)=/.test(l))).toEqual([]);
    expect(JSON.parse(read("input")).message.content.at(-1).text).toContain("Organization: GrowSF");
  });

  it("falls back when the binary doesn't exist", async () => {
    const api = apiFake();
    const log = vi.fn();
    const client = claudeCodeClient({ fallback: () => api.client, log, env: { ...process.env, CLAUDE_BIN: "/nonexistent/claude" } });
    expect((await extract(client, ballot, guide, sources)).output).toEqual(extractOut);
    expect(log.mock.calls[0][0]).toContain("claude-code CLI not found");
  });

  it("kills a CLI that runs past the timeout and falls back", async () => {
    const { bin } = stub("exec sleep 60");
    const api = apiFake();
    const log = vi.fn();
    const client = claudeCodeClient({ fallback: () => api.client, log, timeoutMs: 200, env: { ...process.env, CLAUDE_BIN: bin } });
    expect((await extract(client, ballot, guide, sources)).output).toEqual(extractOut);
    expect(log.mock.calls[0][0]).toContain("claude-code timed out");
  });
});

describe("cost", () => {
  it("counts subscription calls without pricing them", async () => {
    const t = setup([ok(extractOut), ok(verifyOut)]);
    const e = await extract(t.client, ballot, guide, sources);
    const v = await verify(t.client, ballot, guide, file, sources);
    const changed = (extract: Anthropic.Messages.Usage, verify?: Anthropic.Messages.Usage): GuideResult => ({
      id: "growsf", status: "changed", dataChanged: false, diff: [], notes: [], held: [], droppedByVerifier: 0, missing: [], usage: { extract, verify },
    });
    expect(costOf([changed(e.usage, v.usage)])).toBe(0);
    expect(costText([changed(e.usage, v.usage)])).toBe("$0.00 API, plus 2 calls on the Claude subscription");
    const apiUsage = { ...e.usage, input_tokens: 1_000_000 };
    expect(costText([changed(apiUsage)])).toBe("$2.00");
  });
});
