import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  blockPoints, buildZipTable, DISTRICT_MAPS, districtShares, districtsTouched, districtsWithHomes, droppedSlivers, pointsIn, poolDistrictCounties, SEAT_KINDS, shapesById,
  zipTableJson, type Shape,
} from "@/pipeline/zips";
import { shapefileById, unzip } from "@/pipeline/shapefile";
import { districtMapKey, STATE_PLACE, zipFit, zipGroups, type ZipPlaces, type ZipTable } from "@/lib/zip";
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
  it("pools a district's counties across its contests, so a trustee area with a short list isn't hidden", () => {
    const srjc5 = c("srjc-trustee-area-5", { level: "district", name: "Sonoma County Junior College District", district: "5", within: [{ level: "county", name: "Sonoma" }] });
    const marin: ZipPlaces = { counties: ["Marin"], places: {} };
    expect(zipFit(srjc5.jurisdiction, marin, { cityCounty })).toBe("off");
    expect(zipFit(srjc5.jurisdiction, marin, { cityCounty, districtCounties: { "Sonoma County Junior College District": ["Marin", "Sonoma"] } })).toBe("maybe");
  });
  it("rules out a mapped district the ZIP misses, and keeps each one it reaches as maybe", () => {
    const castro: ZipPlaces = { ...SF, districts: { "county:San Francisco/Supervisor": ["7", "8"] } };
    const sup4 = c("supervisor-4", { level: "district", name: "Supervisor", district: "4", within: [{ level: "county", name: "San Francisco" }] });
    expect(fit(sup8, castro, "San Francisco")).toBe("maybe");
    expect(fit(sup4, castro, "San Francisco")).toBe("off");
    expect(fit(sup4, { ...castro, districts: { "county:San Francisco/Supervisor": ["4"] } }, "San Francisco")).toBe("maybe");
    expect(fit(sup4, { ...SF, districts: { "city:Oakland/City Council": ["4"] } }, "San Francisco")).toBe("maybe");
    expect(fit(sup4, { ...SF, districts: { "city:San Francisco/Supervisor": ["8"] } }, "San Francisco")).toBe("maybe");
  });
  it("falls back to the county rule for a mapped district filed under two places, or a ZIP whose list is empty", () => {
    const twoPlaces = c("supervisor-4", { level: "district", name: "Supervisor", district: "4", within: [{ level: "county", name: "San Francisco" }, { level: "county", name: "San Mateo" }] });
    expect(fit(twoPlaces, { ...SF, districts: { "county:San Francisco/Supervisor": ["8"] } })).toBe("maybe");
    expect(fit(sup8, { ...SF, districts: { "county:San Francisco/Supervisor": [] } }, "San Francisco")).toBe("maybe");
  });
  it("looks up state-drawn districts in the state map, though their contests list many places", () => {
    const rep12 = c("us-rep-12", { level: "district", name: "Congress", district: "12", within: [{ level: "city", name: "Oakland" }, { level: "city", name: "Berkeley" }] });
    const oakland: ZipPlaces = { counties: ["Alameda"], places: { Oakland: "full" }, districts: { "state:California/Congress": ["12"] } };
    const cc = { Oakland: "Alameda", Berkeley: "Alameda" };
    expect(zipFit(rep12.jurisdiction, oakland, { cityCounty: cc })).toBe("maybe");
    expect(zipFit(rep12.jurisdiction, { ...oakland, districts: { "state:California/Congress": ["14"] } }, { cityCounty: cc })).toBe("off");
    expect(zipFit(rep12.jurisdiction, { ...oakland, districts: {} }, { cityCounty: cc })).toBe("maybe");
    expect(districtMapKey(STATE_PLACE, "Assembly")).toBe("state:California/Assembly");
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
    const text = zipTableJson({ cityCounty: { "Menlo Park": "San Mateo" }, districtCounties: {}, communities, zips });
    expect(JSON.parse(text)).toEqual({ cityCounty: { "Menlo Park": "San Mateo" }, districtCounties: {}, communities: [], zips });
    expect(text.split("\n").filter((l) => l.startsWith('    "9'))).toHaveLength(3);
  });
});

