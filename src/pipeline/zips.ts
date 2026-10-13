import { STATE_DISTRICTS } from "../lib/areas";
import type { Contest } from "../lib/schema";
import type { DistrictPlace, ZipTable } from "../lib/zip";

/** Census 2020 relationship files: which ZIP Code Tabulation Areas overlap which counties and places, by land area. */
export const CENSUS_URLS = {
  county: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
  place: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt",
};

type Row = Record<string, string>;

function parseRows(text: string): Row[] {
  const [header, ...lines] = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cols = header.split("|");
  return lines.filter((l) => l.trim()).map((l) => {
    const cells = l.split("|");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

// "Hillsborough town", "Castro Valley CDP" → "Hillsborough", "Castro Valley".
const placeName = (s: string) => s.replace(/ (city|town|CDP)$/, "");
const countyName = (s: string) => s.replace(/ County$/, "");
const incorporated = (classfp: string) => classfp.startsWith("C");

// Both files are built from census blocks, so any shared land is real and every overlap counts.
// `counties` maps a Census county GEOID ("06081") to the ballot's name; others go in `outside`.
// When a name is both a city and an unincorporated community (Mountain View), the city wins.
export function buildZipTable({ countyText, placeText, counties, places }: {
  countyText: string;
  placeText: string;
  counties: Record<string, string>;
  places: Set<string>;
}): Pick<ZipTable, "communities" | "zips"> {
  const countyRows = parseRows(countyText).filter((r) => r.GEOID_ZCTA5_20 && Number(r.AREALAND_PART) > 0);
  const table: ZipTable["zips"] = {};
  for (const r of countyRows) {
    const county = counties[r.GEOID_COUNTY_20];
    if (county) (table[r.GEOID_ZCTA5_20] ??= { counties: [], places: {} }).counties.push(county);
  }
  for (const r of countyRows) {
    const z = table[r.GEOID_ZCTA5_20];
    if (z && !counties[r.GEOID_COUNTY_20]) (z.outside ??= []).push(countyName(r.NAMELSAD_COUNTY_20));
  }
  const rows = parseRows(placeText).filter(
    (r) => table[r.GEOID_ZCTA5_20] && r.GEOID_PLACE_20.startsWith("06") && Number(r.AREALAND_PART) > 0 && places.has(placeName(r.NAMELSAD_PLACE_20)),
  );
  const cityNames = new Set(rows.filter((r) => incorporated(r.CLASSFP_PLACE_20)).map((r) => placeName(r.NAMELSAD_PLACE_20)));
  const communities = new Set<string>();
  for (const r of rows) {
    const name = placeName(r.NAMELSAD_PLACE_20);
    if (cityNames.has(name) && !incorporated(r.CLASSFP_PLACE_20)) continue;
    if (!incorporated(r.CLASSFP_PLACE_20)) communities.add(name);
    table[r.GEOID_ZCTA5_20].places[name] = r.AREALAND_PART === r.AREALAND_ZCTA5_20 ? "full" : "partial";
  }
  for (const z of Object.values(table)) {
    z.counties.sort();
    z.outside?.sort();
    z.places = Object.fromEntries(Object.entries(z.places).sort(([a], [b]) => a.localeCompare(b)));
  }
  return { communities: [...communities].sort(), zips: Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b))) };
}

