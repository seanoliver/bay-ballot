import fs from "node:fs";
import { pacificDay } from "@/lib/changelog";
import { apiEquivalentCost, modelUsages, resultJson, subscriptionCalls, type GuideResult, type ResultJson } from "./refresh";
import { onSubscription } from "./claudecode";

export type Alert = { level: "high" | "review"; text: string };

export type RunCounts = {
  checked: number;
  unchanged: number;
  extracted: number;
  dataChanged: number;
  deferred: number;
  skipped: number;
  failed: number;
  shrunk: number;
  held: number;
  review: number;
};

export type RunTokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type ReportJson = ResultJson & {
  durationSec: number;
  counts: RunCounts;
  calls: { subscription: number; api: number };
  tokens: RunTokens;
  apiEquivalentCost: number;
  modelFailures: string[];
  digest: string;
  alerts: Alert[];
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatTokens(n: number): string {
  if (n >= 999_500) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function counts(results: GuideResult[], review: number): RunCounts {
  const n = (...s: GuideResult["status"][]) => results.filter((r) => s.includes(r.status)).length;
  const changed = results.filter((r) => r.status === "changed");
  return {
    checked: results.length,
    unchanged: n("unchanged"),
    extracted: changed.length,
    dataChanged: changed.filter((r) => r.dataChanged).length,
    deferred: n("deferred"),
    skipped: n("skipped"),
    failed: n("failed"),
    shrunk: n("shrunk", "shrunk-skipped"),
    held: changed.reduce((sum, r) => sum + r.held.length, 0),
    review,
  };
}

function tokens(results: GuideResult[]): RunTokens {
  const t = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const { usage: u } of modelUsages(results)) {
    t.input += u.input_tokens;
    t.output += u.output_tokens;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
  }
  return t;
}

const modelReason = (error: string) => error.replace(/^claude-code /, "").split(" (")[0];

function alerts(results: GuideResult[], r: Omit<ReportJson, "digest" | "alerts">): Alert[] {
  const out: Alert[] = [];
  if (r.apiCost > 0 || r.apiFallbackCalls > 0) out.push({ level: "high", text: `Used the API: ${plural(r.calls.api, "call")}, about $${r.apiCost.toFixed(2)}` });
  if (r.modelFailures.length) {
    const errors = r.failed.filter((f) => r.modelFailures.includes(f.id)).map((f) => modelReason(f.error));
    const expired = r.counts.extracted === 0 && results.every((g) => g.status !== "shrunk") && errors.every((e) => e === "not logged in");
    out.push({
      level: "high",
      text: `${plural(r.modelFailures.length, "guide")} failed in Claude Code: ${errors[0]}${expired ? "; the subscription token likely expired" : ""}`,
    });
  }
  if (r.review.length) out.push({ level: "review", text: `${plural(r.review.length, "item")} need${r.review.length === 1 ? "s" : ""} review` });
  return out;
}

function digest(r: Omit<ReportJson, "digest" | "alerts">): string {
  const c = r.counts;
  const t = r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite;
  return [
    `${c.checked} checked`,
    `${c.dataChanged} changed`,
    `${c.held} held`,
    `${c.failed} failed`,
    ...(c.deferred ? [`${c.deferred} deferred`] : []),
    plural(r.calls.subscription + r.calls.api, "call"),
    `${formatTokens(t)} tokens (~$${r.apiEquivalentCost.toFixed(2)} at API rates)`,
    `$${r.apiCost.toFixed(2)} API`,
  ].join(" · ");
}

export function reportJson(
  results: GuideResult[],
  exitCode: number,
  { apiFallbackCalls = 0, durationSec = 0 }: { apiFallbackCalls?: number; durationSec?: number } = {},
): ReportJson {
  const base = resultJson(results, exitCode, { apiFallbackCalls });
  const priced = modelUsages(results).filter(({ usage }) => !onSubscription(usage)).length;
  const report = {
    ...base,
    durationSec,
    counts: counts(results, base.review.length),
    // Past the usage limit every API call is in apiFallbackCalls, and its usage is priced too; on --via api only the usage counts.
    calls: { subscription: subscriptionCalls(results), api: Math.max(priced, apiFallbackCalls) },
    tokens: tokens(results),
    apiEquivalentCost: apiEquivalentCost(results),
    modelFailures: base.failed.filter((f) => f.error.startsWith("claude-code")).map((f) => f.id),
  };
  return { ...report, digest: digest(report), alerts: alerts(results, report) };
}

export function readReport(file: string): ReportJson | null {
  try {
    const r = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ReportJson>;
    return typeof r.digest === "string" && Array.isArray(r.alerts) ? (r as ReportJson) : null;
  } catch {
    return null;
  }
}

export const CRASHED = "Refresh crashed before writing a result";

/** The job failed after the refresh wrote its result (a push, PR or issue step), so the result alone looks fine. */
export const withFailure = (report: ReportJson, reason: string): ReportJson => ({
  ...report,
  alerts: [{ level: "high", text: `Refresh failed after the run: ${reason}` }, ...report.alerts],
});

/** One line of runs.ndjson on the `runs` branch. Counts and short errors only: no page text or quotes. */
export type RunRecord = {
  date: string;
  finishedAt: string;
  scope: "cloud" | "local";
  exitCode: number | null;
  crashed?: true;
  durationSec?: number;
  counts?: RunCounts;
  calls?: ReportJson["calls"];
  tokens?: RunTokens;
  apiCost?: number;
  apiEquivalentCost?: number;
  apiFallbackCalls?: number;
  failed: { id: string; error: string }[];
  modelFailures: string[];
  alerts: Alert[];
  runUrl?: string;
  pr?: string;
};

export function runRecord(
  report: ReportJson | null,
  { scope, finishedAt, exitCode, runUrl, pr }: { scope: "cloud" | "local"; finishedAt: Date; exitCode?: number; runUrl?: string; pr?: string },
): RunRecord {
  const where = { ...(runUrl ? { runUrl } : {}), ...(pr ? { pr } : {}) };
  const when = { date: pacificDay(finishedAt), finishedAt: finishedAt.toISOString(), scope };
  if (!report) return { ...when, exitCode: exitCode ?? null, crashed: true, failed: [], modelFailures: [], alerts: [{ level: "high", text: CRASHED }], ...where };
  return {
    ...when,
    exitCode: exitCode ?? report.exitCode,
    durationSec: report.durationSec,
    counts: report.counts,
    calls: report.calls,
    tokens: report.tokens,
    apiCost: report.apiCost,
    apiEquivalentCost: report.apiEquivalentCost,
    apiFallbackCalls: report.apiFallbackCalls,
    failed: report.failed.map((f) => ({ id: f.id, error: f.error.slice(0, 200) })),
    modelFailures: report.modelFailures,
    alerts: report.alerts,
    ...where,
  };
}