const box = (x0: number, y0: number, x1: number, y1: number): Shape => ({ type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] });

describe("districtShares", () => {
  // A ZIP 0.01 degrees square, split 70/30 between districts A and B.
  const zip = box(0, 0, 0.01, 0.01);
  const A = box(-0.01, -0.01, 0.007, 0.02);
  const B = box(0.007, -0.01, 0.02, 0.02);
  it("splits a ZIP's land among the districts it overlaps, by area, and leaves out districts it doesn't", () => {
    const s = districtShares({ "94999": zip }, { A, B, far: box(0.05, 0.05, 0.06, 0.06) })["94999"];
    expect(Object.keys(s).sort()).toEqual(["A", "B"]);
    expect(s.A).toBeCloseTo(0.7, 3);
    expect(s.B).toBeCloseTo(0.3, 3);
  });
  it("measures only the land inside the map, and skips a ZIP the map misses", () => {
    expect(districtShares({ "94999": zip, "94998": box(0.1, 0.1, 0.11, 0.11) }, { A: box(0, 0, 0.005, 0.01) })).toEqual({ "94999": { A: 1 } });
  });
  it("counts both parts of a two-part multipolygon", () => {
    const twoParts: Shape = { type: "MultiPolygon", coordinates: [box(0, 0, 0.002, 0.01).coordinates as never, box(0.008, 0, 0.01, 0.01).coordinates as never] };
    const s = districtShares({ "94999": zip }, { two: twoParts, middle: box(0.002, 0, 0.008, 0.01) })["94999"];
    expect(s.two).toBeCloseTo(0.4, 3);
    expect(s.middle).toBeCloseTo(0.6, 3);
  });
  it("handles a hole", () => {
    const ring = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]] as [number, number][];
    const donut: Shape = { type: "Polygon", coordinates: [ring(0, 0, 0.01, 0.01), ring(0.0025, 0.0025, 0.0075, 0.0075)] };
    const s = districtShares({ "94999": zip }, { ring: donut, hole: box(0.0025, 0.0025, 0.0075, 0.0075) })["94999"];
    expect(s.ring).toBeCloseTo(0.75, 3);
    expect(s.hole).toBeCloseTo(0.25, 3);
  });
  it("counts a vertex that lies exactly on a row once", () => {
    // A diamond whose side corners sit on the middle of three rows; the left district is the left half.
    const diamond: Shape = { type: "Polygon", coordinates: [[[0.015, 0], [0.03, 0.015], [0.015, 0.03], [0, 0.015], [0.015, 0]]] };
    const s = districtShares({ "94999": diamond }, { left: box(-1, -1, 0.015, 1), right: box(0.015, -1, 1, 1) }, { minRows: 3 })["94999"];
    expect(s).toEqual({ left: 0.5, right: 0.5 });
  });
  it("drops a border sliver under the threshold, and sorts district numbers", () => {
    // District 2 reaches 0.2% of the ZIP along its top edge.
    const s = districtShares({ "94999": zip }, { "10": box(-0.01, -0.01, 0.007, 0.00998), "9": box(0.007, -0.01, 0.02, 0.00998), "2": box(-0.01, 0.00998, 0.02, 0.02) })["94999"];
    expect(s["2"]).toBeCloseTo(0.002, 4);
    expect(districtsTouched(s)).toEqual(["9", "10"]);
    expect(districtsTouched({ "11": 0.5, "2": 0.006, "1": 0.494 })).toEqual(["1", "2", "11"]);
  });
  it("keeps a small overlap that has homes", () => {
    expect(districtsTouched({ "9": 0.998, "2": 0.002 }, { withHomes: ["2"] })).toEqual(["2", "9"]);
  });
});

