import { describe, expect, it } from "vitest";
import { buildZipTable, zipTableJson } from "@/pipeline/zips";
import { zipFit, zipGroups, type ZipPlaces, type ZipTable } from "@/lib/zip";
import type { PlaceGroup } from "@/lib/areas";
import { c, prop1, propB, rep15, rtm, smL, sup8 } from "./fixtures/areas";

const cityCounty = { "San Francisco": "San Francisco", "Menlo Park": "San Mateo", "Redwood City": "San Mateo", "Palo Alto": "Santa Clara", "Los Altos Hills": "Santa Clara" };
const fit = (x: { jurisdiction: Parameters<typeof zipFit>[0] }, z: ZipPlaces, home: string | null = null) => zipFit(x.jurisdiction, z, { home, cityCounty });

const SF: ZipPlaces = { counties: ["San Francisco"], places: { "San Francisco": "full" } };
const EDGE: ZipPlaces = { counties: ["San Mateo", "Santa Clara"], places: { "Menlo Park": "partial", "Palo Alto": "partial" } };
// Stanford: in Santa Clara County, in no city on the ballot.
const STANFORD: ZipPlaces = { counties: ["Santa Clara"], places: {} };
const DAVIS: ZipPlaces = { counties: ["Solano"], outside: ["Yolo"], places: {} };
const pausd = c("pausd-trustee", { level: "district", name: "Palo Alto Unified School District", district: "at-large", within: [{ level: "city", name: "Palo Alto" }, { level: "city", name: "Los Altos Hills" }] });
const paCouncil = c("palo-alto-council", { level: "city", name: "Palo Alto" });
const rcCouncil2 = c("redwood-city-council-2", { level: "district", name: "City Council", district: "2", within: [{ level: "city", name: "Redwood City" }] });

describe("zipFit", () => {
  it("puts statewide contests on every ballot", () => {
    expect(fit(prop1, SF)).toBe("on");
    expect(fit(prop1, DAVIS)).toBe("on");
  });
  it("puts a county contest on only when the whole ZIP is in that county", () => {
    expect(fit(smL, SF)).toBe("off");
    expect(fit(smL, EDGE)).toBe("maybe");
    const solanoMeasure = c("solano-measure-x", { level: "county", name: "Solano" });
    expect(fit(solanoMeasure, DAVIS)).toBe("maybe");
  });
  it("puts a city contest on when the ZIP lies inside the city, maybe when it overlaps, off when it doesn't touch it", () => {
    expect(fit(propB, SF)).toBe("on");
    expect(fit(paCouncil, EDGE)).toBe("maybe");
    expect(fit(paCouncil, STANFORD)).toBe("off");
  });
  it("never rules out a district because the ZIP misses the cities it lists: the list leaves out unincorporated land", () => {
    expect(fit(pausd, STANFORD, "Santa Clara")).toBe("maybe");
    expect(fit(pausd, EDGE)).toBe("maybe");
  });
  it("rules out a district only when none of its counties holds the ZIP", () => {
    expect(fit(pausd, SF)).toBe("off");
    expect(fit(sup8, SF, "San Francisco")).toBe("maybe");
    expect(fit(rep15, SF)).toBe("maybe");
    expect(fit(rep15, STANFORD)).toBe("off");
  });
  it("rules out a council district when the ZIP doesn't touch its city", () => {
    expect(fit(rcCouncil2, EDGE, "San Mateo")).toBe("off");
    expect(fit(rcCouncil2, { counties: ["San Mateo"], places: { "Redwood City": "partial" } }, "San Mateo")).toBe("maybe");
  });
  it("keeps a district whose city has no known county as maybe", () => {
    const odd = c("x", { level: "district", name: "Water", district: "1", within: [{ level: "city", name: "Atlantis" }] });
    expect(fit(odd, SF)).toBe("maybe");
  });
  it("puts a countywide region measure on when every county the ZIP is in votes on it", () => {
    expect(fit(rtm, SF)).toBe("on");
    expect(fit(rtm, EDGE)).toBe("on");
    expect(fit(rtm, { counties: ["Marin"], places: {} })).toBe("off");
    expect(fit(rtm, { counties: ["San Francisco"], outside: ["Yolo"], places: {} })).toBe("maybe");
  });
});

describe("zipGroups", () => {
  it("keeps on and maybe contests, counts the hidden ones, and drops emptied sections and groups", () => {
    const groups: PlaceGroup[] = [
      { key: "ca", heading: "California", county: null, sections: [{ name: "Measures", contests: [prop1] }] },
      { key: "sm", heading: "San Mateo County", county: "San Mateo", sections: [{ name: "Local measures", contests: [smL] }] },
      { key: "sf", heading: "San Francisco", county: "San Francisco", sections: [{ name: "Local measures", contests: [propB] }, { name: "Local candidates", contests: [sup8] }] },
    ];
    const v = zipGroups(groups, SF, { cityCounty });
    expect(v.groups.map((g) => g.key)).toEqual(["ca", "sf"]);
    expect(v.groups[1].sections.map((s) => s.name)).toEqual(["Local measures", "Local candidates"]);
    expect([v.on, v.maybe, v.hidden]).toEqual([2, 1, 1]);
    expect(v.fit.get("san-mateo-county-measure-l")).toBe("off");
  });
  it("uses the group's county for a district that lists only cities", () => {
    const groups: PlaceGroup[] = [{ key: "scc", heading: "Santa Clara County", county: "Santa Clara", sections: [{ name: "Schools", contests: [pausd] }] }];
    expect(zipGroups(groups, STANFORD, { cityCounty: {} }).fit.get("pausd-trustee")).toBe("maybe");
  });
});

