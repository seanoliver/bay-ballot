import path from "node:path";
import { describe, expect, it } from "vitest";
import { areaFromPath, areaHead, areaView, hasContest, snapshotOf, viewFor } from "@/lib/area-view";
import { areaGuides, areaLinks, inArea, placeGroups, placeName } from "@/lib/areas";
import { loadElection, type ElectionData } from "@/lib/data";
import { electionIntro, pendingNote } from "@/lib/display";
import { fallbackFor, scopeName } from "@/lib/fallback";
import { pendingGuides, publishedFiles, publishedGuides, type FilterGuide, type GuideInfo } from "@/lib/filters";
import type { Area } from "@/lib/schema";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

// ballotViewProps and ListPage's links and intro as they were before the snapshot, as the reference.
function before(d: ElectionData, area: Area | null) {
  const inScope = area ? areaGuides(d.guides, area) : d.guides;
  const published = publishedGuides(inScope, d.endorsements);
  const ids = new Set(published.map((g) => g.id));
  const contests = area ? d.ballot.contests.filter((c) => inArea(c, area)) : d.ballot.contests;
  const groups = placeGroups(contests, d.areas);
  const info = (gs: typeof published) => gs.map(({ id, name, shortName, type }): GuideInfo => ({ id, name, ...(shortName ? { shortName } : {}), type }));
  const guides = info(published);
  const files = Object.fromEntries(Object.entries(publishedFiles(d.endorsements)).filter(([id]) => ids.has(id)));
  return {
    links: areaLinks(d.ballot.election, d.areas, area?.id ?? null),
    intro: electionIntro({ ...d.ballot, contests }, files, { place: placeName(area).name }),
    groups,
    guides,
    allGuides: publishedGuides(d.guides, d.endorsements).map(({ id, type }): FilterGuide => ({ id, type })),
    files,
    pending: pendingNote(pendingGuides(inScope, d.endorsements)),
    ...(area
      ? {
          fallback: fallbackFor({
            groups,
            place: scopeName(area),
            local: { guides, files },
            bay: { guides: info(publishedGuides(d.guides, d.endorsements)), files: publishedFiles(d.endorsements) },
          }),
        }
      : {}),
  };
}

describe("areaView", () => {
  const snap = snapshotOf(d);
  // What the browser gets: the snapshot after a trip through JSON.
  const sent = JSON.parse(JSON.stringify(snap));

  it.each([null, ...d.areas.map((a) => a.id)])("matches the server's old props for %s, from the snapshot and from its JSON", (id) => {
    const area = id === null ? null : d.areas.find((a) => a.id === id)!;
    const { area: shown, title, ...view } = areaView(snap, id);
    expect(shown).toBe(id);
    expect(title).toMatch(/ endorsements \(Nov 2026\)$/);
    expect(view).toEqual(before(d, area));
    expect(areaView(sent, id)).toEqual(areaView(snap, id));
  });

  it("throws on an unknown area", () => {
    expect(() => areaView(snap, "atlantis")).toThrow(/no area 'atlantis'/);
  });

  it("viewFor returns the same view each time, and every view shares one allGuides", () => {
    expect(viewFor(snap, "sf")).toBe(viewFor(snap, "sf"));
    expect(viewFor(snap, null)).toBe(viewFor(snap, null));
    expect(viewFor(snap, "sf").allGuides).toBe(viewFor(snap, "marin").allGuides);
  });

  it("areaHead gives the title and chips a full view would", () => {
    const { title, links } = viewFor(snap, "sonoma");
    expect(areaHead(snap, "sonoma")).toEqual({ title, links });
  });

  it("hasContest knows which contests an area's ballot holds", () => {
    expect(hasContest(snap, "sonoma", "governor")).toBe(true);
    expect(hasContest(snap, "sonoma", "prop-b")).toBe(false);
    expect(hasContest(snap, null, "prop-b")).toBe(true);
    expect(hasContest(snap, null, "nope")).toBe(false);
  });
});

describe("areaFromPath", () => {
  const s = { election: "2026-11", areas: d.areas };
  it.each([
    ["/2026-11", null],
    ["/2026-11/", null],
    ["/2026-11/sonoma", "sonoma"],
    ["/2026-11/san-jose", "san-jose"],
    ["/2026-11/governor", undefined],
    ["/2026-11/sonoma/x", undefined],
    ["/2024-03/sonoma", undefined],
    ["/about", undefined],
    ["/", undefined],
  ])("%s → %s", (p, want) => {
    expect(areaFromPath(s, p)).toBe(want);
  });
});
