import { describe, expect, it } from "vitest";
import {
  filterQuery, carryQuery, contestFiles, setTypeGroup, hiddenLabel, positionGuides, revealGuides,
  activeEntries, countedLabel, filterSummary, fromQuery, guideGroups, hasFilterParams,
  initialFilters, isGuideOn, publishedFiles, sanitizeFilters, toggleGuide, toQuery,
  typeState, pendingGuides, EMPTY,
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
    const f = { off: ["b"], whyOnly: true };
    expect(fromQuery(toQuery(f))).toEqual(f);
  });
  it("EMPTY round-trips to empty string and back", () => {
    expect(toQuery(EMPTY)).toBe("");
    expect(fromQuery("")).toEqual(EMPTY);
  });
  it("parses the documented URL format", () => {
    expect(fromQuery("?off=pov,sf-dems&why=1")).toEqual({ off: ["pov", "sf-dems"], whyOnly: true });
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
    expect(f).toEqual({ off: ["a"], whyOnly: false });
    expect(toQuery(f)).toBe("off=a");
  });
  it("dedupes ids", () => {
    expect(fromQuery("off=a,b,a").off).toEqual(["a", "b"]);
    expect(toQuery({ ...EMPTY, off: ["a", "a"] })).toBe("off=a");
  });
  it("produces deterministic output with sorted lists and no offtypes", () => {
    const a = toQuery({ off: ["z", "a"], whyOnly: true });
    const b = toQuery({ off: ["a", "z"], whyOnly: true });
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
    expect(activeEntries("x", guides, files, { ...EMPTY, whyOnly: true }).map((r) => r.guide.id)).toEqual(["a"]);
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
    const f = { off: ["a"], whyOnly: true };
    expect(sanitizeFilters(f, info)).toEqual(f);
  });
  it("drops unknown guide ids", () => {
    expect(sanitizeFilters({ off: ["a", "nope"], whyOnly: false }, info)).toEqual({ off: ["a"], whyOnly: false });
  });
});

describe("initialFilters", () => {
  it("prefers filter params in the URL over stored filters", () => {
    expect(initialFilters({ query: "why=1", stored: "off=a", guides: info })).toEqual({ ...EMPTY, whyOnly: true });
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

describe("filterSummary and countedLabel", () => {
  it("counts published guides; subtracts off and list-only", () => {
    expect(filterSummary(EMPTY, guides, files)).toEqual({ counted: 2, published: 2 });
    expect(filterSummary({ ...EMPTY, off: ["a"] }, guides, files)).toEqual({ counted: 1, published: 2 });
    expect(filterSummary({ ...EMPTY, whyOnly: true }, guides, files)).toEqual({ counted: 1, published: 2 });
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
    expect(setTypeGroup({ off: ["n", "s"], whyOnly: false }, "club", gs, false)).toEqual({ off: ["m", "n", "s"], whyOnly: false });
    expect(setTypeGroup({ off: ["n", "s"], whyOnly: false }, "club", gs, true)).toEqual({ off: ["s"], whyOnly: false });
  });
});

describe("revealGuides", () => {
  it("turns the given guides back on and leaves other hidden guides off", () => {
    expect(revealGuides({ off: ["a", "z"], whyOnly: false }, ["a", "b"], files)).toEqual({ off: ["z"], whyOnly: false });
  });
  it("drops the reasons-only filter only when it hides one of the given guides", () => {
    expect(revealGuides({ off: [], whyOnly: true }, ["a", "b"], files)).toEqual(EMPTY);
    expect(revealGuides({ off: ["b"], whyOnly: true }, ["a"], files)).toEqual({ off: ["b"], whyOnly: true });
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
