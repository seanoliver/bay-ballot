import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type Anthropic from "@anthropic-ai/sdk";
import { loadElection, type ElectionData } from "@/lib/data";
import { EndorsementFile, type ArchivedSource, type Guide, type HeldPick } from "@/lib/schema";
import { diffPicks } from "./diff";
import { extract, pagesFor, toEntries, type ExtractClient, type Source } from "./extract";
import type { Fetched } from "./fetch";
import { pageGate, sourceSlug, storedText, type Gate } from "./pagestore";
import { checkHosts, fetchMode, sourcesFor } from "./sources";
import { applyVerdicts, verify, type VerifyOutput } from "./verify";
import { nextFile, shrinkWarning, toYaml } from "./write";

export type RefreshDeps = {
  client: ExtractClient;
  fetchSource: (url: string, opts: { browser?: boolean }) => Promise<Fetched>;
  archiveUrl?: (url: string) => Promise<string | null>;
  today: () => string;
  log?: (line: string) => void;
};

export type RefreshOptions = {
  root: string;
  election: string;
  ids?: string[];
  browser?: boolean;
  archive?: boolean;
  force?: boolean;
  forceExtract?: boolean;
  verify?: boolean;
  maxChanged?: number;
  shrunkSkip?: Record<string, string>;
};

type Usage = Anthropic.Messages.Usage;

export type GuideResult =
  | { id: string; status: "skipped"; reason: string }
  | { id: string; status: "unchanged" }
  | { id: string; status: "deferred" }
  | { id: string; status: "failed"; error: string }
  | { id: string; status: "shrunk"; message: string; notes: string[]; pageHash: string }
  | { id: string; status: "shrunk-skipped"; pageHash: string }
  | {
      id: string;
      status: "changed";
      dataChanged: boolean;
      diff: string[];
      notes: string[];
      held: HeldPick[];
      droppedByVerifier: number;
      missing: VerifyOutput["missing"];
      usage: { extract: Usage; verify?: Usage };
    };

// Compare as serialized data, so an explicit `undefined` key equals a missing one.
const plain = (f: EndorsementFile) => JSON.parse(JSON.stringify(f)) as unknown;
const sameFile = (a: EndorsementFile, b: EndorsementFile) => isDeepStrictEqual(plain(a), plain(b));

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const pagePath = (root: string, election: string, guide: string, url: string) =>
  path.join(root, election, "pages", guide, `${sourceSlug(url)}.txt`);

