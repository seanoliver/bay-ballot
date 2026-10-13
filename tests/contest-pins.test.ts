import { describe, expect, it } from "vitest";
import { areaNoPick, countedNoPick, countOnly, isCountingOnly, noPickGuides, pinMessage } from "@/lib/contest-pins";
import { EMPTY, type Filters, type GuideInfo, type PickFile } from "@/lib/filters";
import type { Area, Entry } from "@/lib/schema";

const entry: Entry = { pick: "Y", ranked: false, quotes: [] };
const file = (picks: string[], hasReasoning = true): PickFile => ({ hasReasoning, picks: Object.fromEntries(picks.map((c) => [c, entry])) });
const g = (id: string, name = id): GuideInfo => ({ id, name, type: "club" });
const f = (over: Partial<Filters> = {}): Filters => ({ ...EMPTY, ...over });

const areas: Area[] = [
  { id: "sf", name: "San Francisco", kind: "county", jurisdictions: [{ level: "county", name: "San Francisco" }] },
  { id: "oakland", name: "Oakland", kind: "city", jurisdictions: [{ level: "county", name: "Alameda" }, { level: "city", name: "Oakland" }] },
  { id: "alameda", name: "Alameda County", kind: "county", jurisdictions: [{ level: "county", name: "Alameda" }] },
];
const propD = { id: "prop-d", jurisdiction: { level: "county" as const, name: "San Francisco" } };

describe("noPickGuides", () => {
  const files = { spur: file(["prop-d"]), growsf: file(["prop-a"], false), oak: file(["measure-x"]), both: file([]) };
  const guides = [
    { id: "spur", areas: ["sf"] },
    { id: "growsf", areas: ["sf"] },
    { id: "oak", areas: ["oakland"] },
    { id: "both", areas: ["sf", "oakland"] },
    { id: "pending", areas: ["sf"] },
  ];

  it("lists the published guides covering the contest's area that skipped it", () => {
    expect(noPickGuides(propD, guides, areas, files)).toEqual([
      { id: "growsf", hasReasoning: false },
      { id: "both", hasReasoning: true },
    ]);
  });

  it("covers only the contest's own place, not every area that overlaps it", () => {
    const measure = { id: "measure-a", jurisdiction: { level: "county" as const, name: "Alameda" } };
    const county = [{ id: "acdp", areas: ["alameda"] }, { id: "oak", areas: ["oakland"] }];
    expect(noPickGuides(measure, county, areas, { acdp: file([]), oak: file([]) }).map((x) => x.id)).toEqual(["acdp"]);
  });

  it("covers every area for a statewide contest", () => {
    const prop1 = { id: "prop-1", jurisdiction: { level: "state" as const, name: "California" } };
    expect(noPickGuides(prop1, guides, areas, files).map((x) => x.id)).toEqual(["spur", "growsf", "oak", "both"]);
  });
});

describe("areaNoPick", () => {
  it("lists the area's published guides that skipped the contest", () => {
    const files = { spur: file(["prop-d"]), growsf: file(["prop-a"], false) };
    expect(areaNoPick("prop-d", [{ id: "spur" }, { id: "growsf" }, { id: "pending" }], files)).toEqual([{ id: "growsf", hasReasoning: false }]);
  });
});

describe("countedNoPick", () => {
  const guides = [g("b", "Bravo"), g("a", "Alpha"), g("c", "Charlie")];
  const noPick = [
    { id: "b", hasReasoning: true },
    { id: "a", hasReasoning: false },
    { id: "c", hasReasoning: true },
  ];

  it("keeps the guides still counted, by name", () => {
    expect(countedNoPick(f({ off: ["c"] }), noPick, guides).map((x) => x.name)).toEqual(["Alpha", "Bravo"]);
  });

  it("drops list-only guides when only explained endorsements count", () => {
    expect(countedNoPick(f({ whyOnly: true }), noPick, guides).map((x) => x.id)).toEqual(["b", "c"]);
  });
});

describe("countOnly", () => {
  const all = ["a", "b", "c", "d"];

  it("turns off every other guide and keeps pins and the reasons filter", () => {
    const next = countOnly(f({ off: ["a"], whyOnly: true, pins: ["d"] }), ["a", "b"], all);
    expect(next).toEqual({ off: ["c", "d"], whyOnly: true, pins: ["d"] });
    expect(isCountingOnly(next, ["a", "b"], all)).toBe(true);
  });

  it("is not counting only a side while another guide is counted or one of its guides is off", () => {
    expect(isCountingOnly(f(), ["a", "b"], all)).toBe(false);
    expect(isCountingOnly(f({ off: ["b", "c", "d"] }), ["a", "b"], all)).toBe(false);
  });
});

describe("pinMessage", () => {
  const growsf = g("growsf", "GrowSF");

  it("says what was pinned or unpinned and how many are pinned", () => {
    expect(pinMessage(f({ pins: ["a", "b"] }), growsf)).toBe("Pinned GrowSF · 3 of 4 pinned");
    expect(pinMessage(f({ pins: ["a", "growsf"] }), growsf)).toBe("Unpinned GrowSF · 1 of 4 pinned");
  });

  it("says the limit when four are pinned", () => {
    expect(pinMessage(f({ pins: ["a", "b", "c", "d"] }), growsf)).toBe("You can pin up to 4 guides. Unpin one first.");
  });

  it("uses the short name", () => {
    expect(pinMessage(f(), { ...g("sf-chronicle", "San Francisco Chronicle"), shortName: "SF Chronicle" })).toBe("Pinned SF Chronicle · 1 of 4 pinned");
  });
});
