import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pacificDay } from "../src/lib/changelog";
import { loadElection, validateElection, type ElectionData } from "../src/lib/data";
import { EndorsementFile, type Guide } from "../src/lib/schema";
import { archiveUrl } from "../src/pipeline/archive";
import { claudeCodeClient, modelVia } from "../src/pipeline/claudecode";
import type { ExtractClient, Source } from "../src/pipeline/extract";
import { fetchSource } from "../src/pipeline/fetch";
import { fetchCheck, formatFetchCheck } from "../src/pipeline/fetchcheck";
import { makeClient, resolveApiKey } from "../src/pipeline/key";
import { checkHosts, fetchMode, sourcesFor } from "../src/pipeline/sources";
import { buildReviewModel, renderReviewHtml } from "../src/pipeline/review";
import { toYaml } from "../src/pipeline/write";
import { costText, exitCodeFor, runRefresh, seedPages, summarize, type GuideResult, type RefreshDeps } from "../src/pipeline/refresh";
import { notify } from "../src/pipeline/notify";
import { readReport, reportJson, runRecord } from "../src/pipeline/report";
import { applyVerdicts, verify } from "../src/pipeline/verify";
import { badFlag } from "../src/pipeline/args";
import { guideBallot, newAreaBallot, unknownAreaError } from "../src/pipeline/scope";
import { parse as parseYaml } from "yaml";

const ROOT = path.join(process.cwd(), "data");
const ELECTION = process.env.BB_ELECTION ?? "2026-11";
const USAGE = `usage: npm run bb -- extract <guide...> | --all [--browser] [--archive] [--force] [--force-extract] [--no-verify]
                                              [--only-areas <area[,area...]>] [--via claude-code|api] [--no-fallback]
       npm run bb -- refresh [--summary <file.md>] [--result <file.json>] [--shrunk-state <file.json>] [--baseline <data dir>] [--archive]
                             [--local-only] [--no-extract] [--via claude-code|api] [--no-fallback]
       npm run bb -- verify <guide...> | --all [--browser] [--via claude-code|api] [--no-fallback]
       npm run bb -- pages --seed [<guide...>]
       npm run bb -- fetch-check <guide...> | --all [--browser]   (fetch only; prints what came back, writes nothing)
       npm run bb -- discover
       npm run bb -- check
       npm run bb -- review [--no-open]
       npm run bb -- notify --scope cloud|local [--result <file.json>] [--click <url>] [--crashed] [--conflict]
                            [--record <file.json>] [--run-url <url>] [--pr <number>] [--exit-code <n>]

extract and refresh fetch each guide's pages and compare them with the stored page text
(data/<election>/pages). Guides whose pages changed only in dates, banners or other text
that names no contest are skipped with no model call; --force-extract re-extracts anyway.
refresh checks every guide, extracts at most 20 changed guides, validates, and exits
0 (clean), 2 (something held or needs review) or 1 (error). Guides marked fetchFrom: local
(their sites block GitHub's runners) are skipped unless --local-only, which refreshes only
them. --no-extract fetches and gates pages but makes no model calls and stores nothing new
for changed guides. pages --seed stores today's page text without extracting.

extract rewrites each guide's picks from its pages, overwriting hand edits to picks
(mark hand-entered guides with 'manual: true' to skip them). --force accepts a result
that empties or more than halves the previous picks. Unless --no-verify, extract then
runs verify on each guide whose picks or quotes changed.

extract --only-areas marin[,contra-costa] is for widening a guide's areas: it always
extracts, but only the contests those areas add to the guide's ballot, and verifies only
the picks that changed there. Every other pick, quote and hold in the file stays as it is.
Each area must exist and be in the guide's areas, and the guide must have another area; with
--all, only guides that list them and another area run.

notify sends the run's phone push through ntfy (topic in BAYBALLOT_NTFY_TOPIC; none set means
no push) and, with --record, writes the run's line for the runs branch. It always exits 0
once its options are valid; see "Run reports and alerts" in docs/runbook.md.

verify has a separate model audit each guide's picks and quotes against its pages.
Unconfirmed picks move to 'held' (not published) and unconfirmed quotes are dropped;
the command exits non-zero when anything is held.

Model calls go through Claude Code on Sean's personal subscription (CLAUDE_CONFIG_DIR
~/.claude-personal, or BAYBALLOT_CLAUDE_CONFIG_DIR; in CI, the BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN
token). When the subscription's usage limit is reached, the rest of the run uses the API key
in .env.local, unless --no-fallback; any other Claude Code failure fails the call. --via api
(or BAYBALLOT_MODEL_VIA=api) uses the API for every call.`;

