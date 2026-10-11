import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { claudeCodeClient, type RunResult } from "@/pipeline/claudecode";
import type { GuideResult } from "@/pipeline/refresh";
import { formatTokens, readReport, reportJson, runRecord, withFailure, type ReportJson } from "@/pipeline/report";

type Usage = Anthropic.Messages.Usage;

const apiUsage = (input: number, output = 0, cacheRead = 0, cacheWrite = 0): Usage =>
  ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite }) as Usage;

/** Usage from a real Claude Code client call, so it is marked as billed to the subscription. */
async function subUsage(input: number, output = 0, cacheRead = 0, cacheWrite = 0): Promise<Usage> {
  const usage = { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite };
  const run = async (): Promise<RunResult> => ({
    code: 0, stderr: "", timedOut: false, missing: false,
    stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, stop_reason: "end_turn", result: "{}", usage }),
  });
  const client = claudeCodeClient({ fallback: null, run, env: { HOME: "/home/sean" } });
  const msg = await client.messages.stream({ model: "claude-sonnet-5-5", max_tokens: 100, messages: [{ role: "user", content: "x" }] }).finalMessage();
  return msg.usage;
}

const changed = (id: string, extract: Usage, verify?: Usage, extra: Partial<Extract<GuideResult, { status: "changed" }>> = {}): GuideResult => ({
  id, status: "changed", dataChanged: true, diff: [], notes: [], held: [], droppedByVerifier: 0, missing: [], usage: { extract, verify }, ...extra,
});
const held = (contestId: string) => ({ contestId, pick: "Y" as const, reason: "wrong-pick" as const, evidence: "e" });
const NOT_LOGGED_IN = "claude-code not logged in (claude-sonnet-5-5): Not logged in · Please run /login";

describe("reportJson counts", () => {
  it("counts each status, held picks and review items, and keeps every result.json field", async () => {
    const results: GuideResult[] = [
      { id: "a", status: "unchanged" },
      { id: "b", status: "unchanged" },
      { id: "c", status: "skipped", reason: "manual" },
      { id: "d", status: "deferred" },
      { id: "e", status: "failed", error: "HTTP 403" },
      { id: "f", status: "shrunk", message: "f: shrank", notes: [], pageHash: "1".repeat(64), usage: await subUsage(10) },
      { id: "g", status: "shrunk-skipped", pageHash: "2".repeat(64) },
      changed("h", await subUsage(10), await subUsage(10), { held: [held("prop-b"), held("prop-c")] }),
      changed("i", await subUsage(10), undefined, { dataChanged: false }),
    ];
    const r = reportJson(results, 2);
    expect(r.counts).toEqual({
      checked: 9, unchanged: 2, extracted: 2, dataChanged: 1, deferred: 1, skipped: 1, failed: 1, shrunk: 2, held: 2, review: 4,
    });
    expect(r).toMatchObject({ exitCode: 2, extracted: ["h", "i"], deferred: ["d"], failed: [{ id: "e", error: "HTTP 403" }], apiCost: 0, apiFallbackCalls: 0 });
    expect(r.review).toHaveLength(4);
  });
});

describe("reportJson calls, tokens and cost", () => {
  it("counts subscription calls apart from API calls, and sums tokens over both", async () => {
    const results = [changed("a", await subUsage(100, 10, 1000, 50), apiUsage(200, 20, 2000, 60))];
    const r = reportJson(results, 0);
    expect(r.calls).toEqual({ subscription: 1, api: 1 });
    expect(r.tokens).toEqual({ input: 300, output: 30, cacheRead: 3000, cacheWrite: 110 });
  });

  it("does not count a fallback API call twice when its usage was kept", async () => {
    const results = [changed("a", apiUsage(100), apiUsage(100))];
    expect(reportJson(results, 0, { apiFallbackCalls: 2 }).calls).toEqual({ subscription: 0, api: 2 });
  });

  it("counts fallback calls whose guide then failed and left no usage", async () => {
    const results: GuideResult[] = [changed("a", apiUsage(100)), { id: "b", status: "failed", error: "boom" }];
    expect(reportJson(results, 1, { apiFallbackCalls: 3 }).calls).toEqual({ subscription: 0, api: 3 });
  });

  it("counts every call on --via api, where apiFallbackCalls is zero", () => {
    const results = [changed("a", apiUsage(100), apiUsage(100)), changed("b", apiUsage(100))];
    expect(reportJson(results, 0).calls).toEqual({ subscription: 0, api: 3 });
  });

  it("prices all usage at API rates, rounded up to the cent, without calling it spend", async () => {
    const results = [changed("a", await subUsage(1_000_000), await subUsage(0, 100_000)), changed("b", await subUsage(1))];
    const r = reportJson(results, 0);
    expect(r.apiEquivalentCost).toBe(4.01);
    expect(r.apiCost).toBe(0);
  });

  it("records the duration it is given", () => {
    expect(reportJson([], 0, { durationSec: 754 }).durationSec).toBe(754);
  });
});

