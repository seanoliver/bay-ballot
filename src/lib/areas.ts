import type { Area, Contest, Jurisdiction, Place } from "./schema";

// Districts drawn by the state: listed under California, never under a county.
export const STATE_DISTRICTS: readonly string[] = ["Congress", "State Senate", "Assembly", "Board of Equalization"];

export type PlaceName = { name: string; short: string };
export const BAY_AREA: PlaceName = { name: "Bay Area", short: "Bay Area" };

type AreaLike = Pick<Area, "jurisdictions">;

function places(j: Jurisdiction): Place[] | "everywhere" {
  if (j.level === "state") return "everywhere";
  if (j.level === "county" || j.level === "city") return [{ level: j.level, name: j.name }];
  return j.within ?? [];
}

export function inArea(c: Pick<Contest, "jurisdiction">, area: AreaLike): boolean {
  const p = places(c.jurisdiction);
  return p === "everywhere" || p.some((x) => area.jurisdictions.some((j) => j.level === x.level && j.name === x.name));
}

export function areasOf<A extends AreaLike>(c: Pick<Contest, "jurisdiction">, areas: A[]): A[] {
  return areas.filter((a) => inArea(c, a));
}

export function contestArea<A extends AreaLike>(c: Pick<Contest, "jurisdiction">, areas: A[]): A | null {
  const found = areasOf(c, areas);
  return found.length === 1 ? found[0] : null;
}

export function areaGuides<G extends { areas: string[] }>(guides: G[], area: Pick<Area, "id">): G[] {
  return guides.filter((g) => g.areas.includes(area.id));
}

export function placeName(area: Pick<Area, "name" | "shortName"> | null): PlaceName {
  return area ? { name: area.name, short: area.shortName ?? area.name } : BAY_AREA;
}

export type AreaLink = { href: string; label: string; current: boolean };

export function areaLinks(election: string, areas: Pick<Area, "id" | "name">[], current: string | null): AreaLink[] {
  return [
    { href: `/${election}`, label: BAY_AREA.name, current: current === null },
    ...areas.map((a) => ({ href: `/${election}/${a.id}`, label: a.name, current: current === a.id })),
  ];
}