const [cmd, ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const VALUE_OPTIONS = [
  "--summary", "--result", "--shrunk-state", "--baseline", "--only-areas", "--via",
  "--scope", "--click", "--record", "--run-url", "--pr", "--exit-code",
];
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const positional = () => args.filter((a, i) => !a.startsWith("--") && !VALUE_OPTIONS.includes(args[i - 1]));
const REFRESH_BUDGET = 20;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const today = () => pacificDay();
const endorsementPath = (id: string) => path.join(ROOT, ELECTION, "endorsements", `${id}.yml`);


type Totals = { guides: number; confirmed: number; held: number; quotes: number; missing: number; tokens: number[] };
const totals: Totals = { guides: 0, confirmed: 0, held: 0, quotes: 0, missing: 0, tokens: [0, 0, 0, 0] };

const apiClient = () => makeClient(resolveApiKey(".env.local"));
/** Calls the subscription client sent to the API past its usage limit; result.json reports it so the run can alert. */
let apiFallbackCalls = () => 0;

function modelClient(): ExtractClient {
  if (args.some((a) => a.startsWith("--via=")) || (flag("--via") && !option("--via"))) throw new Error("use --via api or --via claude-code");
  if (modelVia(option("--via"), process.env.BAYBALLOT_MODEL_VIA) === "api") return apiClient();
  console.log(`Model calls go through Claude Code on the subscription${flag("--no-fallback") ? " (no API fallback)" : ", using the API only if its usage limit is reached"}.`);
  // CI sets the marker path so it can alert even if the job is killed before result.json is written.
  const marker = process.env.BAYBALLOT_FALLBACK_MARKER;
  const client = claudeCodeClient({
    fallback: flag("--no-fallback") ? null : apiClient,
    onFallback: marker ? () => fs.writeFileSync(marker, `${new Date().toISOString()}\n`) : undefined,
  });
  apiFallbackCalls = client.apiCalls;
  return client;
}

async function fetchAll(guideId: string, file: EndorsementFile): Promise<Source[]> {
  const browser = fetchMode(file, flag("--browser")) === "browser";
  const sources: Source[] = [];
  for (const url of sourcesFor(file)) {
    const fetched = await fetchSource(url, { browser });
    if (fetched.kind === "pdf" && fetched.text.trim() === "") {
      console.warn(`${guideId}: warning: no text extracted from PDF ${url}; quotes from it will drop`);
    }
    sources.push({ url, fetched });
  }
  return sources;
}

async function verifyAndWrite(client: ExtractClient, data: ElectionData, guide: Guide, file: EndorsementFile, sources: Source[]): Promise<void> {
  const { output, usage } = await verify(client, guideBallot(data.ballot, guide, data.areas), guide, file, sources);
  const applied = applyVerdicts(file, output);
  // Held contests are asked about only when the verifier sees them, so it may report an unclear-match hold as missing.
  const isHeld = new Set((applied.file.held ?? []).map((h) => h.contestId));
  const r = { ...applied, missing: applied.missing.filter((m) => !isHeld.has(m.contestId)) };
  const path_ = endorsementPath(guide.id);
  if (!isDeepStrictEqual(r.file, file)) fs.writeFileSync(path_, toYaml(EndorsementFile.parse(r.file), { previous: fs.readFileSync(path_, "utf8") }));

  const u = [usage.cache_read_input_tokens ?? 0, usage.cache_creation_input_tokens ?? 0, usage.input_tokens, usage.output_tokens];
  totals.guides++;
  totals.confirmed += r.confirmed;
  totals.held += r.held.length;
  totals.quotes += r.droppedQuotes.length;
  totals.missing += r.missing.length;
  u.forEach((n, i) => (totals.tokens[i] += n));
  if (r.held.length) process.exitCode = 1;

  console.log(
    `${guide.id}: verify ${r.confirmed} confirmed, ${r.held.length} held, ${r.droppedQuotes.length} quotes dropped, ${r.missing.length} missing  (cache_read=${u[0]} cache_write=${u[1]} in=${u[2]} out=${u[3]})`,
  );
  for (const h of r.held) console.log(`  !! HELD ${h.contestId}: ${Array.isArray(h.pick) ? h.pick.join(" / ") : h.pick} — ${h.reason}: ${h.evidence}`);
  for (const d of r.droppedQuotes) console.log(`  ! ${d.contestId}: dropped quote (${d.reason}): "${d.text.slice(0, 100)}" — ${d.evidence}`);
  for (const m of r.missing) console.log(`  ? missing ${m.contestId}: ${m.pick} — ${m.evidence}`);
  for (const n of r.notes) console.log(`  ! ${n}`);
}

function printVerifyTotals(): void {
  if (totals.guides === 0) return;
  const [cr, cw, i, o] = totals.tokens;
  console.log(
    `\nVerified ${totals.guides} guide(s): ${totals.confirmed} picks confirmed, ${totals.held} held, ${totals.quotes} quotes dropped, ${totals.missing} missing reported (tokens: cache_read=${cr} cache_write=${cw} in=${i} out=${o})`,
  );
  if (totals.held) console.log("Held picks are not published; see 'held:' in the endorsement files.");
}

async function runVerify(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const ids = flag("--all") ? Object.keys(data.endorsements).sort() : positional();
  if (ids.length === 0) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const client = modelClient();
  for (const id of ids) {
    try {
      const guide = data.guides.find((g) => g.id === id);
      const file = data.endorsements[id];
      if (!guide || !file) throw new Error(`no guide or endorsement file for '${id}'`);
      if (file.manual) {
        console.log(`${id}: skipped (manual)`);
        continue;
      }
      if (sourcesFor(file).length === 0 || Object.keys(file.picks).length + (file.held ?? []).filter((h) => h.reason !== "unclear-match").length === 0) {
        console.log(`${id}: skipped (no source or no picks)`);
        continue;
      }
      await verifyAndWrite(client, data, guide, file, await fetchAll(id, file));
    } catch (e) {
      console.error(`${id}: FAILED — ${errMsg(e)}`);
      process.exitCode = 1;
    }
  }
  printVerifyTotals();
  console.log("\nReview with: git diff data/");
}

const NO_MODEL = {
  messages: { stream: () => { throw new Error("no model calls in this mode"); } },
} as unknown as RefreshDeps["client"];

function refreshDeps({ model = true }: { model?: boolean } = {}): RefreshDeps {
  return {
    client: model ? modelClient() : NO_MODEL,
    fetchSource,
    archiveUrl: (url) => archiveUrl(url),
    today,
    log: (line) => console.log(line),
  };
}

function totalsLine(results: GuideResult[]): string {
  const n = (s: GuideResult["status"]) => results.filter((r) => r.status === s).length;
  return `${results.length} checked: ${n("unchanged")} unchanged, ${n("changed")} re-extracted, ${n("would-extract") ? `${n("would-extract")} would extract (dry run), ` : ""}${n("deferred")} deferred, ${n("skipped")} skipped, ${n("failed") + n("shrunk") + n("shrunk-skipped")} need attention. Estimated model cost ${costText(results)}.`;
}

async function runExtract(): Promise<void> {
  const bad = badFlag(args, ["--all", "--browser", "--archive", "--force", "--force-extract", "--no-verify", "--only-areas", "--via", "--no-fallback"]);
  if (bad) {
    console.error(`${bad}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  const data = loadElection(ROOT, ELECTION);
  const onlyAreas = option("--only-areas")?.split(",").map((a) => a.trim()).filter(Boolean);
  if (flag("--only-areas") && !onlyAreas?.length) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const unknown = onlyAreas && unknownAreaError(data.areas, onlyAreas);
  if (unknown) {
    console.error(unknown);
    process.exitCode = 1;
    return;
  }
  const lists = (id: string) => {
    const areas = data.guides.find((g) => g.id === id)?.areas ?? [];
    return !onlyAreas || (onlyAreas.every((a) => areas.includes(a)) && areas.some((a) => !onlyAreas.includes(a)));
  };
  const ids = flag("--all") ? Object.keys(data.endorsements).sort().filter(lists) : positional();
  if (ids.length === 0 && flag("--all") && onlyAreas) {
    console.error(`--only-areas: no guide lists ${onlyAreas.join(", ")} plus another area`);
    process.exitCode = 1;
    return;
  }
  if (ids.length === 0) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const refused = onlyAreas
    ? ids.flatMap((id) => {
        const guide = data.guides.find((g) => g.id === id);
        try {
          if (guide) newAreaBallot(data.ballot, guide, data.areas, onlyAreas);
          return [];
        } catch (e) {
          return [errMsg(e)];
        }
      })
    : [];
  if (refused.length) {
    refused.forEach((r) => console.error(r));
    process.exitCode = 1;
    return;
  }
  const results = await runRefresh(refreshDeps(), {
    root: ROOT, election: ELECTION, ids,
    browser: flag("--browser"), archive: flag("--archive"), force: flag("--force"),
    forceExtract: flag("--force-extract"), verify: !flag("--no-verify"), onlyAreas,
  });
  console.log(`\n${totalsLine(results)}\nReview with: git diff data/`);
  process.exitCode = exitCodeFor(results);
}

async function runRefreshCmd(): Promise<void> {
  const started = Date.now();
  const gateOnly = flag("--no-extract");
  const results = await runRefresh(refreshDeps({ model: !gateOnly }), {
    root: ROOT, election: ELECTION,
    browser: flag("--browser"), archive: flag("--archive"), maxChanged: REFRESH_BUDGET,
    shrunkSkip: readShrunkState(option("--shrunk-state")),
    baseline: option("--baseline"),
    scope: flag("--local-only") ? "local" : "cloud",
    gateOnly,
  });
  const { errors } = validateElection(loadElection(ROOT, ELECTION));
  let md = summarize(results, { date: today(), dryRun: gateOnly });
  if (errors.length) md += `\n## Validation errors\n\n${errors.map((e) => `- ${e}`).join("\n")}\n`;
  const code = errors.length ? 1 : exitCodeFor(results);
  const summaryPath = option("--summary");
  if (summaryPath) fs.writeFileSync(summaryPath, md);
  const resultPath = option("--result");
  if (resultPath) {
    const durationSec = Math.round((Date.now() - started) / 1000);
    fs.writeFileSync(resultPath, JSON.stringify(reportJson(results, code, { apiFallbackCalls: apiFallbackCalls(), durationSec }), null, 2));
  }
  console.log(`\n${totalsLine(results)}`);
  errors.forEach((e) => console.error(`ERROR ${e}`));
  process.exitCode = code;
}

function readShrunkState(file: string | undefined): Record<string, string> | undefined {
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return undefined;
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return undefined;
  }
}

async function runPages(): Promise<void> {
  if (!flag("--seed")) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const deps: RefreshDeps = { client: NO_MODEL, fetchSource, today, log: (l) => console.log(l) };
  const out = await seedPages(deps, { root: ROOT, election: ELECTION, browser: flag("--browser"), ids: positional().length ? positional() : undefined });
  const failed = out.filter((o) => o.error);
  console.log(`\nStored pages for ${out.length - failed.length} guide(s); ${failed.length} failed.`);
  if (failed.length) process.exitCode = 1;
}

function runDiscover(): void {
  const data = loadElection(ROOT, ELECTION);
  for (const g of data.guides) {
    const e = data.endorsements[g.id];
    if (e?.source) continue;
    console.log(`${g.id}: no ${ELECTION} source. Start from ${g.previousElectionLink ?? g.homepage}`);
    if (!e) {
      const stub: EndorsementFile = {
        guide: g.id, election: ELECTION, status: "pending", fetchedAt: today(), hasReasoning: false, picks: {},
      };
      fs.writeFileSync(endorsementPath(g.id), toYaml(stub));
      console.log(`  created ${path.relative(process.cwd(), endorsementPath(g.id))}`);
    }
  }
}

function runCheck(): void {
  const data = loadElection(ROOT, ELECTION);
  const { errors, warnings } = validateElection(data);
  const hostProblems = data.guides.flatMap((g) => {
    const e = data.endorsements[g.id];
    return e ? checkHosts(g, e).map((p) => `${g.id}: ${p}`) : [];
  });
  const manual = data.guides.filter((g) => data.endorsements[g.id]?.manual).map((g) => g.id);
  const noSource = data.guides.filter((g) => !data.endorsements[g.id]?.source).map((g) => g.id);
  console.log(`INFO  manual (${manual.length}): ${manual.join(", ") || "none"}`);
  console.log(`INFO  no source (${noSource.length}): ${noSource.join(", ") || "none"}`);
  warnings.forEach((w) => console.warn(`WARN  ${w}`));
  [...errors, ...hostProblems].forEach((e) => console.error(`ERROR ${e}`));
  if (errors.length > 0 || hostProblems.length > 0) process.exitCode = 1;
  else console.log(`check OK (${data.guides.length} guides, ${warnings.length} warnings)`);
}

function committedEndorsements(ids: string[]): Record<string, EndorsementFile> {
  const out: Record<string, EndorsementFile> = {};
  for (const id of ids) {
    const rel = path.relative(process.cwd(), endorsementPath(id));
    try {
      const text = execFileSync("git", ["show", `HEAD:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const parsed = EndorsementFile.safeParse(parseYaml(text));
      if (parsed.success) out[id] = parsed.data;
    } catch {
      // not committed yet: the guide shows as new
    }
  }
  return out;
}

function runReview(): void {
  const data = loadElection(ROOT, ELECTION);
  const previous = committedEndorsements(Object.keys(data.endorsements));
  const model = buildReviewModel(data.ballot, data.guides, data.endorsements, previous);
  const out = path.join(process.cwd(), "review.html");
  fs.writeFileSync(out, renderReviewHtml(model));
  const t = model.totals;
  console.log(`review.html: ${t.published} published, ${t.picks} picks, ${t.quotes} quotes, ${t.flagged} flagged`);
  if (!flag("--no-open")) execFileSync("open", [out]);
}

async function runFetchCheck(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const ids = flag("--all") ? Object.keys(data.endorsements).sort() : positional();
  if (ids.length === 0) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const rows = await fetchCheck({ fetchSource }, { root: ROOT, election: ELECTION, ids, browser: flag("--browser") });
  console.log(formatFetchCheck(rows));
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed} of ${rows.length} source(s) fetched; ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

async function runNotify(): Promise<void> {
  const scope = option("--scope");
  const bad = badFlag(args, ["--scope", "--result", "--click", "--crashed", "--conflict", "--record", "--run-url", "--pr", "--exit-code"]);
  const exitCode = option("--exit-code");
  if (bad || (scope !== "cloud" && scope !== "local") || (exitCode !== undefined && !/^\d+$/.test(exitCode))) {
    console.error(`${bad ?? "notify needs --scope cloud or --scope local, and a numeric --exit-code"}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  const resultPath = option("--result");
  const recordPath = option("--record");
  if (recordPath) {
    try {
      const report = flag("--crashed") || !resultPath ? null : readReport(resultPath);
      const record = runRecord(report, {
        scope, finishedAt: new Date(), exitCode: exitCode === undefined ? undefined : Number(exitCode), runUrl: option("--run-url"), pr: option("--pr"),
      });
      fs.writeFileSync(recordPath, `${JSON.stringify(record)}\n`);
    } catch (e) {
      console.warn(`warning: could not write the run record: ${errMsg(e)}`);
    }
  }
  const sent = await notify({ resultPath, scope, click: option("--click"), crashed: flag("--crashed"), conflict: flag("--conflict") });
  if (sent === "sent") console.log("Phone notification sent.");
}

async function main(): Promise<void> {
  if (flag("--help") || flag("-h")) return console.log(USAGE);
  if (cmd === "extract") await runExtract();
  else if (cmd === "refresh") await runRefreshCmd();
  else if (cmd === "pages") await runPages();
  else if (cmd === "fetch-check") await runFetchCheck();
  else if (cmd === "verify") await runVerify();
  else if (cmd === "discover") runDiscover();
  else if (cmd === "check") runCheck();
  else if (cmd === "review") runReview();
  else if (cmd === "notify") await runNotify();
  else {
    console.log(USAGE);
    if (cmd !== undefined) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(errMsg(e));
  process.exitCode = 1;
});