describe("modelFailures", () => {
  it("lists guides that failed in Claude Code, not fetch failures", () => {
    const results: GuideResult[] = [
      { id: "a", status: "failed", error: NOT_LOGGED_IN },
      { id: "b", status: "failed", error: "HTTP 403 from https://b.org" },
      { id: "c", status: "failed", error: "claude-code timed out (claude-opus-5-5): timed out" },
    ];
    expect(reportJson(results, 1).modelFailures).toEqual(["a", "c"]);
  });
});

describe("alerts", () => {
  it("has none on a clean day, and fetch failures are never alerts", async () => {
    const results: GuideResult[] = [{ id: "a", status: "unchanged" }, { id: "b", status: "failed", error: "HTTP 403" }, changed("c", await subUsage(10))];
    expect(reportJson(results, 1).alerts).toEqual([]);
  });

  it("is high when the run used the API, by cost or by fallback calls", () => {
    expect(reportJson([changed("a", apiUsage(1_000_000))], 0).alerts).toEqual([{ level: "high", text: "Used the API: 1 call, about $2.00" }]);
    expect(reportJson([], 1, { apiFallbackCalls: 3 }).alerts).toEqual([{ level: "high", text: "Used the API: 3 calls, about $0.00" }]);
  });

  it("is high when guides failed in Claude Code, with the first reason", async () => {
    const results: GuideResult[] = [
      changed("a", await subUsage(10)),
      { id: "b", status: "failed", error: "claude-code timed out (claude-opus-5-5): timed out" },
      { id: "c", status: "failed", error: NOT_LOGGED_IN },
    ];
    expect(reportJson(results, 1).alerts).toEqual([{ level: "high", text: "2 guides failed in Claude Code: timed out" }]);
  });

  it("says the token likely expired when every attempted extraction was not logged in", () => {
    const results: GuideResult[] = [
      { id: "a", status: "failed", error: NOT_LOGGED_IN },
      { id: "b", status: "failed", error: NOT_LOGGED_IN },
      { id: "c", status: "failed", error: "HTTP 403" },
      { id: "d", status: "unchanged" },
    ];
    expect(reportJson(results, 1).alerts).toEqual([
      { level: "high", text: "2 guides failed in Claude Code: not logged in; the subscription token likely expired" },
    ]);
  });

  it("is review when items need review, after any high alert", () => {
    const results: GuideResult[] = [
      changed("a", apiUsage(1), undefined, { held: [held("prop-b")] }),
      { id: "b", status: "shrunk-skipped", pageHash: "1".repeat(64) },
    ];
    expect(reportJson(results, 2).alerts).toEqual([
      { level: "high", text: "Used the API: 1 call, about $0.01" },
      { level: "review", text: "2 items need review" },
    ]);
    expect(reportJson([results[1]], 2).alerts).toEqual([{ level: "review", text: "1 item needs review" }]);
  });
});

