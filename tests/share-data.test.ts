import { describe, expect, it } from "vitest";
import { areaShare } from "@/components/share/data";
import { viewFor } from "@/lib/area-view";
import { electionSnapshot, election } from "@/lib/site-data";

const ID = "2026-11";
const d = election(ID);

describe.runIf(d)("areaShare", () => {
  it.each((d?.areas ?? []).map((a) => [a.id, a] as const))("%s has a card whose counts match its page", (_, area) => {
    const share = areaShare(ID, area.id);
    expect(share).not.toBeNull();
    expect(share?.head.headline).toBe(`${area.name} endorsements`);
    expect(viewFor(electionSnapshot(d!), area.id).intro.line).toContain(share?.head.counts);
  });
});
