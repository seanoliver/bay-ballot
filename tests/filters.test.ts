import { describe, expect, it } from "vitest";
import {
  filterQuery, carryQuery, contestFiles, setTypeGroup, hiddenLabel, positionGuides, revealGuides,
  activeEntries, countedLabel, filterSummary, fromQuery, guideGroups, hasFilterParams,
  initialFilters, isGuideOn, publishedFiles, sanitizeFilters, toggleGuide, toQuery,
  typeState, pendingGuides, EMPTY, MAX_PINS, pinnedPicks, togglePin, savedFilters, READER_KEYS, SHARED_KEYS,
  type GuideInfo, type PickFile,
} from "@/lib/filters";
import type { EndorsementFile, Guide } from "@/lib/schema";

const guides = [
  { id: "a", name: "A", type: "advocacy" }, { id: "b", name: "B", type: "club" }, { id: "c", name: "C", type: "newspaper" },
] as Guide[];
const ends = {
  a: { status: "published", hasReasoning: true, picks: { x: { pick: "Y", ranked: false, quotes: [] } } },
  b: { status: "published", hasReasoning: false, picks: { x: { pick: "N", ranked: false, quotes: [] } } },
  c: { status: "pending", hasReasoning: true, picks: {} },
} as unknown as Record<string, EndorsementFile>;
const files = publishedFiles(ends);

describe("query string", () => {
  it("round-trips", () => {
    const f = { off: ["b"], only: [], whyOnly: true, pins: [] };
    expect(fromQuery(toQuery(f))).toEqual(f);
  });
  it("EMPTY round-trips to empty string and back", () => {
    expect(toQuery(EMPTY)).toBe("");
    expect(fromQuery("")).toEqual(EMPTY);
  });
  it("parses the documented URL format", () => {
    expect(fromQuery("?off=pov,sf-dems&why=1")).toEqual({ off: ["pov", "sf-dems"], only: [], whyOnly: true, pins: [] });
  });
  it("expands legacy offtypes into the ids of guides of those types", () => {
    const gs = [{ id: "m", type: "club" }, { id: "n", type: "club" }, { id: "s", type: "civic" }] as GuideInfo[];
    expect(fromQuery("offtypes=club&off=s", gs).off).toEqual(["m", "n", "s"]);
    expect(fromQuery("offtypes=club").off).toEqual([]);
  });
  it("ignores unknown params and empty values", () => {
    expect(fromQuery("foo=1&utm_source=x&off=")).toEqual(EMPTY);
    expect(fromQuery("why=0").whyOnly).toBe(false);
  });
  it("ignores legacy district params (sup, ad, cd, bart) and drops them from the next query", () => {
    const f = fromQuery("off=a&sup=8&ad=17&cd=11&bart=8");
    expect(f).toEqual({ off: ["a"], only: [], whyOnly: false, pins: [] });
    expect(toQuery(f)).toBe("off=a");
  });
  it("dedupes ids", () => {
    expect(fromQuery("off=a,b,a").off).toEqual(["a", "b"]);
    expect(toQuery({ ...EMPTY, off: ["a", "a"] })).toBe("off=a");
  });
  it("produces deterministic output with sorted lists and no offtypes", () => {
    const a = toQuery({ off: ["z", "a"], only: [], whyOnly: true, pins: [] });
    const b = toQuery({ off: ["a", "z"], only: [], whyOnly: true, pins: [] });
    expect(a).toBe(b);
    expect(a).toBe("off=a%2Cz&why=1");
  });
});

describe("publishedFiles", () => {
  it("keeps only published files, slimmed to what the ballot view needs", () => {
    const withExtra = { ...ends, a: { ...ends.a, source: "https://a.org", fetchedAt: "2026-10-01" } } as Record<string, EndorsementFile>;
    expect(publishedFiles(withExtra)).toEqual({
      a: { hasReasoning: true, picks: ends.a.picks },
      b: { hasReasoning: false, picks: ends.b.picks },
    });
  });
  it("keeps archived snapshots for source links", () => {
    const archived = [{ source: "https://a.org/x", snapshot: "https://web.archive.org/web/1/https://a.org/x" }];
    expect(publishedFiles({ a: { ...ends.a, archived } }).a.archived).toEqual(archived);
  });
});