function readStored(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function writeStored(p: string, text: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (readStored(p) !== text) fs.writeFileSync(p, text);
}

type Fetchedpage = { source: Source; stored: string; path: string; gate: Gate };

async function refreshGuide(
  deps: RefreshDeps,
  opts: RefreshOptions,
  data: ElectionData,
  guide: Guide,
  budget: { left: number },
): Promise<GuideResult> {
  const log = deps.log ?? (() => {});
  const id = guide.id;
  const prev = data.endorsements[id];
  if (prev.manual) return { id, status: "skipped", reason: "manual" };
  const urls = sourcesFor(prev);
  if (urls.length === 0) return { id, status: "skipped", reason: "no source" };
  const hostProblems = checkHosts(guide, prev);
  if (hostProblems.length) return { id, status: "skipped", reason: `source host check: ${hostProblems.join("; ")}` };

  const browser = fetchMode(prev, Boolean(opts.browser)) === "browser";
  const pages: Fetchedpage[] = [];
  for (const url of urls) {
    const fetched = await deps.fetchSource(url, { browser });
    const p = pagePath(opts.root, opts.election, id, url);
    const stored = storedText(fetched, { ballot: data.ballot });
    pages.push({ source: { url, fetched }, stored, path: p, gate: pageGate(readStored(p), stored, data.ballot) });
  }

  const relevant = opts.forceExtract || pages.some((p) => p.gate === "new" || p.gate === "relevant");
  if (!relevant) {
    // Store the drift (dates, banners) so it never accumulates into a later diff.
    for (const p of pages) writeStored(p.path, p.stored);
    return { id, status: "unchanged" };
  }
  const pageHash = createHash("sha256").update(pages.map((p) => `${p.source.url}\n${p.stored}`).join("\n\0\n")).digest("hex");
  if (!opts.forceExtract && opts.shrunkSkip?.[id] === pageHash) return { id, status: "shrunk-skipped", pageHash };
  if (budget.left <= 0) return { id, status: "deferred" };
  budget.left--;

  const sources = pages.map((p) => p.source);
  const { output, usage } = await extract(deps.client, data.ballot, guide, sources);
  const { picks, notes } = toEntries(output, data.ballot.contests, pagesFor(sources), { ownNames: [guide.name] });
  const shrunk = shrinkWarning(id, prev.picks, picks, { force: opts.force });
  if (shrunk) return { id, status: "shrunk", message: shrunk.trim(), notes, pageHash };

  let archived: ArchivedSource[] | undefined;
  if (opts.archive && deps.archiveUrl) {
    const snaps: ArchivedSource[] = [];
    for (const url of urls) {
      const snapshot = await deps.archiveUrl(url);
      if (snapshot) snaps.push({ source: url, snapshot });
      else log(`${id}: warning: could not archive ${url}`);
    }
    if (snaps.length) archived = snaps;
  }

  let next = EndorsementFile.parse(nextFile(prev, picks, output.hasReasoning, deps.today(), archived));
  const result: Extract<GuideResult, { status: "changed" }> = {
    id,
    status: "changed",
    dataChanged: false,
    diff: diffPicks(prev.picks, next.picks),
    notes,
    held: [],
    droppedByVerifier: 0,
    missing: [],
    usage: { extract: usage },
  };

  if (opts.verify !== false && !isDeepStrictEqual(prev.picks, next.picks) && Object.keys(next.picks).length > 0) {
    const v = await verify(deps.client, data.ballot, guide, next, sources);
    const applied = applyVerdicts(next, v.output);
    next = EndorsementFile.parse(applied.file);
    result.held = applied.held;
    result.droppedByVerifier = applied.droppedQuotes.length;
    result.missing = applied.missing;
    result.notes = [
      ...notes,
      ...applied.droppedQuotes.map((d) => `${d.contestId}: verifier dropped quote (${d.reason}): "${d.text.slice(0, 80)}"`),
      ...applied.notes,
    ];
    result.usage.verify = v.usage;
    result.diff = diffPicks(prev.picks, next.picks);
  }

  result.dataChanged = !sameFile(prev, next);
  if (result.dataChanged) {
    const file = path.join(opts.root, opts.election, "endorsements", `${id}.yml`);
    fs.writeFileSync(file, toYaml(next, { previous: fs.readFileSync(file, "utf8") }));
  }
  for (const p of pages) writeStored(p.path, p.stored);
  return result;
}

export async function runRefresh(deps: RefreshDeps, opts: RefreshOptions): Promise<GuideResult[]> {
  const log = deps.log ?? (() => {});
  const data = loadElection(opts.root, opts.election);
  const ids = opts.ids ?? Object.keys(data.endorsements).sort();
  const budget = { left: opts.maxChanged ?? Infinity };
  const results: GuideResult[] = [];
  for (const id of ids) {
    const guide = data.guides.find((g) => g.id === id);
    let r: GuideResult;
    if (!guide || !data.endorsements[id]) r = { id, status: "failed", error: `no guide or endorsement file for '${id}'` };
    else {
      try {
        r = await refreshGuide(deps, opts, data, guide, budget);
      } catch (e) {
        r = { id, status: "failed", error: errMsg(e) };
      }
    }
    log(describe(r));
    results.push(r);
  }
  return results;
}

function describe(r: GuideResult): string {
  switch (r.status) {
    case "skipped":
      return `${r.id}: skipped (${r.reason})`;
    case "unchanged":
      return `${r.id}: unchanged (no relevant change)`;
    case "deferred":
      return `${r.id}: deferred (budget reached; picked up next run)`;
    case "failed":
      return `${r.id}: FAILED — ${r.error}`;
    case "shrunk":
      return [r.message, ...r.notes.map((n) => `  ! ${n}`)].join("\n");
    case "shrunk-skipped":
      return `${r.id}: shrunk earlier, pages unchanged since; not re-extracted`;
    case "changed":
      return [
        `${r.id}: ${r.dataChanged ? "changed" : "re-extracted, no data change"}`,
        ...r.diff.map((l) => `  ${l}`),
        ...r.held.map((h) => `  !! HELD ${h.contestId}: ${showPick(h.pick)} — ${h.reason}: ${h.evidence}`),
        ...r.notes.map((n) => `${n.includes("PICK DROPPED") ? "  !! " : "  ! "}${n}`),
      ].join("\n");
  }
}

const showPick = (p: HeldPick["pick"]) => (Array.isArray(p) ? p.join(" / ") : p);

const RATES = {
  extract: { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  verify: { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 },
};

function usageCost(u: Usage | undefined, r: (typeof RATES)["extract"]): number {
  if (!u) return 0;
  return (
    (u.input_tokens * r.in + u.output_tokens * r.out + (u.cache_creation_input_tokens ?? 0) * r.cacheWrite + (u.cache_read_input_tokens ?? 0) * r.cacheRead) /
    1e6
  );
}

export function costOf(results: GuideResult[]): number {
  return results.reduce(
    (sum, r) => (r.status === "changed" ? sum + usageCost(r.usage.extract, RATES.extract) + usageCost(r.usage.verify, RATES.verify) : sum),
    0,
  );
}

export function exitCodeFor(results: GuideResult[]): 0 | 1 | 2 {
  if (results.some((r) => r.status === "failed")) return 1;
  if (results.some((r) => r.status === "shrunk" || r.status === "shrunk-skipped" || (r.status === "changed" && r.held.length > 0))) return 2;
  return 0;
}

export function summarize(results: GuideResult[], { date }: { date: string }): string {
  const by = (s: GuideResult["status"]) => results.filter((r) => r.status === s);
  const changed = by("changed") as Extract<GuideResult, { status: "changed" }>[];
  const held = changed.reduce((n, r) => n + r.held.length, 0);
  const code = exitCodeFor(results);
  const verdict = code === 1 ? "errors" : code === 2 ? `needs review (${held} held)` : "clean";
  const lines = [
    `# Data refresh ${date}`,
    "",
    `**Result:** ${verdict}`,
    "",
    `| checked | unchanged | re-extracted | data changed | deferred | skipped | failed |`,
    `|---|---|---|---|---|---|---|`,
    `| ${results.length} | ${by("unchanged").length} | ${changed.length} | ${changed.filter((r) => r.dataChanged).length} | ${by("deferred").length} | ${by("skipped").length} | ${by("failed").length + by("shrunk").length + by("shrunk-skipped").length} |`,
    "",
    `Estimated model cost: $${costOf(results).toFixed(2)}`,
  ];
  if (changed.length) {
    lines.push("", "## Re-extracted");
    for (const r of changed) {
      lines.push("", `### ${r.id}`, r.dataChanged ? "" : "_Pages changed; extracted data is the same._");
      for (const d of r.diff) lines.push(`- ${d}`);
      for (const h of r.held) lines.push(`- **HELD ${h.contestId}: ${showPick(h.pick)} — ${h.reason}: ${h.evidence}**`);
      if (r.droppedByVerifier) lines.push(`- verifier dropped ${r.droppedByVerifier} quote(s)`);
      for (const m of r.missing) lines.push(`- missing (reported only) ${m.contestId}: ${m.pick} — ${m.evidence}`);
    }
  }
  const problems = [...by("failed"), ...by("shrunk"), ...by("shrunk-skipped")];
  if (problems.length) {
    lines.push("", "## Needs attention");
    for (const r of problems) lines.push(`- ${describe(r).split("\n")[0].replace(/^\s*!!\s*/, "")}`);
  }
  const deferred = by("deferred").map((r) => r.id);
  if (deferred.length) lines.push("", `Deferred (budget): ${deferred.join(", ")} — picked up by the next run.`);
  const unchanged = by("unchanged").map((r) => r.id);
  if (unchanged.length) lines.push("", `Unchanged: ${unchanged.join(", ")}`);
  const skipped = by("skipped") as Extract<GuideResult, { status: "skipped" }>[];
  if (skipped.length) lines.push("", `Skipped: ${skipped.map((r) => `${r.id} (${r.reason})`).join(", ")}`);
  return lines.join("\n") + "\n";
}

export async function seedPages(
  deps: RefreshDeps,
  opts: Pick<RefreshOptions, "root" | "election" | "ids" | "browser">,
): Promise<{ id: string; stored: number; error?: string }[]> {
  const data = loadElection(opts.root, opts.election);
  const out: { id: string; stored: number; error?: string }[] = [];
  for (const id of opts.ids ?? Object.keys(data.endorsements).sort()) {
    const file = data.endorsements[id];
    if (!file || file.manual || sourcesFor(file).length === 0) continue;
    const browser = fetchMode(file, Boolean(opts.browser)) === "browser";
    let stored = 0;
    try {
      for (const url of sourcesFor(file)) {
        writeStored(pagePath(opts.root, opts.election, id, url), storedText(await deps.fetchSource(url, { browser }), { ballot: data.ballot }));
        stored++;
      }
      out.push({ id, stored });
    } catch (e) {
      out.push({ id, stored, error: errMsg(e) });
    }
    deps.log?.(`${id}: stored ${stored} page(s)${out.at(-1)?.error ? ` — FAILED: ${out.at(-1)?.error}` : ""}`);
  }
  return out;
}

export type ResultJson = {
  exitCode: number;
  extracted: string[];
  deferred: string[];
  failed: { id: string; error: string }[];
  shrunk: { id: string; pageHash: string }[];
};

export function resultJson(results: GuideResult[], exitCode: number): ResultJson {
  return {
    exitCode,
    extracted: results.filter((r) => r.status === "changed").map((r) => r.id),
    deferred: results.filter((r) => r.status === "deferred").map((r) => r.id),
    failed: results.flatMap((r) => (r.status === "failed" ? [{ id: r.id, error: r.error }] : [])),
    shrunk: results.flatMap((r) => (r.status === "shrunk" || r.status === "shrunk-skipped" ? [{ id: r.id, pageHash: r.pageHash }] : [])),
  };
}
