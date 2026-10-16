import path from "node:path";
import { describe, expect, it } from "vitest";
import { areaBallotLinks, coverage, coverageSentence } from "@/lib/coverage";
import { loadElection, type ElectionData } from "@/lib/data";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

describe("coverage", () => {
  it("counts areas, their counties, published guides and contests", () => {
    const area = (id: string, county?: string) => ({ id, jurisdictions: county ? [{ level: "county", name: county }] : [] });
    const fixture = {
      areas: [area("sf", "San Francisco"), area("oakland", "Alameda"), area("berkeley", "Alameda"), area("bay-area")],
      guides: [{ id: "a" }, { id: "b" }, { id: "c" }],
      endorsements: { a: { status: "published" }, b: { status: "pending" } },
      ballot: { contests: [{ id: "x" }, { id: "y" }] },
    } as unknown as ElectionData;
    expect(coverage(fixture)).toEqual({ areas: 4, counties: 2, guides: 1, contests: 2 });
  });

  it("counts a county once however many areas sit in it", () => {
    const c = coverage(d);
    expect(c.counties).toBeGreaterThan(0);
    expect(c.counties).toBeLessThan(c.areas);
  });
});

describe("coverageSentence", () => {
  it("joins the counts", () => {
    expect(coverageSentence({ areas: 14, counties: 9, guides: 128, contests: 546 })).toBe("14 areas across 9 counties, 128 guides and 546 contests.");
  });

  it("uses the plural for zero", () => {
    expect(coverageSentence({ areas: 0, counties: 0, guides: 0, contests: 0 })).toBe("0 areas across 0 counties, 0 guides and 0 contests.");
  });

  it("uses the singular for one", () => {
    expect(coverageSentence({ areas: 1, counties: 1, guides: 1, contests: 1 })).toBe("1 area across 1 county, 1 guide and 1 contest.");
  });
});

describe("areaBallotLinks", () => {
  it("links every area to its ballot page, in data order", () => {
    const links = areaBallotLinks(d);
    expect(links.map((l) => l.label)).toEqual(d.areas.map((a) => a.name));
    expect(links[0]).toEqual({ href: `/2026-11/${d.areas[0].id}`, label: d.areas[0].name });
  });
});
