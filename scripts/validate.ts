import fs from "node:fs";
import path from "node:path";
import { listElections, loadElection, validateElection } from "../src/lib/data";

const root = path.join(process.cwd(), "data");
if (!fs.existsSync(root)) {
  console.log("no data/ directory");
  process.exit(0);
}
let failed = false;
for (const election of listElections(root)) {
  const { errors, warnings } = validateElection(loadElection(root, election));
  warnings.forEach((w) => console.warn(`WARN  ${election} ${w}`));
  errors.forEach((e) => console.error(`ERROR ${election} ${e}`));
  if (errors.length || warnings.length) failed = true;
}
if (failed) process.exit(1);
console.log("data OK");
