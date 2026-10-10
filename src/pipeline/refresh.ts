import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type Anthropic from "@anthropic-ai/sdk";
import { loadElection, type ElectionData } from "@/lib/data";
import { EndorsementFile, type ArchivedSource, type Ballot, type Guide, type HeldPick } from "@/lib/schema";
import { guideChangelogEntry, writeRefreshEntry } from "./changelog";
import { diffPicks } from "./diff";
import { extract, pagesFor, toEntries, type ExtractClient, type Source } from "./extract";
import type { Fetched } from "./fetch";
import { isPdfDigest, pageGate, relevantChange, sourceSlug, storedText, type Gate } from "./pagestore";
import { checkHosts, fetchMode, sourcesFor } from "./sources";
import { applyVerdicts, auditPart, verify, withAudited, type VerifyOutput } from "./verify";
import { guideBallot, newAreaBallot, unknownAreaError } from "./scope";
import { nextFile, scopedNextFile, shrinkWarning, toYaml } from "./write";

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
  baseline?: string;
  scope?: "cloud" | "local";
  gateOnly?: boolean;
  onlyAreas?: string[];
};

type Usage = Anthropic.Messages.Usage;

export type GuideResult =
  | { id: string; status: "skipped"; reason: string }
  | { id: string; status: "unchanged" }
  | { id: string; status: "deferred" }
  | { id: string; status: "would-extract" }
  | { id: string; status: "failed"; error: string }
  | { id: string; status: "shrunk"; message: string; notes: string[]; pageHash: string; usage: Usage }
  | { id: string; status: "shrunk-skipped"; pageHash: string }
  | {
      id: string;
      status: "changed";
      dataChanged: boolean;
      diff: string[];
      notes: string[];
      held: HeldPick[];
      /** Unclear-match holds whose contest the guide now picks differently. */
      unclear?: string[];
      droppedByVerifier: number;
      missing: VerifyOutput["missing"];
      warnings?: string[];
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

const NOT_STORED = "page text not stored, so the next refresh re-extracts the whole guide";

function changedOutside(url: string, old: string | null, fresh: string, outside: Ballot, guideAreas: string[], only: string[]): string | undefined {
  if (old !== null) return pageGate(old, fresh, outside) === "relevant" ? `${url}: page changed outside ${only.join(", ")}; ${NOT_STORED}` : undefined;
  if (isPdfDigest(fresh)) return `new page ${url} is a PDF without text; ${NOT_STORED}`;
  const others = guideAreas.filter((a) => !only.includes(a)).join(", ");
  return relevantChange("", fresh, outside) ? `new page ${url} also covers ${others}; ${NOT_STORED}` : undefined;
}

type Fetchedpage = { source: Source; stored: string; path: string; gate: Gate; outsideWarning?: string };

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
  const ballot = guideBallot(data.ballot, guide, data.areas);
  const scoped = opts.onlyAreas ? newAreaBallot(ballot, guide, data.areas, opts.onlyAreas) : null;
  const scopeIds = new Set((scoped ?? ballot).contests.map((c) => c.id));
  const inScope = (contestId: string) => !scoped || scopeIds.has(contestId);
  const forceExtract = opts.forceExtract || Boolean(scoped);
  const outside = scoped ? { ...ballot, contests: ballot.contests.filter((c) => !inScope(c.id)) } : null;
  if (prev.manual) return { id, status: "skipped", reason: "manual" };
  if (prev.fetchFrom === "local" && opts.scope === "cloud") return { id, status: "skipped", reason: "local only" };
  const urls = sourcesFor(prev);
  if (urls.length === 0) return { id, status: "skipped", reason: "no source" };
  if (scoped?.contests.length === 0) return { id, status: "skipped", reason: `no contests new to ${opts.onlyAreas?.join(", ")}` };
  const hostProblems = checkHosts(guide, prev);
  if (hostProblems.length) return { id, status: "skipped", reason: `source host check: ${hostProblems.join("; ")}` };

  const browser = fetchMode(prev, Boolean(opts.browser)) === "browser";
  const pages: Fetchedpage[] = [];
  for (const url of urls) {
    const fetched = await deps.fetchSource(url, { browser });
    const p = pagePath(opts.root, opts.election, id, url);
    const stored = storedText(fetched, { ballot });
    const old = readStored(p);
    const outsideWarning = outside ? changedOutside(url, old, stored, outside, guide.areas, opts.onlyAreas ?? []) : undefined;
    pages.push({ source: { url, fetched }, stored, path: p, gate: pageGate(old, stored, ballot), outsideWarning });
  }

  const relevant = forceExtract || pages.some((p) => p.gate === "new" || p.gate === "relevant");
  if (!relevant) {
    // Store the drift (dates, banners) so it never accumulates into a later diff.
    for (const p of pages) writeStored(p.path, p.stored);
    return { id, status: "unchanged" };
  }
  const pageHash = createHash("sha256").update(pages.map((p) => `${p.source.url}\n${p.stored}`).join("\n\0\n")).digest("hex");
  if (!forceExtract && opts.shrunkSkip?.[id] === pageHash) return { id, status: "shrunk-skipped", pageHash };
  if (opts.gateOnly) return { id, status: "would-extract" };
  if (budget.left <= 0) return { id, status: "deferred" };
  budget.left--;

  const sources = pages.map((p) => p.source);
  const { output, usage } = await extract(deps.client, ballot, guide, sources);
  const entries = toEntries(output, ballot.contests, pagesFor(sources), { ownNames: [guide.name] });
  const picks = Object.fromEntries(Object.entries(entries.picks).filter(([c]) => inScope(c)));
  const outOfScope = new Set(ballot.contests.filter((c) => !inScope(c.id)).map((c) => c.id));
  const notes = entries.notes.filter((n) => !outOfScope.has(n.split(":")[0]));
  const prevInScope = Object.fromEntries(Object.entries(prev.picks).filter(([c]) => inScope(c)));
  const shrunk = shrinkWarning(id, prevInScope, picks, { force: opts.force });
  if (shrunk) return { id, status: "shrunk", message: shrunk.trim(), notes, pageHash, usage };

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

  const unclear = (prev.held ?? []).flatMap((h) =>
    h.reason === "unclear-match" && inScope(h.contestId) && picks[h.contestId] && !isDeepStrictEqual(picks[h.contestId].pick, h.pick)
      ? [`${h.contestId}: held ${showPick(h.pick)}, guide now picks ${showPick(picks[h.contestId].pick)}`]
      : [],
  );
  let next = EndorsementFile.parse(
    scoped ? scopedNextFile(prev, picks, inScope, deps.today(), archived) : nextFile(prev, picks, output.hasReasoning, deps.today(), archived),
  );
  const result: Extract<GuideResult, { status: "changed" }> = {
    id,
    status: "changed",
    dataChanged: false,
    diff: diffPicks(prev.picks, next.picks),
    notes,
    held: [],
    ...(unclear.length ? { unclear } : {}),
    droppedByVerifier: 0,
    missing: [],
    usage: { extract: usage },
    warnings: pages.flatMap((p) => (p.outsideWarning ? [p.outsideWarning] : [])),
  };

  const hasHeld = (next.held ?? []).some((h) => h.reason !== "unclear-match" && inScope(h.contestId));
  const changedIds = Object.keys(next.picks).filter((c) => inScope(c) && !isDeepStrictEqual(prev.picks[c], next.picks[c]));
  const picksChanged = scoped ? changedIds.length > 0 : !isDeepStrictEqual(prev.picks, next.picks) && Object.keys(next.picks).length > 0;
  if (opts.verify !== false && (picksChanged || hasHeld)) {
    const audited = scoped ? auditPart(next, changedIds, inScope) : next;
    const v = await verify(deps.client, ballot, guide, audited, sources);
    const applied = applyVerdicts(audited, v.output);
    next = EndorsementFile.parse(scoped ? withAudited(next, applied.file, changedIds, inScope) : applied.file);
    result.held = applied.held;
    result.droppedByVerifier = applied.droppedQuotes.length;
    const picked = (c: string) => c in next.picks || (next.held ?? []).some((h) => h.contestId === c);
    result.missing = applied.missing.filter((m) => inScope(m.contestId) && !picked(m.contestId));
    result.notes = [
      ...notes,
      ...applied.droppedQuotes.map((d) => `${d.contestId}: verifier dropped quote (${d.reason}): "${d.text.slice(0, 80)}"`),
      ...applied.notes,
    ];
    result.usage.verify = v.usage;
    result.diff = diffPicks(prev.picks, next.picks);
  }

  if (scoped && !Object.keys(next.picks).some(inScope) && !(next.held ?? []).some((h) => inScope(h.contestId))) {
    result.warnings?.push(`no endorsements found for ${opts.onlyAreas?.join(", ")}`);
  }
  result.dataChanged = !sameFile(prev, next);
  if (result.dataChanged) {
    const file = path.join(opts.root, opts.election, "endorsements", `${id}.yml`);
    fs.writeFileSync(file, toYaml(next, { previous: fs.readFileSync(file, "utf8") }));
  }
  for (const p of pages) if (!p.outsideWarning) writeStored(p.path, p.stored);
  return result;
}

