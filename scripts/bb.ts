import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { loadElection, validateElection, type ElectionData } from "../src/lib/data";
import { EndorsementFile } from "../src/lib/schema";
import { archiveUrl } from "../src/pipeline/archive";
import { diffPicks } from "../src/pipeline/diff";
import { extract, pagesFor, toEntries, type Source } from "../src/pipeline/extract";
import { fetchSource } from "../src/pipeline/fetch";
import { makeClient, resolveApiKey } from "../src/pipeline/key";
import { checkHosts, fetchMode, sourcesFor } from "../src/pipeline/sources";
import { nextFile, shrinkWarning, toYaml } from "../src/pipeline/write";

const ROOT = path.join(process.cwd(), "data");
const ELECTION = process.env.BB_ELECTION ?? "2026-11";
const USAGE = `usage: npm run bb -- extract <guide...> | --all [--browser] [--archive] [--force]
       npm run bb -- discover
       npm run bb -- check`;

const [cmd, ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const today = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const endorsementPath = (id: string) => path.join(ROOT, ELECTION, "endorsements", `${id}.yml`);

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

  const browser = fetchMode(prev, flag("--browser")) === "browser";
  const sources: Source[] = [];
  for (const url of urls) {
    const fetched = await fetchSource(url, { browser });
    if (fetched.kind === "pdf" && fetched.text.trim() === "") {
      console.warn(`${guideId}: warning: no text extracted from PDF ${url}; quotes from it will drop`);
    }
    sources.push({ url, fetched });
  }

  const { output, usage } = await extract(client, data.ballot, guide, sources);
  const { picks, notes } = toEntries(output, data.ballot.contests, pagesFor(sources), { ownNames: [guide.name] });

  const shrunk = shrinkWarning(guideId, prev.picks, picks, { force: flag("--force") });
  if (shrunk) {
    console.log(`\n${shrunk}`);
    notes.forEach((n) => console.log(`${n.includes("PICK DROPPED") ? "  !! " : "  ! "}${n}`));
    return;
  }

  let archived: string[] | undefined;
  if (flag("--archive")) {
    const snaps: string[] = [];
    for (const url of urls) {
      const snap = await archiveUrl(url);
      if (snap) snaps.push(snap);
      else console.warn(`${guideId}: warning: could not archive ${url}`);
    }
    if (snaps.length > 0) archived = snaps;
  }

  const next = EndorsementFile.parse(nextFile(prev, picks, output.hasReasoning, today(), archived));
  const file = endorsementPath(guideId);
  fs.writeFileSync(file, toYaml(next, { previous: fs.readFileSync(file, "utf8") }));

  console.log(
    `\n${guideId}  cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0} in=${usage.input_tokens} out=${usage.output_tokens}`,
  );
  diffPicks(prev.picks, picks).forEach((l) => console.log(`  ${l}`));
  notes.forEach((n) => console.log(`${n.includes("PICK DROPPED") ? "  !! " : "  ! "}${n}`));
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
  warnings.forEach((w) => console.warn(`WARN  ${w}`));
  [...errors, ...hostProblems].forEach((e) => console.error(`ERROR ${e}`));
  if (errors.length > 0 || hostProblems.length > 0) process.exitCode = 1;
  else console.log(`check OK (${data.guides.length} guides, ${warnings.length} warnings)`);
}

async function main(): Promise<void> {
  if (cmd === "extract") await runExtract();
  else if (cmd === "discover") runDiscover();
  else if (cmd === "check") runCheck();
  else {
    console.log(USAGE);
    if (cmd !== undefined) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(errMsg(e));
  process.exitCode = 1;
});
