import { BAY_AREA, type PlaceGroup } from "./areas";
import { activeEntries, type Filters, type GuideInfo, type PickFile, type Row } from "./filters";
import type { Area } from "./schema";
import { navModel } from "./section-nav";

export type Scope = "area" | "bay";
export const SCOPE_KEY = "bb-scope";

export type FallbackSection = { id: string; initial: Scope; contests: string[] };
export type Fallback = { place: string; sections: FallbackSection[]; guides: GuideInfo[]; files: Record<string, PickFile> };
type Pool = { guides: GuideInfo[]; files: Record<string, PickFile> };

const WIDE = new Set(["state", "region"]);
const taken = (id: string, { guides, files }: Pool) => guides.some((g) => files[g.id]?.picks[id]);

export function fallbackFor({ groups, place, local, bay }: { groups: PlaceGroup[]; place: string; local: Pool; bay: Pool }): Fallback | null {
  const nav = navModel(groups);
  const sections: FallbackSection[] = [];
  groups.forEach((g, gi) => {
    if (!WIDE.has(g.key)) return;
    g.sections.forEach((s, si) => {
      const contests = s.contests.filter((c) => !taken(c.id, local) && taken(c.id, bay)).map((c) => c.id);
      if (!contests.length) return;
      sections.push({ id: nav[gi].sections[si].id, initial: s.contests.some((c) => taken(c.id, local)) ? "area" : "bay", contests });
    });
  });
  if (!sections.length) return null;
  const ids = sections.flatMap((s) => s.contests);
  const files: Record<string, PickFile> = {};
  for (const g of bay.guides) {
    const file = bay.files[g.id];
    const picks = Object.fromEntries(ids.filter((id) => file?.picks[id]).map((id) => [id, file.picks[id]]));
    if (!Object.keys(picks).length) continue;
    const archived = file.archived?.filter((a) => Object.values(picks).some((e) => e.quotes.some((q) => q.source === a.source)));
    files[g.id] = { hasReasoning: file.hasReasoning, picks, ...(archived?.length ? { archived } : {}) };
  }
  return { place, sections, guides: bay.guides.filter((g) => files[g.id]), files };
}

export const fallbackRows = (contestId: string, fb: Pool, f: Filters): Row[] => activeEntries(contestId, fb.guides, fb.files, f);

export function parseScopes(raw: string | null): Record<string, Scope> {
  const out: Record<string, Scope> = {};
  for (const [k, v] of new URLSearchParams(raw ?? "")) if (v === "area" || v === "bay") out[k] = v;
  return out;
}

export function withScope(raw: string | null, key: string, scope: Scope): string {
  const p = new URLSearchParams(raw ?? "");
  p.set(key, scope);
  return p.toString();
}

export const sectionScope = (chosen: Scope | undefined, initial: Scope): Scope => chosen ?? initial;

export const scopeName = (area: Pick<Area, "name" | "shortName">) => area.shortName ?? area.name.replace(/ County$/, "");

export const bayLabel = (n: number) => `${n} ${n === 1 ? "guide" : "guides"} from across the ${BAY_AREA.name}`;

export const skippedLabel = (place: string) => `No ${place} guide has taken a position yet.`;
