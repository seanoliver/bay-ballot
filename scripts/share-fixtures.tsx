// Renders share-image states that the current data doesn't produce, to look at them.
// Run: npx tsx scripts/share-fixtures.tsx <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { ContestShare } from "../src/components/share/ContestCard";
import { shareFonts } from "../src/components/share/fonts";
import { SIZE, ShareFrame } from "../src/components/share/ShareFrame";
import { shareCard } from "../src/lib/share";
import { election, latestElection } from "../src/lib/site-data";

async function main() {
  const out = process.argv[2] ?? "share-fixtures";
  mkdirSync(out, { recursive: true });
  const d = election(latestElection());
  const contest = d?.ballot.contests.find((c) => c.kind === "measure");
  if (!contest) throw new Error("no measure on the latest ballot");
  // A real contest with no guide rows: the "no positions" state.
  const card = shareCard(contest, []);
  const res = new ImageResponse(
    (
      <ShareFrame right="Nov 3, 2026 · San Francisco">
        <ContestShare card={card} />
      </ShareFrame>
    ),
    { ...SIZE, fonts: await shareFonts() },
  );
  const file = path.join(out, "no-positions.png");
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(file);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