describe("activeEntries", () => {
  it("excludes off and list-only guides", () => {
    expect(activeEntries("x", guides, files, EMPTY).map((r) => r.guide.id)).toEqual(["a", "b"]);
    expect(activeEntries("x", guides, files, { ...EMPTY, whyOnly: true, pins: [] }).map((r) => r.guide.id)).toEqual(["a"]);
    expect(activeEntries("x", guides, files, { ...EMPTY, off: ["a"] }).map((r) => r.guide.id)).toEqual(["b"]);
  });
  it("skips guides with no published file or no entry for the contest", () => {
    expect(activeEntries("nope", guides, files, EMPTY)).toEqual([]);
    expect(activeEntries("x", guides, {}, EMPTY)).toEqual([]);
  });
});

describe("pendingGuides", () => {
  it("lists pending guides: no file or status pending", () => {
    expect(pendingGuides(guides, ends).map((g) => g.id)).toEqual(["c"]);
    expect(pendingGuides(guides, { a: ends.a }).map((g) => g.id)).toEqual(["b", "c"]);
  });
});

const info: GuideInfo[] = [
  { id: "a", name: "A", type: "advocacy" }, { id: "b", name: "B", type: "club" },
];

describe("sanitizeFilters", () => {
  it("keeps known guide ids", () => {
    const f = { off: ["a"], only: [], whyOnly: true, pins: [] };
    expect(sanitizeFilters(f, info)).toEqual(f);
  });
  it("drops unknown guide ids", () => {
    expect(sanitizeFilters({ off: ["a", "nope"], only: [], whyOnly: false, pins: [] }, info)).toEqual({ off: ["a"], only: [], whyOnly: false, pins: [] });
  });
});

describe("initialFilters", () => {
  it("prefers filter params in the URL over stored filters", () => {
    expect(initialFilters({ query: "why=1", stored: "off=a", guides: info })).toEqual({ ...EMPTY, whyOnly: true });
  });
  it("keeps stored pins when the URL has other filter params but no pin", () => {
    expect(initialFilters({ query: "off=b", stored: "why=1&pin=b%2Ca", guides: info })).toEqual({ off: ["b"], only: [], whyOnly: false, pins: ["b", "a"] });
    expect(initialFilters({ query: "why=1", stored: "pin=a", guides: info })).toEqual({ ...EMPTY, whyOnly: true, pins: ["a"] });
  });
  it("shows a link's own pins over the stored ones", () => {
    expect(initialFilters({ query: "off=b&pin=b", stored: "pin=a", guides: info }).pins).toEqual(["b"]);
  });
  it("falls back to stored pins when the link's pins are empty or all unknown", () => {
    expect(initialFilters({ query: "pin=", stored: "pin=a", guides: info }).pins).toEqual(["a"]);
    expect(initialFilters({ query: "off=b&pin=zzz,gone", stored: "pin=a", guides: info })).toEqual({ off: ["b"], only: [], whyOnly: false, pins: ["a"] });
  });
  it("sanitizes stored pins it falls back to", () => {
    expect(initialFilters({ query: "off=b", stored: "pin=zzz,a", guides: info }).pins).toEqual(["a"]);
    const many = [...info, ...["c", "d", "e"].map((id) => ({ id, name: id, type: "club" as const }))];
    expect(initialFilters({ query: "why=1", stored: "pin=e,d,c,b,a", guides: many }).pins).toEqual(["e", "d", "c", "b"]);
  });
  it("keeps stored pins under a legacy offtypes-only link, and has none with nothing stored", () => {
    expect(initialFilters({ query: "offtypes=club", stored: "pin=a", guides: info })).toEqual({ off: ["b"], only: [], whyOnly: false, pins: ["a"] });
    expect(initialFilters({ query: "off=b", stored: null, guides: info })).toEqual({ ...EMPTY, off: ["b"] });
  });
  it("has no pins once they were unpinned and stored without them", () => {
    expect(initialFilters({ query: "off=b", stored: "off=b", guides: info }).pins).toEqual([]);
  });
  it("uses stored filters when the URL has no filter params", () => {
    expect(initialFilters({ query: "utm_source=x", stored: "off=a&sup=8", guides: info })).toEqual({ ...EMPTY, off: ["a"] });
  });
  it("is EMPTY with nothing in the URL or storage", () => {
    expect(initialFilters({ query: "", stored: null, guides: info })).toEqual(EMPTY);
  });
  it("sanitizes and expands legacy offtypes", () => {
    expect(initialFilters({ query: "offtypes=club&off=zzz", stored: null, guides: info }).off).toEqual(["b"]);
  });
});

