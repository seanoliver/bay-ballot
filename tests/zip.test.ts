import { describe, expect, it } from "vitest";
import { buildZipTable } from "@/pipeline/zips";
import { zipFit, zipGroups, type ZipPlaces } from "@/lib/zip";
import type { PlaceGroup } from "@/lib/areas";
import { c, prop1, propB, rep15, rtm, smL, sup8 } from "./fixtures/areas";

const SF: ZipPlaces = { counties: ["San Francisco"], places: { "San Francisco": "full" } };
const EDGE: ZipPlaces = { counties: ["San Mateo", "Santa Clara"], places: { "Menlo Park": "partial", "Palo Alto": "partial" } };

describe("zipFit", () => {
  it("puts statewide contests on every ballot", () => {
    expect(zipFit(prop1.jurisdiction, SF)).toBe("on");
  });
  it("puts a county contest on the ballot only in that county, and only maybe when the ZIP spans counties", () => {
    expect(zipFit(smL.jurisdiction, SF)).toBe("off");
    expect(zipFit(smL.jurisdiction, EDGE)).toBe("maybe");
  });
  it("puts a city contest on the ballot when the ZIP lies inside the city, maybe when it overlaps it", () => {
    expect(zipFit(propB.jurisdiction, SF)).toBe("on");
    expect(zipFit(c("menlo-park-measure-p", { level: "city", name: "Menlo Park" }).jurisdiction, EDGE)).toBe("maybe");
    expect(zipFit(c("redwood-city-measure-x", { level: "city", name: "Redwood City" }).jurisdiction, EDGE)).toBe("off");
  });
  it("makes a district maybe when the ZIP touches a place it lists, and off when it touches none", () => {
    expect(zipFit(sup8.jurisdiction, SF)).toBe("maybe");
    expect(zipFit(rep15.jurisdiction, SF)).toBe("maybe");
    const pausd = c("pausd-trustee", { level: "district", name: "Palo Alto Unified School District", district: "at-large", within: [{ level: "city", name: "Palo Alto" }] });
    expect(zipFit(pausd.jurisdiction, EDGE)).toBe("maybe");
    expect(zipFit(pausd.jurisdiction, SF)).toBe("off");
  });
  it("puts a countywide region measure on the ballot when every county the ZIP is in votes on it", () => {
    expect(zipFit(rtm.jurisdiction, SF)).toBe("on");
    expect(zipFit(rtm.jurisdiction, EDGE)).toBe("on");
    expect(zipFit(rtm.jurisdiction, { counties: ["Marin"], places: {} })).toBe("off");
  });
});

describe("zipGroups", () => {
  it("keeps on and maybe contests, counts the hidden ones, and drops emptied sections and groups", () => {
    const groups: PlaceGroup[] = [
      { key: "ca", heading: "California", county: null, sections: [{ name: "Measures", contests: [prop1] }] },
      { key: "sm", heading: "San Mateo County", county: "San Mateo", sections: [{ name: "Local measures", contests: [smL] }] },
      { key: "sf", heading: "San Francisco", county: "San Francisco", sections: [{ name: "Local measures", contests: [propB] }, { name: "Local candidates", contests: [sup8] }] },
    ];
    const v = zipGroups(groups, SF);
    expect(v.groups.map((g) => g.key)).toEqual(["ca", "sf"]);
    expect(v.groups[1].sections.map((s) => s.name)).toEqual(["Local measures", "Local candidates"]);
    expect([v.on, [...v.maybe], v.hidden]).toEqual([2, ["supervisor-8"], 1]);
  });
});

const COUNTY_HEAD = "GEOID_ZCTA5_20|AREALAND_ZCTA5_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART";
const PLACE_HEAD = "GEOID_ZCTA5_20|AREALAND_ZCTA5_20|GEOID_PLACE_20|NAMELSAD_PLACE_20|CLASSFP_PLACE_20|AREALAND_PART";

describe("buildZipTable", () => {
  const countyText = [
    COUNTY_HEAD,
    "94025|1000|06081|San Mateo County|900",
    "94025|1000|06085|Santa Clara County|100",
    "94040|1000|06085|Santa Clara County|1000",
    "94040|1000|06081|San Mateo County|5",
    "10001|1000|36061|New York County|1000",
    "|0|06081|San Mateo County|0",
  ].join("\n");
  const placeText = [
    "﻿" + PLACE_HEAD,
    "94025|1000|0646870|Menlo Park city|C1|600",
    "94025|1000|0655282|Palo Alto city|C1|5",
    "94040|1000|0649670|Mountain View city|C1|995",
    "94040|1000|0649672|Mountain View CDP|U1|5",
    "94040|1000|0612345|Los Altos city|C1|500",
  ].join("\n");
  const table = buildZipTable({
    countyText,
    placeText,
    counties: { "06081": "San Mateo", "06085": "Santa Clara" },
    places: new Set(["Menlo Park", "Palo Alto", "Mountain View"]),
  });
  it("keeps only ZIPs in the given counties, dropping slivers under 1%", () => {
    expect(Object.keys(table)).toEqual(["94025", "94040"]);
    expect(table["94025"].counties).toEqual(["San Mateo", "Santa Clara"]);
    expect(table["94040"].counties).toEqual(["Santa Clara"]);
  });
  it("marks a place full at 99% of the ZIP's land, partial above 1%, and keeps only places the ballot names", () => {
    expect(table["94025"].places).toEqual({ "Menlo Park": "partial" });
    expect(table["94040"].places).toEqual({ "Mountain View": "full" });
  });
});

describe("the committed ZIP table", () => {
  it("covers every city the ballot names, so a new city can't be hidden from every ZIP (rerun npm run bb -- zips)", async () => {
    const { loadElection } = await import("@/lib/data");
    const { default: zips } = await import("@/data/zips.json");
    const d = loadElection("data", "2026-11");
    const named = new Set(d.ballot.contests.flatMap((x) => [x.jurisdiction, ...(x.jurisdiction.within ?? [])]).filter((p) => p.level === "city").map((p) => p.name));
    const covered = new Set(Object.values(zips as Record<string, ZipPlaces>).flatMap((z) => Object.keys(z.places)));
    expect([...named].filter((n) => !covered.has(n))).toEqual([]);
  });
});