describe("homes in small overlaps", () => {
  const zip = box(0, 0, 0.01, 0.01);
  it("reads block points, and fails on an error or a cut-off response", () => {
    const text = JSON.stringify({ features: [{ attributes: { INTPTLON: "-122.4", INTPTLAT: "+37.7" } }] });
    expect(blockPoints(text)).toEqual([[-122.4, 37.7]]);
    expect(() => blockPoints(JSON.stringify({ error: { code: 400 } }))).toThrow(/error/);
    expect(() => blockPoints(JSON.stringify({ features: [], exceededTransferLimit: true }))).toThrow(/cut off/);
  });
  it("keeps the points inside a ZIP, and finds which candidate districts hold any", () => {
    const pts: [number, number][] = [[0.005, 0.005], [0.0095, 0.0099], [0.02, 0.005]];
    const homes = pointsIn(zip, pts);
    expect(homes).toEqual([[0.005, 0.005], [0.0095, 0.0099]]);
    const districts = { top: box(-1, 0.0098, 1, 1), right: box(0.0099, -1, 1, 1), main: box(-1, -1, 1, 0.0098) };
    expect(districtsWithHomes(homes, districts, ["top", "right"])).toEqual(["top"]);
    expect(districtsWithHomes([], districts, ["top"])).toEqual([]);
  });
});

// A ZIP archive of the given files, the first stored and the rest deflated, as a download would mix them.
function zipOf(files: Record<string, Buffer>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, data], i) => {
    const body = i === 0 ? data : deflateRawSync(data);
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(i === 0 ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(i === 0 ? 0 : 8, 10);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    locals.push(local, n, body);
    central.push(dir, n);
    offset += 30 + n.length + body.length;
  });
  const dirLen = central.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dirLen, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

// A polygon shapefile: one ring per feature, ids in a one-column table.
function shapefile(field: string, features: [string, [number, number][]][], prj: string): Record<string, Buffer> {
  const records = features.map(([, ring], i) => {
    const c = Buffer.alloc(44 + 4 + ring.length * 16);
    c.writeInt32LE(5, 0);
    c.writeInt32LE(1, 36);
    c.writeInt32LE(ring.length, 40);
    c.writeInt32LE(0, 44);
    ring.forEach(([x, y], k) => {
      c.writeDoubleLE(x, 48 + k * 16);
      c.writeDoubleLE(y, 56 + k * 16);
    });
    const h = Buffer.alloc(8);
    h.writeInt32BE(i + 1, 0);
    h.writeInt32BE(c.length / 2, 4);
    return Buffer.concat([h, c]);
  });
  const dbfHead = Buffer.alloc(32 + 32 + 1);
  dbfHead.writeUInt32LE(features.length, 4);
  dbfHead.writeUInt16LE(dbfHead.length, 8);
  dbfHead.writeUInt16LE(1 + 4, 10);
  dbfHead.write(field, 32, "latin1");
  dbfHead.write("C", 43, "latin1");
  dbfHead[48] = 4;
  dbfHead[64] = 0x0d;
  const rows = features.map(([id]) => Buffer.from(" " + id.padEnd(4), "latin1"));
  return { "d/x.shp": Buffer.concat([Buffer.alloc(100), ...records]), "d/x.dbf": Buffer.concat([dbfHead, ...rows]), "d/x.prj": Buffer.from(prj), "__MACOSX/d/._x.prj": Buffer.from("junk") };
}

