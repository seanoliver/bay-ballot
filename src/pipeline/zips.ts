import { STATE_DISTRICTS } from "../lib/areas";
import type { Contest } from "../lib/schema";
import { STATE_PLACE, type DistrictPlace, type ZipTable } from "../lib/zip";

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

const arcgisGeojson = (layer: string, field: string) => `${layer}/query?` + new URLSearchParams({ where: "1=1", outFields: field, outSR: "4326", f: "geojson" });
const caDistrictsUrl = (layer: number) => arcgisGeojson(`https://services.gis.ca.gov/arcgis/rest/services/Government/CaliforniaDistricts/MapServer/${layer}`, "DISTRICT");

export const DISTRICT_MAPS: readonly {
  place: DistrictPlace;
  seat: string;
  url: string;
  format?: "zipped shapefile";
  field: string;
  count: number;
}[] = [
  // AB 604, the congressional map Proposition 50 adopted in November 2025, from the Senate Elections Committee.
  {
    place: STATE_PLACE,
    seat: "Congress",
    url: "https://selc.senate.ca.gov/media/603",
    format: "zipped shapefile",
    field: "DISTRICT",
    count: 52,
  },
  { place: STATE_PLACE, seat: "State Senate", url: caDistrictsUrl(1), field: "DISTRICT", count: 40 },
  { place: STATE_PLACE, seat: "Assembly", url: caDistrictsUrl(0), field: "DISTRICT", count: 80 },
  { place: STATE_PLACE, seat: "Board of Equalization", url: caDistrictsUrl(3), field: "DISTRICT", count: 4 },
  // DataSF "Supervisor Districts (2022)", trimmed of water.
  {
    place: { level: "county", name: "San Francisco" },
    seat: "Supervisor",
    url: "https://data.sf.gov/resource/f2zs-jevy.geojson",
    field: "sup_dist",
    count: 11,
  },
  {
    place: { level: "county", name: "Sonoma" },
    seat: "Supervisor",
    url: arcgisGeojson("https://socogis.sonomacounty.ca.gov/map/rest/services/BASEPublic/Supervisorial_Districts/FeatureServer/0", "SupNum"),
    field: "SupNum",
    count: 5,
  },
  {
    place: { level: "city", name: "San Jose" },
    seat: "City Council",
    url: arcgisGeojson("https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_AdministrativeBoundaries/MapServer/1", "DISTRICT"),
    field: "DISTRICT",
    count: 10,
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

// Below this share of a ZIP's mapped land, and thinner than SLIVER_WIDTH_M, an overlap is a border sliver unless 2020
// Census homes or people lie in it. In SF the largest sliver is 0.33% and the smallest real piece 0.94%.
export const MIN_DISTRICT_SHARE = 0.005;
export const SLIVER_WIDTH_M = 60;
// ZIP areas (ZCTAs) are Census blocks, not USPS delivery areas: a home near the edge may have the neighbor's ZIP.
export const EDGE_BUFFER_M = 150;
export const BLOCK_REACH_CAP_M = 3000;
export const MAX_BLOCK_REACH_M = EDGE_BUFFER_M + BLOCK_REACH_CAP_M;
export const LOG_SHARE = 0.001;
// Enough rows that a ZIP a few blocks tall still resolves the threshold.
const MIN_ROWS = 2000;
const MAX_ROW_STEP = 0.00005;

const rings = (s: Shape): Ring[] => (s.type === "Polygon" ? s.coordinates : s.coordinates.flat());

type Edge = [number, number, number, number];
const edges = (rs: Ring[]): Edge[] => rs.flatMap((r) => r.map((p, i): Edge => [...r[(i || r.length) - 1], ...p]));

// Sorted crossings of a row of latitude; inside is between each pair. Even-odd: parts that overlap would cancel.
function crossings(es: Edge[], y: number): number[] {
  const xs: number[] = [];
  for (const [x1, y1, x2, y2] of es) if (y1 <= y !== y2 <= y) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
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

export type Box = { x: [number, number]; y: [number, number] };
function bounds(es: Edge[]): Box {
  const b: Box = { x: [Infinity, -Infinity], y: [Infinity, -Infinity] };
  for (const [x1, y1, x2, y2] of es) {
    b.x = [Math.min(b.x[0], x1, x2), Math.max(b.x[1], x1, x2)];
    b.y = [Math.min(b.y[0], y1, y2), Math.max(b.y[1], y1, y2)];
  }
  return b;
}
export const boxesMeet = (a: Box, b: Box) => a.x[0] <= b.x[1] && b.x[0] <= a.x[1] && a.y[0] <= b.y[1] && b.y[0] <= a.y[1];

const BANDS = 64;
function banded(es: Edge[], lo: number, step: number): Edge[][] {
  const bands: Edge[][] = Array.from({ length: BANDS }, () => []);
  for (const e of es) {
    const a = Math.max(0, Math.floor((Math.min(e[1], e[3]) - lo) / step));
    const b = Math.min(BANDS - 1, Math.floor((Math.max(e[1], e[3]) - lo) / step));
    for (let k = a; k <= b; k++) bands[k].push(e);
  }
  return bands;
}

/** Each district's share, by area, of each ZIP's land that lies in some district. */
export function districtShares(
  zctas: Record<string, Shape>,
  districts: Record<string, Shape>,
  { minRows = MIN_ROWS }: { minRows?: number } = {},
): Record<string, Record<string, number>> {
  const ds = Object.entries(districts).map(([id, s]) => {
    const es = edges(rings(s));
    return { id, es, box: bounds(es) };
  });
  const out: Record<string, Record<string, number>> = {};
  for (const [zip, shape] of Object.entries(zctas)) {
    const ze = edges(rings(shape));
    const box = bounds(ze);
    const [lo, hi] = box.y;
    const rows = Math.max(minRows, Math.ceil((hi - lo) / MAX_ROW_STEP));
    const step = (hi - lo) / rows;
    const bandStep = (hi - lo) / BANDS || 1;
    const near = ds.filter((d) => boxesMeet(d.box, box)).map((d) => ({ id: d.id, bands: banded(d.es.filter((e) => Math.max(e[1], e[3]) >= lo && Math.min(e[1], e[3]) <= hi), lo, bandStep) }));
    const zBands = banded(ze, lo, bandStep);
    const area: Record<string, number> = {};
    for (let k = 0; k < rows; k++) {
      const y = lo + (k + 0.5) * step;
      const band = Math.min(BANDS - 1, Math.floor((y - lo) / bandStep));
      const zx = crossings(zBands[band], y);
      if (zx.length === 0) continue;
      for (const d of near) {
        const len = overlapLength(zx, crossings(d.bands[band], y));
        if (len > 0) area[d.id] = (area[d.id] ?? 0) + len;
      }
    }
    const total = Object.values(area).reduce((a, b) => a + b, 0);
    if (total > 0) out[zip] = Object.fromEntries(Object.entries(area).map(([id, a]) => [id, a / total]));
  }
  return out;
}

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export function reachedDistricts({ shares, widths, withHomes = [], nearEdge = [] }: {
  shares: Record<string, number>;
  widths: Record<string, number>;
  withHomes?: string[];
  nearEdge?: string[];
}) {
  const touched = new Set<string>();
  const notes: { district: string; share: number; why: string }[] = [];
  const dropped: { district: string; share: number; width: number }[] = [];
  for (const [district, share] of Object.entries(shares)) {
    const big = share >= MIN_DISTRICT_SHARE;
    const wide = (widths[district] ?? Infinity) >= SLIVER_WIDTH_M;
    if (big || wide || withHomes.includes(district)) touched.add(district);
    else if (share >= LOG_SHARE) dropped.push({ district, share, width: widths[district] });
    if (big && !wide) notes.push({ district, share, why: `only ${Math.round(widths[district])} m thick, but ${(share * 100).toFixed(2)}% of the ZIP` });
    else if (!big && wide) notes.push({ district, share, why: `${Math.round(widths[district])} m thick, though ${(share * 100).toFixed(2)}% of the ZIP` });
    else if (!big && withHomes.includes(district)) notes.push({ district, share, why: `a thin ${(share * 100).toFixed(2)}% of the ZIP with 2020 homes` });
  }
  for (const district of nearEdge) {
    if (!touched.has(district)) notes.push({ district, share: shares[district] ?? 0, why: "2020 homes in a block that reaches the ZIP's edge" });
    touched.add(district);
  }
  return { touched: [...touched].sort(byNumber), notes: notes.sort((a, b) => byNumber(a.district, b.district)), dropped: dropped.filter((d) => !touched.has(d.district)) };
}

const M_PER_DEG = 111_320;
const mPerDegX = (lat: number) => M_PER_DEG * Math.cos((lat * Math.PI) / 180);

function overlapIntervals(a: number[], b: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i + 1 < a.length && j + 1 < b.length; ) {
    const lo = Math.max(a[i], b[j]);
    const hi = Math.min(a[i + 1], b[j + 1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i + 1] < b[j + 1]) i += 2;
    else j += 2;
  }
  return out;
}

// The longest single run of overlap along any row of latitude, in degrees of longitude.
function widestRow(a: Edge[], b: Edge[], { minRows = MIN_ROWS }: { minRows?: number } = {}): number {
  const boxA = bounds(a);
  const boxB = bounds(b);
  const lo = Math.max(boxA.y[0], boxB.y[0]);
  const hi = Math.min(boxA.y[1], boxB.y[1]);
  if (!(hi > lo)) return 0;
  const rows = Math.max(minRows, Math.ceil((hi - lo) / MAX_ROW_STEP));
  const step = (hi - lo) / rows;
  const bandStep = (hi - lo) / BANDS;
  const span = (es: Edge[]) => banded(es.filter((e) => Math.max(e[1], e[3]) >= lo && Math.min(e[1], e[3]) <= hi), lo, bandStep);
  const [bandsA, bandsB] = [span(a), span(b)];
  let widest = 0;
  for (let k = 0; k < rows; k++) {
    const y = lo + (k + 0.5) * step;
    const band = Math.min(BANDS - 1, Math.floor((y - lo) / bandStep));
    // Runs that touch are one run: two parts of a shape that share an edge cross the row at the same point.
    let start = NaN;
    let end = NaN;
    for (const [x0, x1] of overlapIntervals(crossings(bandsA[band], y), crossings(bandsB[band], y))) {
      if (x0 > end || Number.isNaN(end)) start = x0;
      end = x1;
      widest = Math.max(widest, end - start);
    }
  }
  return widest;
}

export function overlapWidth(zip: Shape, district: Shape, opts: { minRows?: number } = {}): number {
  const z = edges(rings(zip));
  const d = edges(rings(district));
  const flip = (es: Edge[]): Edge[] => es.map(([x1, y1, x2, y2]) => [y1, x1, y2, x2]);
  const lat = (bounds(z).y[0] + bounds(z).y[1]) / 2;
  return Math.min(widestRow(z, d, opts) * mPerDegX(lat), widestRow(flip(z), flip(d), opts) * M_PER_DEG);
}

export function padBox({ x, y }: Box, meters: number): Box {
  const dy = meters / M_PER_DEG;
  const dx = meters / mPerDegX(Math.max(Math.abs(y[0]), Math.abs(y[1])));
  return { x: [x[0] - dx, x[1] + dx], y: [y[0] - dy, y[1] + dy] };
}

export function blocksNearEdge(s: Shape, blocks: Block[]): [number, number][] {
  if (blocks.length === 0) return [];
  const es = edges(rings(s));
  const box = padBox(bounds(es), Math.max(...blocks.map((b) => b.reach)));
  const lo = box.y[0];
  const bandStep = (box.y[1] - lo) / BANDS;
  const bands = banded(es, lo, bandStep);
  const kx = mPerDegX((box.y[0] + box.y[1]) / 2);
  return blocks
    .filter(({ at: [px, py], reach }) => {
      if (px < box.x[0] || px > box.x[1] || py < box.y[0] || py > box.y[1]) return false;
      const dy = reach / M_PER_DEG;
      const a = Math.max(0, Math.floor((py - dy - lo) / bandStep));
      const b = Math.min(BANDS - 1, Math.floor((py + dy - lo) / bandStep));
      for (let k = a; k <= b; k++) {
        for (const [x1, y1, x2, y2] of bands[k]) {
          // Distance to the segment, in meters on a local flat grid.
          const [ax, ay, bx, by] = [(x1 - px) * kx, (y1 - py) * M_PER_DEG, (x2 - px) * kx, (y2 - py) * M_PER_DEG];
          const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
          const t = len2 ? Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / len2)) : 0;
          if (Math.hypot(ax + t * (bx - ax), ay + t * (by - ay)) <= reach) return true;
        }
      }
      return false;
    })
    .map((b) => b.at);
}