export async function runRefresh(deps: RefreshDeps, opts: RefreshOptions): Promise<GuideResult[]> {
  const baseline = opts.baseline ? loadBaseline(opts.baseline, opts.election) : null;
  const log = deps.log ?? (() => {});
  const data = loadElection(opts.root, opts.election);
  const ids = (opts.ids ?? Object.keys(data.endorsements).sort()).filter(
    (id) => opts.scope !== "local" || data.endorsements[id]?.fetchFrom === "local",
  );
  const budget = { left: opts.maxChanged ?? Infinity };
  const unknown = opts.onlyAreas && unknownAreaError(data.areas, opts.onlyAreas);
  if (unknown) throw new Error(unknown);
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
  if (baseline) writeChangelog(deps, opts, baseline, results);
  return results;
}

type Baseline = { data: ElectionData; keep: Set<string> };

function loadBaseline(dir: string, election: string): Baseline {
  if (!fs.existsSync(path.join(dir, election))) throw new Error(`baseline ${dir} has no ${election}/ data`);
  const changelog = path.join(dir, "changelog");
  return { data: loadElection(dir, election), keep: new Set(fs.existsSync(changelog) ? fs.readdirSync(changelog) : []) };
}

function writeChangelog(deps: RefreshDeps, opts: RefreshOptions, main: Baseline, results: GuideResult[]): void {
  const changed = results.filter((r) => r.status === "changed" && r.dataChanged).map((r) => r.id);
  if (changed.length === 0) return;
  const after = loadElection(opts.root, opts.election);
  const dir = path.join(opts.root, "changelog");
  for (const id of changed) {
    const guide = after.guides.find((g) => g.id === id);
    const before = main.data.endorsements[id];
    if (!guide || !before) continue;
    const entry = guideChangelogEntry({ guideName: guide.name, before, after: after.endorsements[id], contests: after.ballot.contests, date: deps.today() });
    writeRefreshEntry(dir, id, entry, { date: deps.today(), keep: main.keep });
  }
}

