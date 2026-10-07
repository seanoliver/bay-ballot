import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { pacificDay } from "../src/lib/changelog";
import { loadElection, validateElection, type ElectionData } from "../src/lib/data";
import { EndorsementFile, type Guide } from "../src/lib/schema";
import { archiveUrl } from "../src/pipeline/archive";
import type { Source } from "../src/pipeline/extract";
import { fetchSource } from "../src/pipeline/fetch";
import { makeClient, resolveApiKey } from "../src/pipeline/key";
import { checkHosts, fetchMode, sourcesFor } from "../src/pipeline/sources";
import { buildReviewModel, renderReviewHtml } from "../src/pipeline/review";
import { toYaml } from "../src/pipeline/write";
import { costOf, exitCodeFor, resultJson, runRefresh, seedPages, summarize, type GuideResult, type RefreshDeps } from "../src/pipeline/refresh";
import { applyVerdicts, verify } from "../src/pipeline/verify";
import { guideBallot } from "../src/pipeline/scope";
import { parse as parseYaml } from "yaml";

const ROOT = path.join(process.cwd(), "data");
const ELECTION = process.env.BB_ELECTION ?? "2026-11";
const USAGE = `usage: npm run bb -- extract <guide...> | --all [--browser] [--archive] [--force] [--force-extract] [--no-verify]
       npm run bb -- refresh [--summary <file.md>] [--result <file.json>] [--shrunk-state <file.json>] [--baseline <data dir>] [--archive]
       npm run bb -- verify <guide...> | --all [--browser]
       npm run bb -- pages --seed [<guide...>]
       npm run bb -- discover
       npm run bb -- check
       npm run bb -- review [--no-open]

extract and refresh fetch each guide's pages and compare them with the stored page text
(data/<election>/pages). Guides whose pages changed only in dates, banners or other text
that names no contest are skipped with no model call; --force-extract re-extracts anyway.
refresh checks every guide, extracts at most ${"$"}{REFRESH_BUDGET} changed guides, validates, and exits
0 (clean), 2 (something held or needs review) or 1 (error). pages --seed stores today's page
text without extracting.

extract rewrites each guide's picks from its pages, overwriting hand edits to picks
(mark hand-entered guides with 'manual: true' to skip them). --force accepts a result
that empties or more than halves the previous picks. Unless --no-verify, extract then
runs verify on each guide whose picks or quotes changed.

verify has a separate model audit each guide's picks and quotes against its pages.
Unconfirmed picks move to 'held' (not published) and unconfirmed quotes are dropped;
the command exits non-zero when anything is held.`;

const [cmd, ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const VALUE_OPTIONS = ["--summary", "--result", "--shrunk-state", "--baseline"];
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const positional = () => args.filter((a, i) => !a.startsWith("--") && !VALUE_OPTIONS.includes(args[i - 1]));
const REFRESH_BUDGET = 20;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const today = () => pacificDay();
const endorsementPath = (id: string) => path.join(ROOT, ELECTION, "endorsements", `${id}.yml`);


type Totals = { guides: number; confirmed: number; held: number; quotes: number; missing: number; tokens: number[] };
const totals: Totals = { guides: 0, confirmed: 0, held: 0, quotes: 0, missing: 0, tokens: [0, 0, 0, 0] };

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

async function verifyAndWrite(client: Anthropic, data: ElectionData, guide: Guide, file: EndorsementFile, sources: Source[]): Promise<void> {
  const { output, usage } = await verify(client, guideBallot(data.ballot, guide, data.areas), guide, file, sources);
  const r = applyVerdicts(file, output);
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
  const client = makeClient(resolveApiKey(".env.local"));
  for (const id of ids) {
    try {
      const guide = data.guides.find((g) => g.id === id);
      const file = data.endorsements[id];
      if (!guide || !file) throw new Error(`no guide or endorsement file for '${id}'`);
      if (file.manual) {
        console.log(`${id}: skipped (manual)`);
        continue;
      }
      if (sourcesFor(file).length === 0 || Object.keys(file.picks).length + (file.held?.length ?? 0) === 0) {
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

function refreshDeps(): RefreshDeps {
  return {
    client: makeClient(resolveApiKey(".env.local")),
    fetchSource,
    archiveUrl: (url) => archiveUrl(url),
    today,
    log: (line) => console.log(line),
  };
}

function totalsLine(results: GuideResult[]): string {
  const n = (s: GuideResult["status"]) => results.filter((r) => r.status === s).length;
  return `${results.length} checked: ${n("unchanged")} unchanged, ${n("changed")} re-extracted, ${n("deferred")} deferred, ${n("skipped")} skipped, ${n("failed") + n("shrunk") + n("shrunk-skipped")} need attention. Estimated model cost $${costOf(results).toFixed(2)}.`;
}

async function runExtract(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const ids = flag("--all") ? Object.keys(data.endorsements).sort() : positional();
  if (ids.length === 0) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const results = await runRefresh(refreshDeps(), {
    root: ROOT, election: ELECTION, ids,
    browser: flag("--browser"), archive: flag("--archive"), force: flag("--force"),
    forceExtract: flag("--force-extract"), verify: !flag("--no-verify"),
  });
  console.log(`\n${totalsLine(results)}\nReview with: git diff data/`);
  process.exitCode = exitCodeFor(results);
}

async function runRefreshCmd(): Promise<void> {
  const results = await runRefresh(refreshDeps(), {
    root: ROOT, election: ELECTION,
    browser: flag("--browser"), archive: flag("--archive"), maxChanged: REFRESH_BUDGET,
    shrunkSkip: readShrunkState(option("--shrunk-state")),
    baseline: option("--baseline"),
  });
  const { errors } = validateElection(loadElection(ROOT, ELECTION));
  let md = summarize(results, { date: today() });
  if (errors.length) md += `\n## Validation errors\n\n${errors.map((e) => `- ${e}`).join("\n")}\n`;
  const code = errors.length ? 1 : exitCodeFor(results);
  const summaryPath = option("--summary");
  if (summaryPath) fs.writeFileSync(summaryPath, md);
  const resultPath = option("--result");
  if (resultPath) fs.writeFileSync(resultPath, JSON.stringify(resultJson(results, code), null, 2));
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
  const deps: RefreshDeps = { client: { messages: { stream: () => { throw new Error("no model calls when seeding"); } } } as unknown as RefreshDeps["client"], fetchSource, today, log: (l) => console.log(l) };
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

async function main(): Promise<void> {
  if (flag("--help") || flag("-h")) return console.log(USAGE);
  if (cmd === "extract") await runExtract();
  else if (cmd === "refresh") await runRefreshCmd();
  else if (cmd === "pages") await runPages();
  else if (cmd === "verify") await runVerify();
  else if (cmd === "discover") runDiscover();
  else if (cmd === "check") runCheck();
  else if (cmd === "review") runReview();
  else {
    console.log(USAGE);
    if (cmd !== undefined) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(errMsg(e));
  process.exitCode = 1;
});
