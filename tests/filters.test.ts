import { describe, expect, it } from "vitest";
import {
  activeEntries, countedLabel, districtOptions, districtSelect, filterSummary, fromQuery, guideGroups, hasFilterParams,
  initialFilters, isGuideOn, publishedFiles, sanitizeFilters, setDistrict, toggleGuide, toggleTypeGroup, toQuery,
  typeState, visibleContest, pendingGuides, EMPTY,
  type GuideInfo, type PickFile,
} from "@/lib/filters";
import type { Ballot, Contest, EndorsementFile, Guide } from "@/lib/schema";

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
    const f = { off: ["b"], whyOnly: true, districts: { Supervisor: "8" } };
    expect(fromQuery(toQuery(f))).toEqual(f);
  });
  it("EMPTY round-trips to empty string and back", () => {
    expect(toQuery(EMPTY)).toBe("");
    expect(fromQuery("")).toEqual(EMPTY);
  });
  it("parses the documented URL format", () => {
    expect(fromQuery("?off=pov,sf-dems&why=1&sup=8&ad=17&cd=11&bart=8")).toEqual({
      off: ["pov", "sf-dems"], whyOnly: true,
      districts: { Supervisor: "8", Assembly: "17", Congress: "11", BART: "8" },
    });
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
  it("keeps district values not on the ballot as-is (sanitize drops them)", () => {
    expect(fromQuery("sup=99").districts).toEqual({ Supervisor: "99" });
  });
  it("dedupes ids", () => {
    expect(fromQuery("off=a,b,a").off).toEqual(["a", "b"]);
    expect(toQuery({ ...EMPTY, off: ["a", "a"] })).toBe("off=a");
  });
  it("produces deterministic output with sorted lists and no offtypes", () => {
    const a = toQuery({ off: ["z", "a"], whyOnly: true, districts: { BART: "8", Supervisor: "2" } });
    const b = toQuery({ off: ["a", "z"], whyOnly: true, districts: { Supervisor: "2", BART: "8" } });
    expect(a).toBe(b);
    expect(a).toBe("off=a%2Cz&why=1&sup=2&bart=8");
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

describe("visibleContest", () => {
  it("hides district contests that don't match the chosen district", () => {
    const c = { jurisdiction: { level: "district", name: "Supervisor", district: "2" } } as Contest;
    expect(visibleContest(c, { districts: {} })).toBe(true);
    expect(visibleContest(c, { districts: { Supervisor: "8" } })).toBe(false);
  });
  it("shows matching district contests and ignores non-district ones", () => {
    const d8 = { jurisdiction: { level: "district", name: "Supervisor", district: "8" } } as Contest;
    const st = { jurisdiction: { level: "state", name: "California" } } as Contest;
    const ad = { jurisdiction: { level: "district", name: "Assembly", district: "17" } } as Contest;
    const d = { districts: { Supervisor: "8" } };
    expect(visibleContest(d8, d)).toBe(true);
    expect(visibleContest(st, d)).toBe(true);
    expect(visibleContest(ad, d)).toBe(true);
  });
});

describe("pendingGuides", () => {
  it("lists pending guides: no file or status pending", () => {
    expect(pendingGuides(guides, ends).map((g) => g.id)).toEqual(["c"]);
    expect(pendingGuides(guides, { a: ends.a }).map((g) => g.id)).toEqual(["b", "c"]);
  });
});

const dc = (name: string, district: string) =>
  ({ id: `${name}-${district}`.toLowerCase(), jurisdiction: { level: "district", name, district } }) as Contest;
const ballot = {
  contests: [
    { id: "gov", jurisdiction: { level: "state", name: "California" } } as Contest,
    dc("Supervisor", "10"), dc("Supervisor", "2"), dc("Supervisor", "8"),
    dc("Assembly", "19"), dc("Assembly", "17"),
    dc("BART", "8"),
    dc("Board of Equalization", "2"),
  ],
} as Ballot;

describe("districtOptions", () => {
  it("lists districts on the ballot per filterable district type, numerically sorted", () => {
    expect(districtOptions(ballot)).toEqual({ Supervisor: ["2", "8", "10"], Assembly: ["17", "19"], BART: ["8"] });
  });
  it("dedupes repeated districts", () => {
    expect(districtOptions({ contests: [dc("Supervisor", "8"), dc("Supervisor", "8")] } as Ballot)).toEqual({ Supervisor: ["8"] });
  });
});

describe("districtSelect", () => {
  it("gives each district type an 'All' item plus one item per district", () => {
    expect(districtSelect({ contests: [dc("Supervisor", "8"), dc("Supervisor", "2"), dc("BART", "8")] } as Ballot)).toEqual([
      { name: "Supervisor", items: [{ value: null, label: "All" }, { value: "2", label: "District 2" }, { value: "8", label: "District 8" }] },
      { name: "BART", items: [{ value: null, label: "All" }, { value: "8", label: "District 8" }] },
    ]);
  });
});

describe("setDistrict", () => {
  it("sets a district and clears it with null, leaving others", () => {
    const f = setDistrict({ ...EMPTY, districts: { BART: "8" } }, "Supervisor", "8");
    expect(f.districts).toEqual({ BART: "8", Supervisor: "8" });
    expect(setDistrict(f, "Supervisor", null).districts).toEqual({ BART: "8" });
  });
});

const info: GuideInfo[] = [
  { id: "a", name: "A", type: "advocacy" }, { id: "b", name: "B", type: "club" },
];

describe("sanitizeFilters", () => {
  it("keeps known guide ids and districts", () => {
    const f = { off: ["a"], whyOnly: true, districts: { Supervisor: "8" } };
    expect(sanitizeFilters(f, ballot, info)).toEqual(f);
  });
  it("drops unknown guide ids and districts not on the ballot", () => {
    const f = { off: ["a", "nope"], whyOnly: false, districts: { Supervisor: "99", Assembly: "17", Congress: "11", Mars: "1" } };
    expect(sanitizeFilters(f, ballot, info)).toEqual({ off: ["a"], whyOnly: false, districts: { Assembly: "17" } });
  });
});

describe("initialFilters", () => {
  it("prefers filter params in the URL over stored filters", () => {
    expect(initialFilters({ query: "why=1", stored: "off=a", ballot, guides: info })).toEqual({ ...EMPTY, whyOnly: true });
  });
  it("uses stored filters when the URL has no filter params", () => {
    expect(initialFilters({ query: "utm_source=x", stored: "off=a&sup=8", ballot, guides: info })).toEqual({
      ...EMPTY, off: ["a"], districts: { Supervisor: "8" },
    });
  });
  it("is EMPTY with nothing in the URL or storage", () => {
    expect(initialFilters({ query: "", stored: null, ballot, guides: info })).toEqual(EMPTY);
  });
  it("sanitizes and expands legacy offtypes", () => {
    expect(initialFilters({ query: "offtypes=club&off=zzz", stored: null, ballot, guides: info }).off).toEqual(["b"]);
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
    expect(hasFilterParams("?sup=8")).toBe(true);
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

describe("toggleTypeGroup", () => {
  it("turns every guide of the type off when all are on", () => {
    expect(toggleTypeGroup({ ...EMPTY, off: ["spur"] }, "club", clubs).off).toEqual(["milk", "spur", "toklas"]);
  });
  it("turns every guide of the type on when some or none are on", () => {
    expect(toggleTypeGroup({ ...EMPTY, off: ["milk", "spur"] }, "club", clubs).off).toEqual(["spur"]);
    expect(toggleTypeGroup({ ...EMPTY, off: ["milk", "toklas"] }, "club", clubs).off).toEqual([]);
  });
});

describe("guideGroups", () => {
  it("groups published guides by type in a fixed order, with heading counts", () => {
    const g = guideGroups(clubs, clubFiles, "");
    expect(g.map((x) => [x.type, x.heading, x.guides.map((y) => y.id)])).toEqual([
      ["newspaper", "Newspapers (1)", ["examiner"]],
      ["club", "Political clubs (2)", ["milk", "toklas"]],
      ["civic", "Civic groups (1)", ["spur"]],
    ]);
  });
  it("leaves out guides without a published file and types with none", () => {
    const { examiner: _, ...rest } = clubFiles;
    expect(guideGroups(clubs, rest, "").map((x) => x.type)).toEqual(["club", "civic"]);
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