describe("savedFilters", () => {
  const info4 = ["a", "b", "c", "d"].map((id) => ({ id, name: id, type: "club" as const }));
  const stored = { ...EMPTY, pins: ["b", "a"] };
  const shared = { ...EMPTY, off: ["c"], pins: ["d"] };
  it("keeps the reader's stored pins through a change that isn't to pins", () => {
    expect(savedFilters({ prev: shared, next: { ...shared, whyOnly: true }, stored })).toEqual({ off: ["c"], only: [], whyOnly: true, pins: ["b", "a"] });
    expect(savedFilters({ prev: shared, next: { ...EMPTY, pins: shared.pins }, stored })).toEqual(stored);
  });
  it("applies an unpin to the stored pins, keeping the reader's own when a shared pin is unpinned", () => {
    expect(savedFilters({ prev: shared, next: togglePin(shared, "d"), stored }).pins).toEqual(["b", "a"]);
    const mine = { ...EMPTY, pins: ["b", "a"] };
    expect(savedFilters({ prev: mine, next: togglePin(mine, "b"), stored }).pins).toEqual(["a"]);
  });
  it("adds only the newly pinned guide while a shared list is showing", () => {
    expect(savedFilters({ prev: shared, next: togglePin(shared, "e"), stored }).pins).toEqual(["b", "a", "e"]);
    expect(savedFilters({ prev: shared, next: togglePin(shared, "b"), stored }).pins).toEqual(["b", "a"]);
  });
  it("doesn't drop a pin another tab added when a stale tab unpins", () => {
    const stale = { ...EMPTY, pins: ["b"] };
    expect(savedFilters({ prev: stale, next: togglePin(stale, "b"), stored: { ...EMPTY, pins: ["b", "a"] } }).pins).toEqual(["a"]);
  });
  it("keeps stored pins first, so a pin past MAX_PINS shows but isn't saved", () => {
    const full = { ...EMPTY, pins: ["a", "b", "c", "d"] };
    expect(savedFilters({ prev: shared, next: togglePin(shared, "e"), stored: full }).pins).toEqual(["a", "b", "c", "d"]);
  });
  it("doesn't let a stored pin for an unknown guide hold a slot, once stored filters are sanitized", () => {
    const stored = sanitizeFilters(fromQuery("pin=gone,a,b,c"), info4);
    const prev = { ...EMPTY, pins: ["a", "b", "c"] };
    expect(savedFilters({ prev, next: togglePin(prev, "d"), stored }).pins).toEqual(["a", "b", "c", "d"]);
  });
  it("classifies every filter as shared or reader-owned", () => {
    expect([...SHARED_KEYS, ...READER_KEYS].sort()).toEqual(Object.keys(EMPTY).sort());
  });
  it("saves `only` like the other shared filters", () => {
    expect(SHARED_KEYS).toContain("only");
    const prev = { ...EMPTY, off: ["c"] };
    expect(savedFilters({ prev, next: { ...prev, only: ["a"] }, stored: EMPTY })).toEqual({ ...EMPTY, off: ["c"], only: ["a"] });
  });
});

describe("only", () => {
  const f = { ...EMPTY, off: ["a"], only: ["a", "b"] };
  it("round-trips through the query, sorted, and counts as a filter param", () => {
    expect(toQuery({ ...EMPTY, only: ["b", "a"] })).toBe("only=a%2Cb");
    expect(fromQuery("only=b,a&off=c")).toEqual({ ...EMPTY, off: ["c"], only: ["a", "b"] });
    expect(hasFilterParams("only=a")).toBe(true);
  });
  it("wins over off while set", () => {
    expect(isGuideOn(f, "a")).toBe(true);
    expect(isGuideOn(f, "c")).toBe(false);
    expect(isGuideOn({ ...f, only: [] }, "a")).toBe(false);
  });
  it("is what a checkbox, a type group or Show all edits while set, leaving off alone", () => {
    expect(toggleGuide(f, "b")).toEqual({ ...f, only: ["a"] });
    expect(toggleGuide(f, "c")).toEqual({ ...f, only: ["a", "b", "c"] });
    expect(setTypeGroup(f, "newspaper", guides, true)).toEqual({ ...f, only: ["a", "b", "c"] });
    expect(revealGuides(f, ["c"], {})).toEqual({ ...f, only: ["a", "b", "c"] });
  });
  it("drops unknown guides and is counted in the summary", () => {
    expect(sanitizeFilters({ ...EMPTY, only: ["a", "gone"] }, guides).only).toEqual(["a"]);
    const files = Object.fromEntries(guides.map((g) => [g.id, { hasReasoning: true, picks: {} }]));
    expect(filterSummary({ ...EMPTY, only: ["b"] }, guides, files).counted).toBe(1);
  });
});