function describe(r: GuideResult): string {
  switch (r.status) {
    case "skipped":
      return `${r.id}: skipped (${r.reason})`;
    case "unchanged":
      return `${r.id}: unchanged (no relevant change)`;
    case "deferred":
      return `${r.id}: deferred (budget reached; picked up next run)`;
    case "would-extract":
      return `${r.id}: would extract (dry run; pages changed)`;
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
        ...(r.warnings ?? []).map((w) => `  !! ${w}`),
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
    (sum, r) =>
      r.status === "changed"
        ? sum + usageCost(r.usage.extract, RATES.extract) + usageCost(r.usage.verify, RATES.verify)
        : r.status === "shrunk"
          ? sum + usageCost(r.usage, RATES.extract)
          : sum,
    0,
  );
}

export function exitCodeFor(results: GuideResult[]): 0 | 1 | 2 {
  if (results.some((r) => r.status === "failed")) return 1;
  if (results.some((r) => r.status === "shrunk" || r.status === "shrunk-skipped" || (r.status === "changed" && r.held.length > 0))) return 2;
  return 0;
}

export function summarize(results: GuideResult[], { date, dryRun = false }: { date: string; dryRun?: boolean }): string {
  const by = (s: GuideResult["status"]) => results.filter((r) => r.status === s);
  const changed = by("changed") as Extract<GuideResult, { status: "changed" }>[];
  const held = changed.reduce((n, r) => n + r.held.length, 0);
  const code = exitCodeFor(results);
  const would = by("would-extract").length;
  const isDryRun = dryRun || would > 0;
  const verdict =
    code === 1 ? "errors"
    : code === 2 ? `needs review (${held} held)`
    : isDryRun ? `dry run; ${would === 0 ? "no guide" : `${would} guide${would === 1 ? "" : "s"}`} would be extracted`
    : "clean";
  const lines = [
    `# Data refresh ${date}${isDryRun ? " (dry run)" : ""}`,
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
      for (const w of r.warnings ?? []) lines.push(`- **${w}**`);
      if (r.droppedByVerifier) lines.push(`- verifier dropped ${r.droppedByVerifier} quote(s)`);
      for (const m of r.missing) lines.push(`- missing (reported only) ${m.contestId}: ${m.pick} — ${m.evidence}`);
    }
  }
  const problems = [...by("failed"), ...by("shrunk"), ...by("shrunk-skipped")];
  if (problems.length) {
    lines.push("", "## Needs attention");
    for (const r of problems) lines.push(`- ${describe(r).split("\n")[0].replace(/^\s*!!\s*/, "")}`);
  }
  const wouldExtract = by("would-extract").map((r) => r.id);
  if (wouldExtract.length) lines.push("", `Would extract (dry run): ${wouldExtract.join(", ")}`);
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
    const guide = data.guides.find((g) => g.id === id);
    const ballot = guide ? guideBallot(data.ballot, guide, data.areas) : data.ballot;
    const browser = fetchMode(file, Boolean(opts.browser)) === "browser";
    let stored = 0;
    try {
      for (const url of sourcesFor(file)) {
        writeStored(pagePath(opts.root, opts.election, id, url), storedText(await deps.fetchSource(url, { browser }), { ballot }));
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
  review: string[];
};

/** What a person must look at before this refresh merges, independent of the exit code. */
export function reviewReasons(results: GuideResult[]): string[] {
  return results.flatMap((r) => {
    if (r.status === "shrunk" || r.status === "shrunk-skipped") return [`${r.id}: picks shrank; file left unchanged`];
    if (r.status !== "changed") return [];
    const held = new Set(r.held.map((h) => h.contestId));
    return [
      ...r.held.map((h) => `${r.id}: held ${h.contestId} (${h.reason})`),
      ...(r.unclear ?? []).map((e) => `${r.id}: unclear-match hold on ${e}`),
      ...r.diff
        .filter((d) => d.startsWith("- "))
        .map((d) => d.slice(2).split(":")[0])
        .filter((id) => !held.has(id))
        .map((id) => `${r.id}: removed ${id}`),
      ...r.missing.map((m) => `${r.id}: verifier found ${m.contestId} on the page but not in the picks`),
    ];
  });
}

export function resultJson(results: GuideResult[], exitCode: number): ResultJson {
  return {
    exitCode,
    extracted: results.filter((r) => r.status === "changed").map((r) => r.id),
    deferred: results.filter((r) => r.status === "deferred").map((r) => r.id),
    failed: results.flatMap((r) => (r.status === "failed" ? [{ id: r.id, error: r.error }] : [])),
    shrunk: results.flatMap((r) => (r.status === "shrunk" || r.status === "shrunk-skipped" ? [{ id: r.id, pageHash: r.pageHash }] : [])),
    review: reviewReasons(results),
  };
}
