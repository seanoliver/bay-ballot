import type { PlaceGroup } from "./areas";
import type { Contest, Jurisdiction } from "./schema";

/**
 * For one ZIP: the Bay Area counties it lies in, any other counties it reaches (which this site doesn't cover), and
 * each city or community on the ballot it overlaps, `full` when the ZIP lies wholly inside it.
 */
export type ZipPlaces = { counties: string[]; outside?: string[]; places: Record<string, "full" | "partial"> };
/** `cityCounty` gives the county of every city the ballot names, so a district listed by cities has known counties. */
export type ZipTable = { cityCounty: Record<string, string>; zips: Record<string, ZipPlaces> };

/** on: every address in the ZIP votes on it. maybe: some may. off: none can. */
export type ZipFit = "on" | "maybe" | "off";

export const ZIP_KEY = "bb-zip";
export const isZip = (s: string) => /^\d{5}$/.test(s);

const has = (z: ZipPlaces, place: string) => Object.hasOwn(z.places, place);
const whollyIn = (z: ZipPlaces, county: string) => z.counties.length === 1 && z.counties[0] === county && !z.outside?.length;
// Council districts lie inside their city's limits, which the Census data gives exactly.
const COUNCILS: readonly string[] = ["City Council", "Town Council"];

/**
 * How a contest fits a ZIP. A district's `within` names the places it is filed under, not its full extent (it leaves
 * out unincorporated land), so a district is ruled out only by county: `off` never rests on a missing city.
 */
export function zipFit(j: Jurisdiction, z: ZipPlaces, { home = null, cityCounty }: { home?: string | null; cityCounty: Record<string, string> }): ZipFit {
  if (j.level === "state") return "on";
  if (j.level === "county") return whollyIn(z, j.name) ? "on" : z.counties.includes(j.name) ? "maybe" : "off";
  if (j.level === "city") return z.places[j.name] === "full" && !z.outside?.length ? "on" : has(z, j.name) ? "maybe" : "off";
  const within = j.within ?? [];
  if (j.level === "district" && COUNCILS.includes(j.name) && within.length === 1 && within[0].level === "city") return has(z, within[0].name) ? "maybe" : "off";
  // A region measure is voted on countywide in each county it lists.
  if (j.level === "region" && within.length > 0 && within.every((p) => p.level === "county") && z.counties.every((c) => within.some((p) => p.name === c)) && !z.outside?.length) return "on";
  const counties = within.map((p) => (p.level === "county" ? p.name : cityCounty[p.name]));
  if (home) counties.push(home);
  if (counties.length === 0 || counties.some((c) => c === undefined)) return "maybe";
  return counties.some((c) => z.counties.includes(c)) ? "maybe" : "off";
}

export type ZipView = { groups: PlaceGroup[]; fit: Map<string, ZipFit>; on: number; maybe: number; hidden: number };

/** The groups with only the contests the ZIP can vote on, dropping emptied sections and groups. */
export function zipGroups(groups: PlaceGroup[], z: ZipPlaces, table: Pick<ZipTable, "cityCounty">): ZipView {
  const fit = new Map<string, ZipFit>();
  const count = { on: 0, maybe: 0, off: 0 };
  const keep = (c: Contest, home: string | null) => {
    const f = zipFit(c.jurisdiction, z, { home, cityCounty: table.cityCounty });
    fit.set(c.id, f);
    count[f]++;
    return f !== "off";
  };
  const out = groups
    .map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, contests: s.contests.filter((c) => keep(c, g.county)) })).filter((s) => s.contests.length > 0) }))
    .filter((g) => g.sections.length > 0);
  return { groups: out, fit, on: count.on, maybe: count.maybe, hidden: count.off };
}