describe("filterSummary and countedLabel", () => {
  it("counts published guides; subtracts off and list-only", () => {
    expect(filterSummary(EMPTY, guides, files)).toEqual({ counted: 2, published: 2 });
    expect(filterSummary({ ...EMPTY, off: ["a"] }, guides, files)).toEqual({ counted: 1, published: 2 });
    expect(filterSummary({ ...EMPTY, whyOnly: true, pins: [] }, guides, files)).toEqual({ counted: 1, published: 2 });
  });
  it("ignores unpublished guides even when they are turned off", () => {
    expect(filterSummary({ ...EMPTY, off: ["c"] }, guides, files)).toEqual({ counted: 2, published: 2 });
  });
  it("reads N of M guides counted", () => {
    expect(countedLabel({ counted: 5, published: 7 })).toBe("5 of 7 guides counted");
    expect(countedLabel({ counted: 1, published: 1 })).toBe("1 of 1 guide counted");
  });
});

describe("hasFilterParams", () => {
  it("is true when any filter param is present, including legacy offtypes", () => {
    expect(hasFilterParams("why=1")).toBe(true);
    expect(hasFilterParams("?sup=8")).toBe(false);
    expect(hasFilterParams("off=")).toBe(true);
    expect(hasFilterParams("offtypes=club")).toBe(true);
  });
  it("is false for no params or only unrelated ones", () => {
    expect(hasFilterParams("")).toBe(false);
    expect(hasFilterParams("utm_source=x")).toBe(false);
  });
});

const clubs: GuideInfo[] = [
  { id: "milk", name: "Harvey Milk LGBTQ Democratic Club", type: "club" },
  { id: "toklas", name: "Alice B. Toklas LGBTQ Democratic Club", type: "club" },
  { id: "spur", name: "SPUR", type: "civic" },
  { id: "examiner", name: "San Francisco Examiner", type: "newspaper" },
];
const clubFiles = Object.fromEntries(clubs.map((g) => [g.id, { hasReasoning: true, picks: {} }])) as Record<string, PickFile>;

describe("isGuideOn and toggleGuide", () => {
  it("flips a guide by id", () => {
    expect(isGuideOn(EMPTY, "a")).toBe(true);
    expect(toggleGuide(EMPTY, "a").off).toEqual(["a"]);
    expect(isGuideOn({ ...EMPTY, off: ["a"] }, "a")).toBe(false);
    expect(toggleGuide({ ...EMPTY, off: ["a", "b"] }, "a").off).toEqual(["b"]);
  });
});

describe("typeState", () => {
  it("is on when every guide of the type is on, off when none, mixed otherwise", () => {
    expect(typeState("club", EMPTY, clubs)).toBe("on");
    expect(typeState("club", { ...EMPTY, off: ["milk"] }, clubs)).toBe("mixed");
    expect(typeState("club", { ...EMPTY, off: ["milk", "toklas"] }, clubs)).toBe("off");
  });
});

describe("setTypeGroup with all of a type on or off", () => {
  it("turns every guide of the type off when all are on, keeping other types", () => {
    expect(setTypeGroup({ ...EMPTY, off: ["spur"] }, "club", clubs, false).off).toEqual(["milk", "spur", "toklas"]);
  });
  it("turns every guide of the type on when none are on", () => {
    expect(setTypeGroup({ ...EMPTY, off: ["milk", "toklas"] }, "club", clubs, true).off).toEqual([]);
  });
});

