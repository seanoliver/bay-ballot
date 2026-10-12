import { describe, expect, it } from "vitest";
import { areaShare } from "@/components/share/data";
import { eligible } from "@/lib/fallback";
import { activeEntries, EMPTY } from "@/lib/filters";
import { shareCard } from "@/lib/share";
import { ballotViewProps, election, latestElection } from "@/lib/site-data";

const id = latestElection();
const d = election(id)!;

describe("areaShare", () => {
  it.each(d.areas.map((a) => [a.id, a] as const))("%s features its local contest with the most guide positions", (_, area) => {
    const { ballot, guides, files } = ballotViewProps(d, { area });
    const rowsFor = (cid: string) => activeEntries(cid, guides, files, EMPTY);
    const n = (cid: string) => rowsFor(cid).length;
    const local = ballot.contests.filter((c) => !eligible(c) && n(c.id) > 0);
    const share = areaShare(id, area.id)!;
    expect(share.area).toEqual({ headline: `${area.name} endorsements`, counts: `${guides.length} guides · ${ballot.contests.length} contests` });
    if (local.length === 0) return;
    const most = Math.max(...local.map((c) => n(c.id)));
    const first = local.find((c) => n(c.id) === most)!;
    expect(share.card).toEqual(shareCard(first, rowsFor(first.id)));
  });
});