describe("shapefileById", () => {
  const ring: [number, number][] = [[-122.5, 37.7], [-122.4, 37.7], [-122.4, 37.8], [-122.5, 37.7]];
  const GEO = 'GEOGCS["GCS_North_American_1983"]';
  it("unzips stored and deflated files", () => {
    const files = unzip(zipOf({ "a.txt": Buffer.from("stored"), "b.txt": Buffer.from("deflated deflated") }));
    expect(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.toString()]))).toEqual({ "a.txt": "stored", "b.txt": "deflated deflated" });
  });
  it("reads polygons by id in degrees", () => {
    const shapes = shapefileById(zipOf(shapefile("DISTRICT", [["01", ring], ["2", ring]], GEO)), "DISTRICT", "map");
    expect(Object.keys(shapes).sort()).toEqual(["01", "2"]);
    expect(shapes["01"]).toEqual({ type: "Polygon", coordinates: [ring] });
  });
  it("turns Web Mercator into degrees", () => {
    const R = 6378137;
    const merc = ring.map(([x, y]): [number, number] => [(x * Math.PI * R) / 180, R * Math.log(Math.tan(Math.PI / 4 + (y * Math.PI) / 360))]);
    const shapes = shapefileById(zipOf(shapefile("DISTRICT", [["1", merc]], 'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere"]')), "DISTRICT", "map");
    shapes["1"].coordinates[0].forEach((p, k) => {
      expect((p as [number, number])[0]).toBeCloseTo(ring[k][0], 9);
      expect((p as [number, number])[1]).toBeCloseTo(ring[k][1], 9);
    });
  });
  it("fails on an unknown projection, a missing column or a repeated id", () => {
    expect(() => shapefileById(zipOf(shapefile("DISTRICT", [["1", ring]], 'PROJCS["NAD_1983_StatePlane_California_III"]')), "DISTRICT", "map")).toThrow(/projection/);
    expect(() => shapefileById(zipOf(shapefile("DISTRICT", [["1", ring]], GEO)), "ID", "map")).toThrow(/no ID column/);
    expect(() => shapefileById(zipOf(shapefile("DISTRICT", [["1", ring], ["1", ring]], GEO)), "DISTRICT", "map")).toThrow(/appears twice/);
  });
});

describe("droppedSlivers", () => {
  it("lists dropped overlaps of 0.1% or more", () => {
    const shares = { "94117": { "5": 0.6, "7": 0.0033, "2": 0.0094, "3": 0.0005 }, "94122": { "4": 0.99, "5": 0.0016 }, "94110": { "9": 0.99, "11": 0.004 } };
    expect(droppedSlivers(shares, { "94117": ["2", "5"], "94122": ["4"], "94110": ["9", "11"] })).toEqual([
      { zip: "94117", district: "7", share: 0.0033 },
      { zip: "94122", district: "5", share: 0.0016 },
    ]);
  });
});

