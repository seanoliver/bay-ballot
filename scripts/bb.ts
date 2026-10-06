import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { loadElection, validateElection, type ElectionData } from "../src/lib/data";
import { EndorsementFile, type ArchivedSource, type Guide } from "../src/lib/schema";
import { archiveUrl } from "../src/pipeline/archive";
import { diffPicks, summaryLine } from "../src/pipeline/diff";
import { extract, pagesFor, toEntries, type Source } from "../src/pipeline/extract";
import { fetchSource } from "../src/pipeline/fetch";
import { makeClient, resolveApiKey } from "../src/pipeline/key";
import { checkHosts, fetchMode, sourcesFor } from "../src/pipeline/sources";
import { buildReviewModel, renderReviewHtml } from "../src/pipeline/review";
import { nextFile, shrinkWarning, toYaml } from "../src/pipeline/write";
import { applyVerdicts, verify } from "../src/pipeline/verify";
import { parse as parseYaml } from "yaml";

const ROOT = path.join(process.cwd(), "data");
const ELECTION = process.env.BB_ELECTION ?? "2026-11";
const USAGE = `usage: npm run bb -- extract <guide...> | --all [--browser] [--archive] [--force] [--no-verify]
       npm run bb -- verify <guide...> | --all [--browser]
       npm run bb -- discover
       npm run bb -- check
       npm run bb -- review [--no-open]

extract rewrites each guide's picks from its pages, overwriting hand edits to picks
(mark hand-entered guides with 'manual: true' to skip them). --force accepts a result
that empties or more than halves the previous picks. Unless --no-verify, extract then
runs verify on each guide whose picks or quotes changed.

verify has a separate model audit each guide's picks and quotes against its pages.
Unconfirmed picks move to 'held' (not published) and unconfirmed quotes are dropped;
the command exits non-zero when anything is held.`;

const [cmd, ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const today = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const endorsementPath = (id: string) => path.join(ROOT, ELECTION, "endorsements", `${id}.yml`);

const printNote = (n: string) => console.log(`${n.includes("PICK DROPPED") ? "  !! " : "  ! "}${n}`);

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

/** Audit one guide's file against its pages, write the result, and print what changed. */
async function verifyAndWrite(client: Anthropic, data: ElectionData, guide: Guide, file: EndorsementFile, sources: Source[]): Promise<void> {
  const { output, usage } = await verify(client, data.ballot, guide, file, sources);
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

async function extractOne(client: Anthropic, data: ElectionData, guideId: string): Promise<void> {
  const guide = data.guides.find((g) => g.id === guideId);
  if (!guide) throw new Error(`no guides/${guideId}.yml`);
  const prev = data.endorsements[guideId];
  if (!prev) throw new Error(`no endorsement file (run 'npm run bb -- discover')`);
  if (prev.manual) return console.log(`${guideId}: skipped (manual)`);
  const urls = sourcesFor(prev);
  if (urls.length === 0) return console.log(`${guideId}: no source`);
  const hostProblems = checkHosts(guide, prev);
  if (hostProblems.length > 0) {
    console.log(`${guideId}: skipped (source host check)`);
    hostProblems.forEach((p) => console.log(`  ! ${p}`));
    return;
  }

  const sources = await fetchAll(guideId, prev);

  const { output, usage } = await extract(client, data.ballot, guide, sources);
  const { picks, notes } = toEntries(output, data.ballot.contests, pagesFor(sources), { ownNames: [guide.name] });

  const shrunk = shrinkWarning(guideId, prev.picks, picks, { force: flag("--force") });
  if (shrunk) {
    console.log(`\n${shrunk}`);
    notes.forEach(printNote);
    return;
  }

  let archived: ArchivedSource[] | undefined;
  if (flag("--archive")) {
    const snaps: ArchivedSource[] = [];
    for (const url of urls) {
      const snapshot = await archiveUrl(url);
      if (snapshot) snaps.push({ source: url, snapshot });
      else console.warn(`${guideId}: warning: could not archive ${url}`);
    }
    if (snaps.length > 0) archived = snaps;
  }

  const next = EndorsementFile.parse(nextFile(prev, picks, output.hasReasoning, today(), archived));
  const file = endorsementPath(guideId);
  fs.writeFileSync(file, toYaml(next, { previous: fs.readFileSync(file, "utf8") }));

  console.log(`\n${summaryLine(guideId, prev.picks, picks, notes)}`);
  console.log(
    `${guideId}  cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0} in=${usage.input_tokens} out=${usage.output_tokens}`,
  );
  diffPicks(prev.picks, picks).forEach((l) => console.log(`  ${l}`));
  notes.forEach(printNote);

  // Only re-verify what this run changed; an unchanged file was already verified.
  if (!flag("--no-verify") && !isDeepStrictEqual(prev.picks, next.picks) && Object.keys(next.picks).length > 0) {
    await verifyAndWrite(client, data, guide, next, sources);
  }
}

async function runVerify(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const ids = flag("--all") ? Object.keys(data.endorsements).sort() : args.filter((a) => !a.startsWith("--"));
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
      if (sourcesFor(file).length === 0 || Object.keys(file.picks).length === 0) {
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

async function runExtract(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const ids = flag("--all") ? Object.keys(data.endorsements).sort() : args.filter((a) => !a.startsWith("--"));
  if (ids.length === 0) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const client = makeClient(resolveApiKey(".env.local"));
  for (const id of ids) {
    try {
      await extractOne(client, data, id);
    } catch (e) {
      console.error(`${id}: FAILED — ${errMsg(e)}`);
    }
  }
  printVerifyTotals();
  console.log("\nReview with: git diff data/");
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

// Last-committed version of each endorsement file, for the review page's change markers.
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
  if (cmd === "extract") await runExtract();
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