/** One ZIP per line, so a rebuild's diff shows which ZIPs changed. */
export function zipTableJson(t: ZipTable): string {
  const zips = Object.entries(t.zips).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n  "cityCounty": ${JSON.stringify(t.cityCounty)},\n  "districtCounties": ${JSON.stringify(t.districtCounties)},\n  "communities": ${JSON.stringify(t.communities)},\n  "zips": {\n${zips.join(",\n")}\n  }\n}\n`;
}

// One name, many districts: these name a kind of seat, not one district.
export const SEAT_KINDS: readonly string[] = [...STATE_DISTRICTS, "Supervisor", "County Board of Education", "City Council", "Town Council"];

/** Each district's counties from its district-wide (at-large) contests, which describe the whole district. */
export function poolDistrictCounties(contests: Contest[], cityCounty: Record<string, string>): Record<string, string[]> {
  const byDistrict = new Map<string, Set<string>>();
  for (const c of contests) {
    const j = c.jurisdiction;
    if (j.level !== "district" || j.district !== "at-large" || SEAT_KINDS.includes(j.name)) continue;
    const set = byDistrict.get(j.name) ?? new Set<string>();
    for (const p of j.within ?? []) {
      const county = p.level === "county" ? p.name : cityCounty[p.name];
      if (county) set.add(county);
    }
    byDistrict.set(j.name, set);
  }
  return Object.fromEntries([...byDistrict].filter(([, s]) => s.size > 0).sort(([a], [b]) => a.localeCompare(b)).map(([n, s]) => [n, [...s].sort()]));
}

type Ring = [number, number][];
export type Shape = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

/**
 * `place` is the one place the district contests are filed under. `slivers` lists dropped overlaps (ZIP to districts)
 * a person has looked at; `runZips` stops on any big one not listed.
 */
export const DISTRICT_MAPS: readonly {
  place: DistrictPlace;
  seat: string;
  url: string;
  field: string;
  count: number;
  slivers: Record<string, string[]>;
}[] = [
  // DataSF "Supervisor Districts (2022)", trimmed of water.
  {
    place: { level: "county", name: "San Francisco" },
    seat: "Supervisor",
    url: "https://data.sf.gov/resource/f2zs-jevy.geojson",
    field: "sup_dist",
    count: 11,
    // A strip under 90 m wide; not checked for addresses.
    slivers: { "94117": ["7"] },
  },
];

export const zctaShapesUrl = (zips: string[]) =>
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/11/query?" +
  new URLSearchParams({ where: `ZCTA5 IN (${zips.map((z) => `'${z}'`).join(",")})`, outFields: "ZCTA5", outSR: "4326", f: "geojson" });

/** Shapes by `field`. Fails on an error response, a missing or repeated id, or a missing shape. */
export function shapesById(text: string, field: string, what: string): Record<string, Shape> {
  const json = JSON.parse(text) as { error?: unknown; features?: { properties?: Record<string, unknown> | null; geometry?: Shape | null }[] };
  if (json.error !== undefined) throw new Error(`${what}: the server returned an error: ${JSON.stringify(json.error)}`);
  if (!Array.isArray(json.features)) throw new Error(`${what}: no features in the response`);
  const out: Record<string, Shape> = {};
  for (const f of json.features) {
    const id = String(f.properties?.[field] ?? "").trim();
    if (!id) throw new Error(`${what}: a feature has no ${field}`);
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) throw new Error(`${what}: ${field} ${id} has no polygon`);
    if (out[id]) throw new Error(`${what}: ${field} ${id} appears twice`);
    out[id] = g;
  }
  return out;
}

// Below this share of a ZIP's mapped land, an overlap is a border sliver. In SF the largest sliver is 0.33% and the
// smallest real piece 0.94%.
export const MIN_DISTRICT_SHARE = 0.005;
export const SLIVER_SHARES = { log: 0.001, review: 0.0025 };
// Enough rows that a ZIP a few blocks tall still resolves the threshold.
const MIN_ROWS = 2000;
const MAX_ROW_STEP = 0.00005;

const rings = (s: Shape): Ring[] => (s.type === "Polygon" ? s.coordinates : s.coordinates.flat());

// Sorted crossings of a row of latitude; inside is between each pair. Even-odd: parts that overlap would cancel.
function crossings(rs: Ring[], y: number): number[] {
  const xs: number[] = [];
  for (const r of rs) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [x1, y1] = r[j];
      const [x2, y2] = r[i];
      if (y1 <= y !== y2 <= y) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  return xs.sort((a, b) => a - b);
}

function overlapLength(a: number[], b: number[]): number {
  let len = 0;
  for (let i = 0, j = 0; i + 1 < a.length && j + 1 < b.length; ) {
    const lo = Math.max(a[i], b[j]);
    const hi = Math.min(a[i + 1], b[j + 1]);
    if (hi > lo) len += hi - lo;
    if (a[i + 1] < b[j + 1]) i += 2;
    else j += 2;
  }
  return len;
}

function latRange(rs: Ring[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rs) for (const [, y] of r) [lo, hi] = [Math.min(lo, y), Math.max(hi, y)];
  return [lo, hi];
}

/** Each district's share, by area, of each ZIP's land that lies in some district. */
export function districtShares(
  zctas: Record<string, Shape>,
  districts: Record<string, Shape>,
  { minRows = MIN_ROWS }: { minRows?: number } = {},
): Record<string, Record<string, number>> {
  const ds = Object.entries(districts).map(([id, s]) => ({ id, rs: rings(s), range: latRange(rings(s)) }));
  const out: Record<string, Record<string, number>> = {};
  for (const [zip, shape] of Object.entries(zctas)) {
    const zr = rings(shape);
    const [lo, hi] = latRange(zr);
    const rows = Math.max(minRows, Math.ceil((hi - lo) / MAX_ROW_STEP));
    const step = (hi - lo) / rows;
    const area: Record<string, number> = {};
    for (let k = 0; k < rows; k++) {
      const y = lo + (k + 0.5) * step;
      const zx = crossings(zr, y);
      if (zx.length === 0) continue;
      for (const d of ds) {
        if (y < d.range[0] || y > d.range[1]) continue;
        const len = overlapLength(zx, crossings(d.rs, y));
        if (len > 0) area[d.id] = (area[d.id] ?? 0) + len;
      }
    }
    const total = Object.values(area).reduce((a, b) => a + b, 0);
    if (total > 0) out[zip] = Object.fromEntries(Object.entries(area).map(([id, a]) => [id, a / total]));
  }
  return out;
}

export const districtsTouched = (shares: Record<string, number>, minShare = MIN_DISTRICT_SHARE) =>
  Object.keys(shares)
    .filter((id) => shares[id] >= minShare)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

export function droppedSlivers(shares: Record<string, Record<string, number>>, seen: Record<string, string[]>) {
  const dropped: { zip: string; district: string; share: number; unseen: boolean }[] = [];
  for (const [zip, s] of Object.entries(shares)) {
    for (const [district, share] of Object.entries(s)) {
      if (share < SLIVER_SHARES.log || share >= MIN_DISTRICT_SHARE) continue;
      dropped.push({ zip, district, share, unseen: share >= SLIVER_SHARES.review && !seen[zip]?.includes(district) });
    }
  }
  return dropped;
}
