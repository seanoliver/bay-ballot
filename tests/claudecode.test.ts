import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { loadElection } from "@/lib/data";
import type { EndorsementFile, Guide } from "@/lib/schema";
import { childEnv, claudeBin, claudeCodeClient, cliArgs, modelVia, systemText, onSubscription, type Run, type RunResult } from "@/pipeline/claudecode";
import { extract, MODEL, type ExtractClient, type ExtractOutput, type Source } from "@/pipeline/extract";
import { costOf, costText, resultJson, type GuideResult } from "@/pipeline/refresh";
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
  it("defaults to the subscription", () => expect(modelVia(undefined, undefined)).toBe("claude-code"));
  it("reads BAYBALLOT_MODEL_VIA, and the flag wins over it", () => {
    expect(modelVia(undefined, "api")).toBe("api");
    expect(modelVia("claude-code", "api")).toBe("claude-code");
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

  it("passes only BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN on as the subscription token", () => {
    expect(childEnv({ ...parent, BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN: "personal-oauth" }, 1)).toMatchObject({ CLAUDE_CODE_OAUTH_TOKEN: "personal-oauth" });
    expect(childEnv({ ...parent, BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN: "personal-oauth" }, 1)).not.toHaveProperty("BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN");
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

  it("uses the API's default effort when the request sets none", () => {
    const effortOf = (model: string) => {
      const a = cliArgs({ ...params, model, output_config: { format: params.output_config.format } }, "/tmp/system.txt");
      return a[a.indexOf("--effort") + 1];
    };
    expect(effortOf("claude-sonnet-5-5")).toBe("high");
    expect(effortOf("claude-opus-5-5")).toBe("medium");
  });

  it("disables every tool, MCP server, customization, settings file and saved session, and never uses --bare", () => {
    expect(value("--tools")).toBe("");
    expect(value("--setting-sources")).toBe("");
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
    // The API's default for Sonnet when extract sets none, not Sean's effortLevel setting.
    expect(args[args.indexOf("--effort") + 1]).toBe("high");
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

  it("fails the call without using the API when the output fails the schema twice, and tries the CLI on the next", async () => {
    const t = setup([ok({ picks: [] }), fail(lines({ type: "result", subtype: "error_max_structured_output_retries", is_error: true }))]);
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow(/^claude-code output failed the schema twice \(claude-sonnet-5-5\)/);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.makeApi).not.toHaveBeenCalled();

    expect((await extract(t.client, ballot, guide, sources)).output).toEqual(extractOut);
    expect(t.run).toHaveBeenCalledTimes(3);
  });

  it("fails a timed-out call without using the API, and tries the CLI on the next", async () => {
    const t = setup([{ code: null, stdout: "", stderr: "", timedOut: true, missing: false }]);
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow("claude-code timed out");
    await extract(t.client, ballot, guide, sources);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it.each([
    ["CLI not found", { code: null, stdout: "", stderr: "spawn claude ENOENT", timedOut: false, missing: true }],
    ["not logged in", NOT_LOGGED_IN],
  ])("fails every call once the CLI is %s, without using the API", async (reason, result) => {
    const t = setup([result]);
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow(`claude-code ${reason}`);
    await expect(verify(t.client, ballot, guide, file, sources)).rejects.toThrow(`claude-code ${reason}`);
    expect(t.run).toHaveBeenCalledOnce();
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it("uses the API for the rest of the run once the usage limit is reached, logging it once", async () => {
    const t = setup([LIMITED]);
    const r = await extract(t.client, ballot, guide, sources);
    expect(onSubscription(r.usage)).toBe(false);
    await verify(t.client, ballot, guide, file, sources);
    expect(t.run).toHaveBeenCalledOnce();
    expect(t.api.stream.mock.calls.map((c) => c[0].model)).toEqual([MODEL, VERIFY_MODEL]);
    expect(t.makeApi).toHaveBeenCalledOnce();
    expect(t.log).toHaveBeenCalledOnce();
    expect(t.log.mock.calls[0][0]).toMatch(/^claude-code usage limit reached \(claude-sonnet-5-5\): .*; falling back to the API for the rest of this run$/);
  });

  it("keeps a call that ran on extra usage instead of paying the API for it again", async () => {
    const overage = ok(extractOut);
    overage.stdout = lines({ type: "rate_limit_event", rate_limit_info: { status: "rejected", isUsingOverage: true } }) + "\n" + overage.stdout;
    const t = setup([overage]);
    expect(onSubscription((await extract(t.client, ballot, guide, sources)).usage)).toBe(true);
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it.each([
    ["a throttle", "rate_limit"],
    ["a billing error", "billing_error"],
  ])("fails just that call on %s with no usage-limit event, without using the API", async (_name, error) => {
    const t = setup([fail(lines(
      { type: "assistant", message: { content: [{ type: "text", text: "API Error" }] }, error },
      { type: "result", subtype: "success", is_error: true, result: "API Error" },
    ))]);
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow("claude-code failed");
    await extract(t.client, ballot, guide, sources);
    expect(t.run).toHaveBeenCalledTimes(2);
    expect(t.makeApi).not.toHaveBeenCalled();
  });

  it("reports no fallback when the API client can't be built", async () => {
    const onFallback = vi.fn();
    const client = claudeCodeClient({
      fallback: () => { throw new Error("no BAYBALLOT_ANTHROPIC_API_KEY"); },
      onFallback, run: vi.fn<Run>(async () => LIMITED), log: () => {}, env: { HOME: "/home/sean" },
    });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow("no BAYBALLOT_ANTHROPIC_API_KEY");
    expect(onFallback).not.toHaveBeenCalled();
    expect(client.apiCalls()).toBe(0);
  });

  it("calls onFallback once, when the first call goes to the API", async () => {
    const onFallback = vi.fn();
    const run = vi.fn<Run>(async () => LIMITED);
    const api = apiFake();
    const client = claudeCodeClient({ fallback: () => api.client, onFallback, run, log: () => {}, env: { HOME: "/home/sean" } });
    await extract(client, ballot, guide, sources);
    await verify(client, ballot, guide, file, sources);
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("treats an assistant usage_limit_reached error as the usage limit", async () => {
    const t = setup([fail(lines(
      { type: "assistant", message: { content: [{ type: "text", text: "limit" }] }, error: "rate_limit", is_api_error_message: true, api_error: "usage_limit_reached" },
      { type: "result", subtype: "success", is_error: true, result: "limit" },
    ))]);
    await extract(t.client, ballot, guide, sources);
    expect(t.makeApi).toHaveBeenCalledOnce();
  });

  it("counts API calls past the usage limit, including ones that then fail", async () => {
    const t = setup([LIMITED]);
    expect(t.client.apiCalls()).toBe(0);
    await extract(t.client, ballot, guide, sources);
    t.api.stream.mockImplementationOnce(() => ({ finalMessage: async () => { throw new Error("network"); } }));
    await expect(verify(t.client, ballot, guide, file, sources)).rejects.toThrow("network");
    expect(t.client.apiCalls()).toBe(2);
  });

  it("throws instead of using the API at the usage limit when fallback is off", async () => {
    const t = setup([LIMITED], { fallback: false });
    await expect(extract(t.client, ballot, guide, sources)).rejects.toThrow("claude-code usage limit reached (claude-sonnet-5-5): Claude usage limit reached; API fallback is off");
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

  it("reports a binary that doesn't exist", async () => {
    const api = apiFake();
    const client = claudeCodeClient({ fallback: () => api.client, env: { ...process.env, CLAUDE_BIN: "/nonexistent/claude" } });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow("claude-code CLI not found");
    expect(api.stream).not.toHaveBeenCalled();
  });

  it("keeps a character that the CLI's output splits across two writes", async () => {
    const out: ExtractOutput = { ...extractOut, picks: [{ ...extractOut.picks[0], quotes: ["José says “no”."] }] };
    const line = Buffer.from(JSON.stringify({ type: "result", subtype: "success", is_error: false, usage: USAGE, structured_output: out }));
    const cut = line.indexOf(Buffer.from("é")) + 1;
    const { dir, bin } = stub(`cat > /dev/null\ncat part1\nsleep 0.2\ncat part2`);
    fs.writeFileSync(path.join(dir, "part1"), line.subarray(0, cut));
    fs.writeFileSync(path.join(dir, "part2"), Buffer.concat([line.subarray(cut), Buffer.from("\n")]));
    const client = claudeCodeClient({ fallback: null, env: { ...process.env, CLAUDE_BIN: bin } });
    expect((await extract(client, ballot, guide, sources)).output.picks[0].quotes).toEqual(["José says “no”."]);
  });

  it("force-kills a CLI that ignores SIGTERM", async () => {
    const { dir, bin } = stub("trap '' TERM\ntouch ready\nwhile :; do sleep 1; done");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const client = claudeCodeClient({ fallback: null, timeoutMs: 100, env: { ...process.env, CLAUDE_BIN: bin } });
      const call = expect(extract(client, ballot, guide, sources)).rejects.toThrow("claude-code timed out");
      // SIGTERM must arrive after the trap is set, or the stub dies of it and the test proves nothing.
      while (!fs.existsSync(path.join(dir, "ready"))) await new Promise((r) => setImmediate(r));
      await vi.advanceTimersByTimeAsync(100);
      await new Promise((r) => setImmediate(r));
      await vi.advanceTimersByTimeAsync(10_000);
      await call;
    } finally {
      vi.useRealTimers();
    }
  });

  it("kills a CLI that runs past the timeout", async () => {
    const { bin } = stub("exec sleep 60");
    const api = apiFake();
    const client = claudeCodeClient({ fallback: () => api.client, timeoutMs: 200, env: { ...process.env, CLAUDE_BIN: bin } });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow("claude-code timed out");
    expect(api.stream).not.toHaveBeenCalled();
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

  it("records API spend in result.json, so a fallback at the usage limit can alert", async () => {
    const t = setup([LIMITED]);
    const e = await extract(t.client, ballot, guide, sources);
    const r: GuideResult = { id: "growsf", status: "changed", dataChanged: false, diff: [], notes: [], held: [], droppedByVerifier: 0, missing: [], usage: { extract: e.usage } };
    expect(resultJson([r], 0).apiCost).toBeGreaterThan(0);
    const sub = await extract(setup([]).client, ballot, guide, sources);
    expect(resultJson([{ ...r, usage: { extract: sub.usage } }], 0).apiCost).toBe(0);
    expect(resultJson([], 1, { apiFallbackCalls: 3 }).apiFallbackCalls).toBe(3);
  });
});
