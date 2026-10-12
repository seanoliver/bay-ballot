import type { ZipTable } from "../lib/zip";

/** Census 2020 relationship files: which ZIP Code Tabulation Areas overlap which counties and places, by land area. */
export const CENSUS_URLS = {
  county: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
  place: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt",
};

// A ZIP that has less than this share of its land in a county or place doesn't count as touching it (boundary slivers).
export const MIN_SHARE = 0.01;
// A ZIP with at least this share of its land in a place counts as wholly inside it.
export const FULL_SHARE = 0.99;

type Row = Record<string, string>;

function parseRows(text: string): Row[] {
  const [header, ...lines] = text.replace(/^﻿/, "").split(/\r?\n/);
  const cols = header.split("|");
  return lines.filter((l) => l.trim()).map((l) => {
    const cells = l.split("|");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
}

const share = (part: string, whole: string) => Number(part) / Number(whole);
// "Hillsborough town", "Castro Valley CDP" → "Hillsborough", "Castro Valley".
const placeName = (s: string) => s.replace(/ (city|town|CDP)$/, "");
const incorporated = (classfp: string) => classfp.startsWith("C");

/**
 * The ZIPs that touch the given counties, each with its counties and the named places it overlaps, `full` when it lies
 * wholly inside one. `counties` maps a Census county GEOID ("06081") to the name the ballot uses ("San Mateo"). Only
 * places in `places` are kept; when a name is both a city and an unincorporated community, the city wins.
 */
export function buildZipTable({ countyText, placeText, counties, places }: {
  countyText: string;
  placeText: string;
  counties: Record<string, string>;
  places: Set<string>;
}): ZipTable {
  const table: ZipTable = {};
  for (const r of parseRows(countyText)) {
    const zip = r.GEOID_ZCTA5_20;
    const county = counties[r.GEOID_COUNTY_20];
    if (!zip || !county || Number(r.AREALAND_ZCTA5_20) === 0) continue;
    if (share(r.AREALAND_PART, r.AREALAND_ZCTA5_20) < MIN_SHARE) continue;
    (table[zip] ??= { counties: [], places: {} }).counties.push(county);
  }
  const cityNames = new Set<string>();
  const rows = parseRows(placeText).filter((r) => table[r.GEOID_ZCTA5_20] && r.GEOID_PLACE_20.startsWith("06") && places.has(placeName(r.NAMELSAD_PLACE_20)));
  for (const r of rows) if (incorporated(r.CLASSFP_PLACE_20)) cityNames.add(placeName(r.NAMELSAD_PLACE_20));
  for (const r of rows) {
    const name = placeName(r.NAMELSAD_PLACE_20);
    if (cityNames.has(name) && !incorporated(r.CLASSFP_PLACE_20)) continue;
    const s = share(r.AREALAND_PART, r.AREALAND_ZCTA5_20);
    if (s < MIN_SHARE) continue;
    table[r.GEOID_ZCTA5_20].places[name] = s >= FULL_SHARE ? "full" : "partial";
  }
  for (const z of Object.values(table)) {
    z.counties.sort();
    z.places = Object.fromEntries(Object.entries(z.places).sort(([a], [b]) => a.localeCompare(b)));
  }
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}
