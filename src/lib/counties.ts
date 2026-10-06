import type { PlaceGroup } from "./areas";

export const COUNTIES_PARAM = "offc";
export const COUNTIES_KEY = "bb-counties";

export type CountyOption = { id: string; name: string };

export const countySlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function countyOptions(groups: PlaceGroup[]): CountyOption[] {
  const out: CountyOption[] = [];
  for (const g of groups) if (g.county !== null && !out.some((o) => o.name === g.county)) out.push({ id: countySlug(g.county), name: g.county });
  return out;
}

export const showCountyFilter = (options: CountyOption[]) => options.length > 1;

export function parseCounties(value: string | null, options: CountyOption[]): string[] {
  const known = new Set(options.map((o) => o.id));
  return [...new Set((value ?? "").split(",").map((s) => s.trim()).filter((s) => known.has(s)))].sort();
}

export const toCountiesParam = (off: string[]) => [...new Set(off)].sort().join(",");

export function toggleCounty(off: string[], id: string): string[] {
  return off.includes(id) ? off.filter((x) => x !== id) : [...off, id].sort();
}

export function visibleGroups(groups: PlaceGroup[], off: string[]): PlaceGroup[] {
  return groups.filter((g) => g.county === null || !off.includes(countySlug(g.county)));
}

export function hiddenCountyOf(groups: PlaceGroup[], off: string[], contestId: string | null): CountyOption | null {
  if (contestId === null) return null;
  const g = groups.find((x) => x.county !== null && x.sections.some((s) => s.contests.some((c) => c.id === contestId)));
  if (!g?.county) return null;
  const id = countySlug(g.county);
  return off.includes(id) ? { id, name: g.county } : null;
}

export const hiddenCountiesLabel = (n: number) => (n === 0 ? "" : `${n} ${n === 1 ? "county" : "counties"} hidden`);

export function viewCounties(groups: PlaceGroup[], off: string[], contestId: string | null): { off: string[]; revealed: CountyOption | null } {
  const revealed = hiddenCountyOf(groups, off, contestId);
  return { off: revealed ? off.filter((x) => x !== revealed.id) : off, revealed };
}