describe("shapesById", () => {
  const feature = (id: unknown, geometry: unknown = box(0, 0, 1, 1)) => ({ properties: { sup_dist: id }, geometry });
  const text = (features: unknown[]) => JSON.stringify({ features });
  it("fails on an error response, a missing id or a missing shape", () => {
    expect(() => shapesById(JSON.stringify({ error: { code: 400 } }), "sup_dist", "map")).toThrow(/error/);
    expect(() => shapesById(text([feature(" ")]), "sup_dist", "map")).toThrow(/no sup_dist/);
    expect(() => shapesById(text([feature("1", null)]), "sup_dist", "map")).toThrow(/no polygon/);
  });
  it("fails on an id that appears twice, and reads a numeric id as text", () => {
    expect(() => shapesById(text([feature("1"), feature("1", box(4, 4, 5, 5))]), "sup_dist", "map")).toThrow(/appears twice/);
    expect(Object.keys(shapesById(text([feature("1"), feature(2, box(2, 2, 3, 3))]), "sup_dist", "map"))).toEqual(["1", "2"]);
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
  it("pools a district's counties from its district-wide contests only, never for a kind of seat, and matches the committed table", () => {
    const pooled = poolDistrictCounties(contests, table.cityCounty);
    expect(Object.keys(pooled).filter((n) => SEAT_KINDS.includes(n))).toEqual([]);
    expect(pooled["Sonoma County Junior College District"]).toEqual(["Marin", "Sonoma"]);
    expect(pooled.BART).toBeUndefined();
    expect(table.districtCounties).toEqual(pooled);
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
  it("maps every SF ZIP to its supervisor districts, and every district on the ballot to some ZIP (rerun npm run bb -- zips)", async () => {
    const { loadElection } = await import("@/lib/data");
    const { default: raw } = await import("@/data/zips.json");
    const table = raw as unknown as ZipTable;
    const sf = Object.entries(table.zips).filter(([, z]) => Object.hasOwn(z.places, "San Francisco"));
    expect(sf.filter(([, z]) => !z.districts?.["county:San Francisco/Supervisor"]?.length).map(([k]) => k)).toEqual([]);
    const mapped = new Set(sf.flatMap(([, z]) => z.districts!["county:San Francisco/Supervisor"]));
    expect([...mapped].sort((a, b) => Number(a) - Number(b))).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    const onBallot = loadElection("data", "2026-11").ballot.contests.filter((x) => x.jurisdiction.name === "Supervisor" && x.jurisdiction.within?.[0]?.level === "county" && x.jurisdiction.within[0].name === "San Francisco");
    expect(onBallot.length).toBeGreaterThan(0);
    expect(onBallot.filter((x) => !mapped.has(x.jurisdiction.district!)).map((x) => x.id)).toEqual([]);
    expect(table.zips["94123"].districts?.["county:San Francisco/Supervisor"]).toEqual(["2"]);
    expect(table.zips["94110"].districts?.["county:San Francisco/Supervisor"]).toEqual(["8", "9", "10"]);
  });
  it("maps every ZIP to its state-drawn districts, and every such district on the ballot to some ZIP (rerun npm run bb -- zips)", async () => {
    const { loadElection } = await import("@/lib/data");
    const { default: raw } = await import("@/data/zips.json");
    const table = raw as unknown as ZipTable;
    const contests = loadElection("data", "2026-11").ballot.contests;
    for (const m of DISTRICT_MAPS) {
      const key = districtMapKey(m.place, m.seat);
      const zips = Object.entries(table.zips).filter(([, z]) => z.districts?.[key]?.length);
      if (m.place.level === "state") expect(zips.length, key).toBe(Object.keys(table.zips).length);
      const mapped = new Set(zips.flatMap(([, z]) => z.districts![key]));
      const onBallot = contests.filter(
        (x) => x.jurisdiction.name === m.seat && (m.place.level === "state" || (x.jurisdiction.within?.length === 1 && x.jurisdiction.within[0].name === m.place.name)),
      );
      expect(onBallot.length, key).toBeGreaterThan(0);
      expect(onBallot.filter((x) => !mapped.has(x.jurisdiction.district!)).map((x) => x.id), key).toEqual([]);
    }
  });
  it("puts known ZIPs in the right state and local districts", async () => {
    const { default: raw } = await import("@/data/zips.json");
    const d = (zip: string) => (raw as unknown as ZipTable).zips[zip].districts;
    // Inside one district each: Palo Alto, Vallejo (Board of Equalization 1, like all of Solano), the Mission.
    expect(d("94301")).toMatchObject({ "state:California/Congress": ["16"], "state:California/State Senate": ["13"], "state:California/Assembly": ["23"], "state:California/Board of Equalization": ["2"] });
    expect(d("94590")).toMatchObject({ "state:California/Congress": ["8"], "state:California/Assembly": ["11"], "state:California/Board of Equalization": ["1"] });
    expect(d("94110")).toMatchObject({ "state:California/Congress": ["11"], "state:California/Assembly": ["17"] });
    // Straddling: Ingleside spans Congress 11 and 15 under the Prop 50 map; downtown San José spans four council districts.
    expect(d("94112")?.["state:California/Congress"]).toEqual(["11", "15"]);
    expect(d("95112")?.["city:San Jose/City Council"]).toEqual(["3", "4", "6", "7"]);
    expect(d("94928")?.["county:Sonoma/Supervisor"]).toEqual(["2", "3"]);
  });
});
