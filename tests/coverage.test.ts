import path from "node:path";
import { describe, expect, it } from "vitest";
import { areaCounties } from "@/lib/areas";
import { areaBallotLinks, coverage, coverageSentence } from "@/lib/coverage";
import { loadElection } from "@/lib/data";
import { publishedGuides } from "@/lib/filters";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

describe("coverage", () => {
  it("counts areas, their counties, published guides and contests", () => {
    expect(coverage(d)).toEqual({
      areas: d.areas.length,
      counties: areaCounties(d.areas).length,
      guides: publishedGuides(d.guides, d.endorsements).length,
      contests: d.ballot.contests.length,
    });
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