describe("digest", () => {
  it("is one line with the day's numbers", async () => {
    const results: GuideResult[] = [
      ...Array.from({ length: 119 }, (_, i): GuideResult => ({ id: `u${i}`, status: "unchanged" })),
      changed("a", await subUsage(200_000, 6_000, 0, 0), await subUsage(200_000, 6_000)),
      changed("b", await subUsage(10), undefined, { held: [held("prop-b"), held("prop-c")] }),
      changed("c", await subUsage(10), undefined, { dataChanged: false }),
      ...Array.from({ length: 4 }, (_, i): GuideResult => ({ id: `f${i}`, status: "failed", error: "HTTP 403" })),
    ];
    expect(reportJson(results, 1).digest).toBe("126 checked · 2 changed · 2 held · 4 failed · 4 calls · 412k tokens (~$1.39 at API rates) · $0.00 API");
  });

  it("names deferred guides only when there are some", () => {
    const results: GuideResult[] = [{ id: "a", status: "deferred" }];
    expect(reportJson(results, 0).digest).toBe("1 checked · 0 changed · 0 held · 0 failed · 1 deferred · 0 calls · 0 tokens (~$0.00 at API rates) · $0.00 API");
  });

  it("formats token counts with k and M", () => {
    expect([0, 999, 1_000, 411_600, 999_499, 999_500, 1_250_000, 12_000_000].map(formatTokens)).toEqual([
      "0", "999", "1k", "412k", "999k", "1.0M", "1.3M", "12.0M",
    ]);
  });
});

const sample = (over: Partial<ReportJson> = {}): ReportJson => ({
  ...reportJson([{ id: "a", status: "failed", error: `HTTP 403 ${"x".repeat(300)}` }], 1, { durationSec: 61 }),
  ...over,
});

describe("withFailure", () => {
  it("puts a failure after the refresh first among the alerts, and in the record", () => {
    const clean = reportJson([{ id: "a", status: "unchanged" }], 0);
    const failed = withFailure(clean, "push failed");
    expect(failed.alerts).toEqual([{ level: "high", text: "Refresh failed after the run: push failed" }]);
    expect(failed.digest).toBe(clean.digest);
    const rec = runRecord(failed, { scope: "local", finishedAt: new Date("2026-10-10T13:20:00Z"), exitCode: 1 });
    expect(rec.alerts).toEqual(failed.alerts);
    expect(rec.exitCode).toBe(1);
  });
});

describe("runRecord", () => {
  it("keeps the numbers and alerts, truncates errors, and adds where the run happened", () => {
    const rec = runRecord(sample(), { scope: "cloud", finishedAt: new Date("2026-10-10T13:20:00Z"), runUrl: "https://github.com/o/r/actions/runs/1", pr: "140" });
    expect(rec).toMatchObject({
      date: "2026-10-10", finishedAt: "2026-10-10T13:20:00.000Z", scope: "cloud", exitCode: 1, durationSec: 61,
      calls: { subscription: 0, api: 0 }, apiCost: 0, apiEquivalentCost: 0, apiFallbackCalls: 0, modelFailures: [], alerts: [],
      runUrl: "https://github.com/o/r/actions/runs/1", pr: "140",
    });
    expect(rec.failed[0].error).toHaveLength(200);
    expect(rec.counts?.failed).toBe(1);
    expect(Object.keys(rec)).not.toContain("review");
    expect(Object.keys(rec)).not.toContain("digest");
  });

  it("uses the Pacific day, and the exit code it is given over the result's", () => {
    const rec = runRecord(sample(), { scope: "local", finishedAt: new Date("2026-10-11T05:00:00Z"), exitCode: 2 });
    expect(rec.date).toBe("2026-10-10");
    expect(rec.exitCode).toBe(2);
    expect(rec).not.toHaveProperty("runUrl");
    expect(rec).not.toHaveProperty("pr");
  });

  it("records a crash with no result", () => {
    const rec = runRecord(null, { scope: "cloud", finishedAt: new Date("2026-10-10T13:20:00Z"), exitCode: 1 });
    expect(rec).toMatchObject({ crashed: true, exitCode: 1, alerts: [{ level: "high", text: "Refresh crashed before writing a result" }] });
  });
});

describe("readReport", () => {
  it("reads result.json, and returns null for a missing or broken file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-report-"));
    const good = path.join(dir, "result.json");
    fs.writeFileSync(good, JSON.stringify(sample()));
    expect(readReport(good)?.digest).toContain("1 checked");
    fs.writeFileSync(path.join(dir, "bad.json"), "{");
    expect(readReport(path.join(dir, "bad.json"))).toBeNull();
    fs.writeFileSync(path.join(dir, "old.json"), JSON.stringify({ exitCode: 0 }));
    expect(readReport(path.join(dir, "old.json"))).toBeNull();
    expect(readReport(path.join(dir, "missing.json"))).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