const COUNTY_HEAD = "GEOID_ZCTA5_20|AREALAND_ZCTA5_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART";
const PLACE_HEAD = "GEOID_ZCTA5_20|AREALAND_ZCTA5_20|GEOID_PLACE_20|NAMELSAD_PLACE_20|CLASSFP_PLACE_20|AREALAND_PART";

describe("buildZipTable", () => {
  const countyText = [
    COUNTY_HEAD,
    "94025|1000|06081|San Mateo County|995",
    "94025|1000|06085|Santa Clara County|5",
    "94040|1000|06085|Santa Clara County|1000",
    "95616|1000|06095|Solano County|100",
    "95616|1000|06113|Yolo County|900",
    "10001|1000|36061|New York County|1000",
    "94099|1000|06081|San Mateo County|0",
    "|0|06081|San Mateo County|0",
  ].join("\n");
  const placeText = [
    "﻿" + PLACE_HEAD,
    "94025|1000|0646870|Menlo Park city|C1|600",
    "94025|1000|0655282|Palo Alto city|C1|2",
    "94040|1000|0649672|Mountain View CDP|U1|500",
    "94040|1000|0649670|Mountain View city|C1|1000",
    "94040|1000|0612345|Los Altos city|C1|500",
  ].join("\n");
  const { communities, zips } = buildZipTable({
    countyText,
    placeText,
    counties: { "06081": "San Mateo", "06085": "Santa Clara", "06095": "Solano" },
    places: new Set(["Menlo Park", "Palo Alto", "Mountain View"]),
  });
  it("keeps ZIPs that share land with a Bay Area county, every such county, and the other counties apart", () => {
    expect(Object.keys(zips)).toEqual(["94025", "94040", "95616"]);
    expect(zips["94025"].counties).toEqual(["San Mateo", "Santa Clara"]);
    expect(zips["95616"]).toEqual({ counties: ["Solano"], outside: ["Yolo"], places: {} });
  });
  it("counts every overlap with land, marks full only when the ZIP is all inside, and lets the city win a name clash", () => {
    expect(zips["94025"].places).toEqual({ "Menlo Park": "partial", "Palo Alto": "partial" });
    expect(zips["94040"].places).toEqual({ "Mountain View": "full" });
  });
  it("writes one ZIP per line", () => {
    const text = zipTableJson({ cityCounty: { "Menlo Park": "San Mateo" }, communities, zips });
    expect(JSON.parse(text)).toEqual({ cityCounty: { "Menlo Park": "San Mateo" }, communities: [], zips });
    expect(text.split("\n").filter((l) => l.startsWith('    "9'))).toHaveLength(3);
  });
});

describe("the ballot data the ZIP rules rely on", async () => {
  const { loadElection } = await import("@/lib/data");
  const { default: raw } = await import("@/data/zips.json");
  const table = raw as unknown as ZipTable;
  const contests = loadElection("data", "2026-11").ballot.contests;
  it("names each council district's own city in its title, since the rule hides it by that city", () => {
    const councils = contests.filter((x) => x.jurisdiction.level === "district" && ["City Council", "Town Council"].includes(x.jurisdiction.name) && x.jurisdiction.within?.length === 1);
    expect(councils.length).toBeGreaterThan(0);
    expect(councils.filter((x) => !x.title.includes(x.jurisdiction.within![0].name)).map((x) => x.id)).toEqual([]);
  });
  it("has no city contest or council for an unincorporated community, whose Census lines aren't legal limits", () => {
    const named = contests.flatMap((x) => (x.jurisdiction.level === "city" ? [x.jurisdiction.name] : ["City Council", "Town Council"].includes(x.jurisdiction.name) ? (x.jurisdiction.within ?? []).map((p) => p.name) : []));
    expect(named.filter((n) => table.communities.includes(n))).toEqual([]);
  });
});

describe("the committed ZIP table", () => {
  it("covers every city the ballot names, with its county (rerun npm run bb -- zips after adding one)", async () => {
    const { loadElection } = await import("@/lib/data");
    const { default: raw } = await import("@/data/zips.json");
    const table = raw as unknown as ZipTable;
    const d = loadElection("data", "2026-11");
    const named = new Set(d.ballot.contests.flatMap((x) => [x.jurisdiction, ...(x.jurisdiction.within ?? [])]).filter((p) => p.level === "city").map((p) => p.name));
    const covered = new Set(Object.values(table.zips).flatMap((z) => Object.keys(z.places)));
    expect([...named].filter((n) => !covered.has(n) || !table.cityCounty[n])).toEqual([]);
  });
});
