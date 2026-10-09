import path from "node:path";
import { describe, expect, it } from "vitest";
import { areaLinks } from "@/lib/areas";
import { COUNTY_SHAPES } from "@/lib/county-shapes";
import { loadElection } from "@/lib/data";

describe("COUNTY_SHAPES", () => {
  it("has an outline for every county chip", () => {
    const { areas } = loadElection(path.join(process.cwd(), "data"), "2026-11");
    const [, ...counties] = areaLinks("2026-11", areas, null);
    expect(counties.length).toBeGreaterThan(0);
    expect(counties.map((l) => l.label).filter((l) => !COUNTY_SHAPES[l])).toEqual([]);
  });
});
