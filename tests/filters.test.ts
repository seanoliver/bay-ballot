import { describe, expect, it } from "vitest";
import { activeEntries, fromQuery, toQuery, visibleContest, pendingGuides, EMPTY } from "@/lib/filters";
import type { Contest, EndorsementFile, Guide } from "@/lib/schema";

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
