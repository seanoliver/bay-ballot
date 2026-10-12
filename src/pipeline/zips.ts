import type { ZipTable } from "../lib/zip";

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
