import { sections, type Section } from "./display";
import type { Area, Contest, Jurisdiction, Place } from "./schema";

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

export type PlaceGroup = { key: string; heading: string; county: string | null; sections: Section[] };

const countyOf = (a: AreaLike) => a.jurisdictions.find((j) => j.level === "county")?.name ?? null;

// A city area whose city is also its county (SF): city contests sit under the county.
function consolidated(county: string, areas: Area[]): boolean {
  return areas.some((a) => a.kind === "city" && countyOf(a) === county && a.jurisdictions.some((j) => j.level === "city" && j.name === county));
}

function cityCounty(name: string, areas: Area[]): string | null {
  const a = areas.find((x) => x.jurisdictions.some((j) => j.level === "city" && j.name === name));
  return a ? countyOf(a) : null;
}

type Slot = { key: string; county: string | null; city: string | null };
const STATE_SLOT: Slot = { key: "state", county: null, city: null };
const REGION_SLOT: Slot = { key: "region", county: null, city: null };

function slotOf(c: Contest, areas: Area[]): Slot {
  const j = c.jurisdiction;
  if (j.level === "state") return STATE_SLOT;
  if (j.level === "region") return REGION_SLOT;
  if (j.level === "district" && STATE_DISTRICTS.includes(j.name)) return STATE_SLOT;
  const p = j.level === "district" ? j.within?.[0] : { level: j.level, name: j.name };
  if (!p) return STATE_SLOT;
  if (p.level === "county") return { key: `county:${p.name}`, county: p.name, city: null };
  const county = cityCounty(p.name, areas);
  if (county === p.name && consolidated(county, areas)) return { key: `county:${county}`, county, city: null };
  return { key: `city:${p.name}`, county, city: p.name };
}

export function placeGroups(contests: Contest[], areas: Area[]): PlaceGroup[] {
  const slots = new Map<string, { slot: Slot; contests: Contest[] }>();
  for (const c of contests) {
    const slot = slotOf(c, areas);
    const s = slots.get(slot.key) ?? { slot, contests: [] };
    s.contests.push(c);
    slots.set(slot.key, s);
  }
  const counties = [...new Set(areas.map(countyOf).filter((x): x is string => x !== null))];
  const rank = (s: Slot) => (s === STATE_SLOT ? -2 : s === REGION_SLOT ? -1 : counties.indexOf(s.county ?? ""));
  const ordered = [...slots.values()].sort(
    (a, b) =>
      rank(a.slot) - rank(b.slot) ||
      Number(a.slot.city !== null) - Number(b.slot.city !== null) ||
      (a.slot.city ?? "").localeCompare(b.slot.city ?? ""),
  );
  return ordered.map(({ slot, contests: cs }) => ({
    key: slot.key,
    heading: slot === REGION_SLOT ? BAY_AREA.name : slot.city ?? (slot.county === null ? "California" : consolidated(slot.county, areas) ? slot.county : `${slot.county} County`),
    county: slot.county,
    sections: sections(cs),
  }));
}