describe("guideGroups", () => {
  it("groups published guides by type in a fixed order, with heading counts", () => {
    const g = guideGroups(clubs, clubFiles, "");
    expect(g.map((x) => [x.type, x.heading, x.label, x.count, x.guides.map((y) => y.id)])).toEqual([
      ["newspaper", "Newspapers (1)", "Newspapers", 1, ["examiner"]],
      ["club", "Political clubs (2)", "Political clubs", 2, ["milk", "toklas"]],
      ["civic", "Civic groups (1)", "Civic groups", 1, ["spur"]],
    ]);
  });
  it("leaves out guides without a published file and types with none", () => {
    const { examiner: _, ...rest } = clubFiles;
    expect(guideGroups(clubs, rest, "").map((x) => x.type)).toEqual(["club", "civic"]);
  });
  it("search matches the short name too", () => {
    const gs = [{ id: "pov", name: "San Francisco League of Pissed Off Voters", shortName: "POV", type: "club" }] as GuideInfo[];
    expect(guideGroups(gs, { pov: clubFiles.milk }, "pov").map((x) => x.guides.map((y) => y.id))).toEqual([["pov"]]);
    expect(guideGroups(gs, { pov: clubFiles.milk }, "league").map((x) => x.guides.map((y) => y.id))).toEqual([["pov"]]);
  });
  it("filters by name, case- and accent-insensitively, dropping empty groups", () => {
    expect(guideGroups(clubs, clubFiles, "MILK").map((x) => [x.type, x.guides.map((y) => y.id)])).toEqual([["club", ["milk"]]]);
    const accented = [{ id: "ce", name: "Café Coalición", type: "civic" }] as GuideInfo[];
    const f = { ce: { hasReasoning: true, picks: {} } };
    expect(guideGroups(accented, f, "cafe coalicion")[0].guides.map((y) => y.id)).toEqual(["ce"]);
    expect(guideGroups(accented, f, "Café")[0].guides.map((y) => y.id)).toEqual(["ce"]);
  });
  it("keeps the heading count at the full type size while searching", () => {
    expect(guideGroups(clubs, clubFiles, "toklas")[0].heading).toBe("Political clubs (2)");
  });
  it("returns nothing when no guide matches", () => {
    expect(guideGroups(clubs, clubFiles, "zzz")).toEqual([]);
  });
});

describe("filterQuery", () => {
  it("keeps only the params that change the filters, so selecting a contest doesn't rebuild them", () => {
    expect(filterQuery("?off=sf-gop&c=prop-b&why=1", ["c"])).toBe("off=sf-gop&why=1");
    expect(filterQuery("?c=prop-b", ["c"])).toBe(filterQuery("?c=prop-c", ["c"]));
    expect(filterQuery("", ["c"])).toBe("");
  });
});

describe("positionGuides", () => {
  it("lists the published guides with an entry for the contest, whatever the filters", () => {
    const two = { ...files, d: { hasReasoning: true, picks: { y: { pick: "Y", ranked: false, quotes: [] } } } } as Record<string, PickFile>;
    const gs = [...guides, { id: "d", name: "D", type: "civic" }] as GuideInfo[];
    expect(positionGuides("x", gs, two).map((g) => g.id)).toEqual(["a", "b"]);
    expect(positionGuides("y", gs, two).map((g) => g.id)).toEqual(["d"]);
    expect(positionGuides("z", gs, two)).toEqual([]);
  });
});

describe("contestFiles", () => {
  it("keeps only the guides with a pick on the contest, and only that pick", () => {
    const two = { ...files, d: { hasReasoning: true, picks: { y: { pick: "Y", ranked: false, quotes: [] } } } } as Record<string, PickFile>;
    expect(contestFiles("x", two)).toEqual({
      a: { hasReasoning: true, picks: { x: files.a.picks.x } },
      b: { hasReasoning: false, picks: { x: files.b.picks.x } },
    });
  });
});

describe("contestFiles archived snapshots", () => {
  it("keeps only the snapshots for this contest's quote sources", () => {
    const q = (source: string) => ({ text: "t", source });
    const f = {
      g: {
        hasReasoning: true,
        picks: { x: { pick: "Y", ranked: false, quotes: [q("https://g.org/x")] }, y: { pick: "N", ranked: false, quotes: [q("https://g.org/y")] } },
        archived: [{ source: "https://g.org/x", snapshot: "https://web.archive.org/x" }, { source: "https://g.org/y", snapshot: "https://web.archive.org/y" }],
      },
      h: { hasReasoning: true, picks: { x: { pick: "Y", ranked: false, quotes: [] } }, archived: [{ source: "https://h.org/y", snapshot: "https://web.archive.org/hy" }] },
    } as unknown as Record<string, PickFile>;
    expect(contestFiles("x", f)).toEqual({
      g: { hasReasoning: true, picks: { x: f.g.picks.x }, archived: [{ source: "https://g.org/x", snapshot: "https://web.archive.org/x" }] },
      h: { hasReasoning: true, picks: { x: f.h.picks.x } },
    });
  });
});

