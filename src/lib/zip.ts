import type { PlaceGroup } from "./areas";
import type { Contest, Jurisdiction } from "./schema";

/** For one ZIP: the counties it lies in, and each named city or community it overlaps (`full` when wholly inside). */
export type ZipPlaces = { counties: string[]; places: Record<string, "full" | "partial"> };
export type ZipTable = Record<string, ZipPlaces>;

/** on: every address in the ZIP votes on it. maybe: some do. off: none do. */
export type ZipFit = "on" | "maybe" | "off";

export const ZIP_PARAM = "zip";
export const ZIP_KEY = "bb-zip";
export const isZip = (s: string) => /^\d{5}$/.test(s);

export function zipFit(j: Jurisdiction, z: ZipPlaces): ZipFit {
  if (j.level === "state") return "on";
  if (j.level === "county") return z.counties.includes(j.name) ? (z.counties.length === 1 ? "on" : "maybe") : "off";
  if (j.level === "city") return z.places[j.name] === "full" ? "on" : z.places[j.name] ? "maybe" : "off";
  const within = j.within ?? [];
  if (within.length === 0) return "maybe";
  const touches = within.filter((p) => (p.level === "county" ? z.counties.includes(p.name) : p.name in z.places));
  if (touches.length === 0) return "off";
  // A region measure is voted on countywide in each county it lists.
  if (j.level === "region" && within.every((p) => p.level === "county") && z.counties.every((c) => within.some((p) => p.name === c))) return "on";
  return "maybe";
}

export type ZipView = { groups: PlaceGroup[]; maybe: Set<string>; on: number; hidden: number };

/** The groups with only the contests the ZIP can vote on, dropping emptied sections and groups. */
export function zipGroups(groups: PlaceGroup[], z: ZipPlaces): ZipView {
  const maybe = new Set<string>();
  let on = 0;
  let hidden = 0;
  const keep = (c: Contest) => {
    const fit = zipFit(c.jurisdiction, z);
    if (fit === "off") hidden++;
    else if (fit === "maybe") maybe.add(c.id);
    else on++;
    return fit !== "off";
  };
  const out = groups
    .map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, contests: s.contests.filter(keep) })).filter((s) => s.contests.length > 0) }))
    .filter((g) => g.sections.length > 0);
  return { groups: out, maybe, on, hidden };
}
