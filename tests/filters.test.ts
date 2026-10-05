import { describe, expect, it } from "vitest";
import {
  activeEntries, countedLabel, districtOptions, filterSummary, fromQuery, guideTypeOptions, hasFilterParams,
  isGuideOn, sanitizeFilters, toggleGuide, toggleType, toQuery, visibleContest, pendingGuides, EMPTY,
} from "@/lib/filters";
import type { Ballot, Contest, EndorsementFile, Guide } from "@/lib/schema";

const guides = [
  { id: "a", type: "advocacy" }, { id: "b", type: "club" }, { id: "c", type: "newspaper" },
] as Guide[];
const ends = {
  a: { status: "published", hasReasoning: true, picks: { x: { pick: "Y", ranked: false, quotes: [] } } },
  b: { status: "published", hasReasoning: false, picks: { x: { pick: "N", ranked: false, quotes: [] } } },
  c: { status: "pending", hasReasoning: true, picks: {} },
} as unknown as Record<string, EndorsementFile>;

describe("filters", () => {
  it("round-trips through the query string", () => {
    const f = { off: ["b"], offTypes: ["union"], whyOnly: true, districts: { Supervisor: "8" } };
    expect(fromQuery(toQuery(f))).toEqual(f);
  });
  it("excludes pending, off, off-type and list-only guides", () => {
    const base = { off: [], offTypes: [], whyOnly: false, districts: {} };
    expect(activeEntries("x", guides, ends, base).map((r) => r.guide.id)).toEqual(["a", "b"]);
    expect(activeEntries("x", guides, ends, { ...base, whyOnly: true }).map((r) => r.guide.id)).toEqual(["a"]);
    expect(activeEntries("x", guides, ends, { ...base, offTypes: ["advocacy"] }).map((r) => r.guide.id)).toEqual(["b"]);
  });
  it("excludes guides turned off by id", () => {
    const f = { ...EMPTY, off: ["a"] };
    expect(activeEntries("x", guides, ends, f).map((r) => r.guide.id)).toEqual(["b"]);
  });
  it("skips guides with no file or no entry for the contest", () => {
    expect(activeEntries("nope", guides, ends, EMPTY)).toEqual([]);
    expect(activeEntries("x", guides, {}, EMPTY)).toEqual([]);
  });
  it("hides district contests that don't match the chosen district", () => {
    const c = { jurisdiction: { level: "district", name: "Supervisor", district: "2" } } as Contest;
    expect(visibleContest(c, { districts: {} })).toBe(true);
    expect(visibleContest(c, { districts: { Supervisor: "8" } })).toBe(false);
  });
  it("shows district contests matching the chosen district", () => {
    const c = { jurisdiction: { level: "district", name: "Supervisor", district: "8" } } as Contest;
    expect(visibleContest(c, { districts: { Supervisor: "8" } })).toBe(true);
  });
  it("ignores districts for non-district contests and unset district names", () => {
    const st = { jurisdiction: { level: "state", name: "California" } } as Contest;
    const city = { jurisdiction: { level: "city", name: "San Francisco" } } as Contest;
    const ad = { jurisdiction: { level: "district", name: "Assembly", district: "17" } } as Contest;
    const d = { districts: { Supervisor: "8" } };
    expect(visibleContest(st, d)).toBe(true);
    expect(visibleContest(city, d)).toBe(true);
    expect(visibleContest(ad, d)).toBe(true);
  });
  it("keeps district values not on the ballot as-is", () => {
    expect(fromQuery("sup=99").districts).toEqual({ Supervisor: "99" });
  });
  it("EMPTY round-trips to empty string and back", () => {
    expect(toQuery(EMPTY)).toBe("");
    expect(fromQuery("")).toEqual(EMPTY);
  });
  it("parses the documented URL format", () => {
    expect(fromQuery("?off=pov,sf-dems&offtypes=club&why=1&sup=8&ad=17&cd=11&bart=8")).toEqual({
      off: ["pov", "sf-dems"], offTypes: ["club"], whyOnly: true,
      districts: { Supervisor: "8", Assembly: "17", Congress: "11", BART: "8" },
    });
  });
  it("ignores unknown params and empty values", () => {
    expect(fromQuery("foo=1&utm_source=x&off=")).toEqual(EMPTY);
    expect(fromQuery("off=").off).toEqual([]);
    expect(fromQuery("why=0").whyOnly).toBe(false);
  });
  it("dedupes ids", () => {
    expect(fromQuery("off=a,b,a&offtypes=club,club").off).toEqual(["a", "b"]);
    expect(fromQuery("off=a,b,a&offtypes=club,club").offTypes).toEqual(["club"]);
    expect(toQuery({ ...EMPTY, off: ["a", "a"] })).toBe("off=a");
  });
  it("produces deterministic output with sorted lists", () => {
    const a = toQuery({ off: ["z", "a"], offTypes: ["union", "club"], whyOnly: true, districts: { BART: "8", Supervisor: "2" } });
    const b = toQuery({ off: ["a", "z"], offTypes: ["club", "union"], whyOnly: true, districts: { Supervisor: "2", BART: "8" } });
    expect(a).toBe(b);
    expect(a).toBe("off=a%2Cz&offtypes=club%2Cunion&why=1&sup=2&bart=8");
  });
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
  it("leaves out district types with no contests and types without a URL param", () => {
    const opts = districtOptions(ballot);
    expect(opts).not.toHaveProperty("Congress");
    expect(opts).not.toHaveProperty("Board of Equalization");
  });
  it("dedupes repeated districts", () => {
    expect(districtOptions({ contests: [dc("Supervisor", "8"), dc("Supervisor", "8")] } as Ballot)).toEqual({ Supervisor: ["8"] });
  });
});