describe("setTypeGroup", () => {
  const gs = [{ id: "m", type: "club" }, { id: "n", type: "club" }, { id: "s", type: "civic" }] as GuideInfo[];
  it("turns every guide of the type off or on, whatever their state", () => {
    expect(setTypeGroup({ off: ["n", "s"], only: [], whyOnly: false, pins: [] }, "club", gs, false)).toEqual({ off: ["m", "n", "s"], only: [], whyOnly: false, pins: [] });
    expect(setTypeGroup({ off: ["n", "s"], only: [], whyOnly: false, pins: [] }, "club", gs, true)).toEqual({ off: ["s"], only: [], whyOnly: false, pins: [] });
  });
});

describe("revealGuides", () => {
  it("turns the given guides back on and leaves other hidden guides off", () => {
    expect(revealGuides({ off: ["a", "z"], only: [], whyOnly: false, pins: [] }, ["a", "b"], files)).toEqual({ off: ["z"], only: [], whyOnly: false, pins: [] });
  });
  it("drops the reasons-only filter only when it hides one of the given guides", () => {
    expect(revealGuides({ off: [], only: [], whyOnly: true, pins: [] }, ["a", "b"], files)).toEqual(EMPTY);
    expect(revealGuides({ off: ["b"], only: [], whyOnly: true, pins: [] }, ["a"], files)).toEqual({ off: ["b"], only: [], whyOnly: true, pins: [] });
  });
});

describe("hiddenLabel", () => {
  it("names how many guides are hidden", () => {
    expect(hiddenLabel(1)).toBe("1 guide hidden");
    expect(hiddenLabel(3)).toBe("3 guides hidden");
  });
});

describe("carryQuery", () => {
  it("keeps the filter params for a link to another page, and drops the rest", () => {
    expect(carryQuery("?off=sf-gop&c=prop-b&why=1", ["off", "offtypes", "why"])).toBe("?off=sf-gop&why=1");
    expect(carryQuery("?offtypes=club", ["off", "offtypes", "why"])).toBe("?offtypes=club");
  });
  it("is empty when there's nothing to carry", () => {
    expect(carryQuery("?c=prop-b", ["off", "why"])).toBe("");
    expect(carryQuery("", ["off"])).toBe("");
  });
});

describe("pins", () => {
  it("keep their pinned order in the query, drop repeats, and stop at MAX_PINS", () => {
    expect(toQuery({ ...EMPTY, pins: ["c", "a"] })).toBe("pin=c%2Ca");
    expect(fromQuery("pin=c,a,c").pins).toEqual(["c", "a"]);
    expect(sanitizeFilters(fromQuery("pin=gone,a,b,c,d,e"), [...guides, { id: "d" }, { id: "e" }]).pins).toEqual(["a", "b", "c", "d"].slice(0, MAX_PINS));
    expect(hasFilterParams("pin=a")).toBe(true);
  });
  it("toggles, appending a new pin last and refusing one past MAX_PINS", () => {
    const two = togglePin(togglePin(EMPTY, "b"), "a");
    expect(two.pins).toEqual(["b", "a"]);
    expect(togglePin(two, "b").pins).toEqual(["a"]);
    const full = { ...EMPTY, pins: ["a", "b", "c", "d"] };
    expect(togglePin(full, "e")).toBe(full);
  });
  it("drops pins for unknown guides and survives revealing hidden guides", () => {
    expect(sanitizeFilters({ ...EMPTY, pins: ["a", "gone"] }, guides).pins).toEqual(["a"]);
    expect(revealGuides({ off: ["a"], only: [], whyOnly: false, pins: ["a"] }, ["a"], files).pins).toEqual(["a"]);
  });
  it("lists pinned guides with a pick on the contest, in pin order, whatever is counted", () => {
    expect(pinnedPicks("x", ["b", "c", "a"], guides, files).map((p) => [p.guide.id, p.entry.pick])).toEqual([["b", "N"], ["a", "Y"]]);
    expect(pinnedPicks("nope", ["a"], guides, files)).toEqual([]);
  });
});
