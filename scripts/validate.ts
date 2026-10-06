import fs from "node:fs";
import path from "node:path";
import { readChangelog, validateChangelog } from "../src/lib/changelog";
import { listElections, loadElection, validateElection } from "../src/lib/data";

const root = path.join(process.cwd(), "data");
if (!fs.existsSync(root)) {
  console.log("no data/ directory");
  process.exit(0);
}
let failed = false;
for (const election of listElections(root)) {
  let result;
  try {
    result = validateElection(loadElection(root, election));
  } catch (e) {
    console.error(`ERROR ${election} ${e instanceof Error ? e.message : String(e)}`);
    failed = true;
    continue;
  }
  const { errors, warnings } = result;
  warnings.forEach((w) => console.warn(`WARN  ${election} ${w}`));
  errors.forEach((e) => console.error(`ERROR ${election} ${e}`));
  if (errors.length || warnings.length) failed = true;
}
try {
  // Local YYYY-MM-DD, not toISOString(): the UTC date can trail the local one and reject today's entry.
  const today = new Date().toLocaleDateString("en-CA");
  const { entries, errors: read } = readChangelog(root);
  const errors = [...read, ...validateChangelog(entries, today)];
  errors.forEach((e) => console.error(`ERROR ${e}`));
  if (errors.length) failed = true;
} catch (e) {
  console.error(`ERROR changelog ${e instanceof Error ? e.message : String(e)}`);
  failed = true;
}
if (failed) process.exit(1);
console.log("data OK");