describe("sanitizeFilters", () => {
  it("keeps known guide ids, types and districts", () => {
    const f = { off: ["a"], offTypes: ["club"], whyOnly: true, districts: { Supervisor: "8" } };
    expect(sanitizeFilters(f, ballot, guides)).toEqual(f);
  });
  it("drops unknown guide ids, unknown types and districts not on the ballot", () => {
    const f = {
      off: ["a", "nope"], offTypes: ["club", "cult"], whyOnly: false,
      districts: { Supervisor: "99", Assembly: "17", Congress: "11", Mars: "1" },
    };
    expect(sanitizeFilters(f, ballot, guides)).toEqual({ off: ["a"], offTypes: ["club"], whyOnly: false, districts: { Assembly: "17" } });
  });
  it("keeps a known type even when no current guide has it", () => {
    expect(sanitizeFilters({ ...EMPTY, offTypes: ["union"] }, ballot, guides).offTypes).toEqual(["union"]);
  });
});

describe("filterSummary", () => {
  const gs = [...guides, { id: "d", type: "union" }] as Guide[];
  const all = { ...ends, d: { status: "published", hasReasoning: true, picks: {} } } as unknown as Record<string, EndorsementFile>;
  it("counts published guides; all counted with no filters", () => {
    expect(filterSummary(EMPTY, gs, all)).toEqual({ counted: 3, published: 3 });
  });
  it("subtracts guides turned off by id, type, or list-only", () => {
    expect(filterSummary({ ...EMPTY, off: ["a"] }, gs, all)).toEqual({ counted: 2, published: 3 });
    expect(filterSummary({ ...EMPTY, offTypes: ["union", "club"] }, gs, all)).toEqual({ counted: 1, published: 3 });
    expect(filterSummary({ ...EMPTY, whyOnly: true }, gs, all)).toEqual({ counted: 2, published: 3 });
  });
  it("ignores pending guides even when they are turned off", () => {
    expect(filterSummary({ ...EMPTY, off: ["c"] }, gs, all)).toEqual({ counted: 3, published: 3 });
  });
});

describe("countedLabel", () => {
  it("reads N of M guides counted", () => {
    expect(countedLabel({ counted: 5, published: 7 })).toBe("5 of 7 guides counted");
    expect(countedLabel({ counted: 1, published: 1 })).toBe("1 of 1 guide counted");
  });
});

describe("hasFilterParams", () => {
  it("is true when any filter param is present, even empty-valued", () => {
    expect(hasFilterParams("why=1")).toBe(true);
    expect(hasFilterParams("?sup=8")).toBe(true);
    expect(hasFilterParams("off=")).toBe(true);
  });
  it("is false for no params or only unrelated ones", () => {
    expect(hasFilterParams("")).toBe(false);
    expect(hasFilterParams("utm_source=x")).toBe(false);
  });
});

describe("guideTypeOptions", () => {
  it("lists types of published guides in a fixed order with plural labels", () => {
    const gs = [{ id: "u", type: "union" }, ...guides, { id: "p", type: "party" }] as Guide[];
    const all = {
      ...ends,
      u: { status: "published" }, p: { status: "published" },
    } as unknown as Record<string, EndorsementFile>;
    expect(guideTypeOptions(gs, all)).toEqual([
      { type: "party", label: "Parties" },
      { type: "club", label: "Political clubs" },
      { type: "union", label: "Unions" },
      { type: "advocacy", label: "Advocacy groups" },
    ]);
  });
});

describe("guide and type toggles", () => {
  const gs = [{ id: "a", type: "club" }, { id: "b", type: "club" }, { id: "c", type: "union" }] as Guide[];
  it("a guide is on unless turned off by id or by type", () => {
    expect(isGuideOn(EMPTY, gs[0])).toBe(true);
    expect(isGuideOn({ ...EMPTY, off: ["a"] }, gs[0])).toBe(false);
    expect(isGuideOn({ ...EMPTY, offTypes: ["club"] }, gs[0])).toBe(false);
  });
  it("toggleGuide flips a guide by id", () => {
    expect(toggleGuide(EMPTY, gs[0], gs).off).toEqual(["a"]);
    expect(toggleGuide({ ...EMPTY, off: ["a"] }, gs[0], gs).off).toEqual([]);
  });
  it("turning on a guide whose type is off turns the type on and keeps its siblings off", () => {
    const f = toggleGuide({ ...EMPTY, offTypes: ["club"] }, gs[0], gs);
    expect(f.offTypes).toEqual([]);
    expect(f.off).toEqual(["b"]);
    expect(gs.map((g) => isGuideOn(f, g))).toEqual([true, false, true]);
  });
  it("toggleType turns a type off, and back on with all its guides", () => {
    const off = toggleType({ ...EMPTY, off: ["a", "c"] }, "club", gs);
    expect(off).toEqual({ ...EMPTY, off: ["a", "c"], offTypes: ["club"] });
    const on = toggleType(off, "club", gs);
    expect(on).toEqual({ ...EMPTY, off: ["c"], offTypes: [] });
  });
});
