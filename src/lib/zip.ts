import type { PlaceGroup } from "./areas";
import type { Contest, Jurisdiction } from "./schema";

/**
 * For one ZIP: the Bay Area counties it lies in, any other counties it reaches (which this site doesn't cover), and
 * each city or community on the ballot it overlaps, `full` when the ZIP lies wholly inside it. `districts` lists, for
 * each district map the table has (keyed by `districtMapKey`), the districts the ZIP reaches.
 */
export type ZipPlaces = { counties: string[]; outside?: string[]; places: Record<string, "full" | "partial">; districts?: Record<string, string[]> };
export type ZipTable = {
  /** The county of every place the ballot names, so a district listed by cities has known counties. */
  cityCounty: Record<string, string>;
  /** Each district's counties from its at-large contests, since one trustee area's list can be short. */
  districtCounties: Record<string, string[]>;
  /** The places that are unincorporated: Census-drawn, with no legal limits. */
  communities: string[];
  zips: Record<string, ZipPlaces>;
};

/** on: every address in the ZIP votes on it. maybe: some may. off: none can. */
export type ZipFit = "on" | "maybe" | "off";

export const ZIP_KEY = "bb-zip";
/** `?mine=1` on the Bay Area list shows the saved ZIP's ballot. It never carries the ZIP itself. */
export const MINE_PARAM = "mine";
export const isZip = (s: string) => /^\d{5}$/.test(s);

const has = (z: ZipPlaces, place: string) => Object.hasOwn(z.places, place);
const whollyIn = (z: ZipPlaces, county: string) => z.counties.length === 1 && z.counties[0] === county && !z.outside?.length;
// Council districts lie inside their city's limits (as of the 2020 Census; later annexations aren't in the data).
const COUNCILS: readonly string[] = ["City Council", "Town Council"];

/** "San Francisco/Supervisor": the one place a district contest is filed under, and its kind of seat. */
export const districtMapKey = (place: string, seat: string) => `${place}/${seat}`;

/**
 * How a contest fits a ZIP. A district's `within` names the places it is filed under, not its full extent (it leaves
 * out unincorporated land), so a district is ruled out only by county: `off` never rests on a missing city.
 */
export function zipFit(
  j: Jurisdiction,
  z: ZipPlaces,
  { home = null, cityCounty, districtCounties = {} }: { home?: string | null; cityCounty: Record<string, string>; districtCounties?: Record<string, string[]> },
): ZipFit {
  if (j.level === "state") return "on";
  if (j.level === "county") return whollyIn(z, j.name) ? "on" : z.counties.includes(j.name) ? "maybe" : "off";
  if (j.level === "city") return z.places[j.name] === "full" ? "on" : has(z, j.name) ? "maybe" : "off";
  const within = j.within ?? [];
  // A district with a map is ruled out when the ZIP misses it. It stays maybe even when the ZIP reaches only it, since
  // ZIP areas and district lines are both approximate near the border.
  if (j.level === "district" && j.district && within.length === 1) {
    const mapped = z.districts?.[districtMapKey(within[0].name, j.name)];
    if (mapped) return mapped.includes(j.district) ? "maybe" : "off";
  }
  if (j.level === "district" && COUNCILS.includes(j.name) && within.length === 1 && within[0].level === "city") return has(z, within[0].name) ? "maybe" : "off";
  // A region measure is voted on countywide in each county it lists.
  if (j.level === "region" && within.length > 0 && within.every((p) => p.level === "county") && z.counties.every((c) => within.some((p) => p.name === c)) && !z.outside?.length) return "on";
  const counties = within.map((p) => (p.level === "county" ? p.name : cityCounty[p.name]));
  if (home) counties.push(home);
  if (Object.hasOwn(districtCounties, j.name)) counties.push(...districtCounties[j.name]);
  if (counties.length === 0 || counties.some((c) => c === undefined)) return "maybe";
  return counties.some((c) => z.counties.includes(c)) ? "maybe" : "off";
}

export type ZipView = { groups: PlaceGroup[]; fit: Map<string, ZipFit>; on: number; maybe: number; hidden: number };

/** The groups with only the contests the ZIP can vote on, dropping emptied sections and groups. */
export function zipGroups(groups: PlaceGroup[], z: ZipPlaces, table: Pick<ZipTable, "cityCounty"> & Partial<Pick<ZipTable, "districtCounties">>): ZipView {
  const fit = new Map<string, ZipFit>();
  const count = { on: 0, maybe: 0, off: 0 };
  const keep = (c: Contest, home: string | null) => {
    const f = zipFit(c.jurisdiction, z, { home, cityCounty: table.cityCounty, districtCounties: table.districtCounties });
    fit.set(c.id, f);
    count[f]++;
    return f !== "off";
  };
  const out = groups
    .map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, contests: s.contests.filter((c) => keep(c, g.county)) })).filter((s) => s.contests.length > 0) }))
    .filter((g) => g.sections.length > 0);
  return { groups: out, fit, on: count.on, maybe: count.maybe, hidden: count.off };
}