export const homeBlocksUrl = ({ x, y }: Box) =>
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2/query?" +
  new URLSearchParams({
    where: "POP100 > 0 OR HU100 > 0",
    geometry: [x[0], y[0], x[1], y[1]].join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "INTPTLON,INTPTLAT,AREALAND",
    returnGeometry: "false",
    f: "json",
  });

export type Block = { at: [number, number]; reach: number };

export function blockPoints(text: string): Block[] {
  const json = JSON.parse(text) as { error?: unknown; exceededTransferLimit?: boolean; features?: { attributes: Record<string, string | number | null> }[] };
  if (json.error !== undefined) throw new Error(`TIGERweb blocks: the server returned an error: ${JSON.stringify(json.error)}`);
  if (json.exceededTransferLimit) throw new Error("TIGERweb blocks: the response was cut off");
  if (!Array.isArray(json.features)) throw new Error("TIGERweb blocks: no features in the response");
  // Number("") and Number(null) are 0, so a blank must not pass as a number.
  const num = (v: string | number | null | undefined) => (v === undefined || v === null || String(v).trim() === "" ? NaN : Number(v));
  return json.features.map((f) => {
    const at: [number, number] = [num(f.attributes.INTPTLON), num(f.attributes.INTPTLAT)];
    const area = num(f.attributes.AREALAND);
    if (!at.every(Number.isFinite) || !(area >= 0)) throw new Error(`TIGERweb blocks: a block has no internal point or land area: ${JSON.stringify(f.attributes)}`);
    return { at, reach: EDGE_BUFFER_M + Math.min(Math.sqrt(area), BLOCK_REACH_CAP_M) };
  });
}

export const shapeBox = (s: Shape): Box => bounds(edges(rings(s)));

const insideEdges = (es: Edge[], [x, y]: [number, number]) => crossings(es, y).filter((v) => v < x).length % 2 === 1;
const edgesSpanning = (s: Shape, [lo, hi]: [number, number]) => edges(rings(s)).filter((e) => Math.max(e[1], e[3]) >= lo && Math.min(e[1], e[3]) <= hi);

export function pointsIn(s: Shape, points: [number, number][]): [number, number][] {
  const box = shapeBox(s);
  const es = edgesSpanning(s, box.y);
  return points.filter((p) => p[1] >= box.y[0] && p[1] <= box.y[1] && insideEdges(es, p));
}

export function districtsWithHomes(homes: [number, number][], districts: Record<string, Shape>, candidates: string[]): string[] {
  if (homes.length === 0) return [];
  const ys: [number, number] = [Math.min(...homes.map((p) => p[1])), Math.max(...homes.map((p) => p[1]))];
  return candidates.filter((id) => {
    const es = edgesSpanning(districts[id], ys);
    return homes.some((p) => insideEdges(es, p));
  });
}
