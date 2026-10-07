import type { EndorsementFile, Entry, Guide, GuideType } from "./schema";

export type Filters = {
  off: string[];
  whyOnly: boolean;
};

export const FILTERS_KEY = "bb-filters";

export const EMPTY: Filters = { off: [], whyOnly: false };

export type GuideInfo = Pick<Guide, "id" | "name" | "shortName" | "type">;
export type FilterGuide = Pick<Guide, "id" | "type">;
export type PickFile = Pick<EndorsementFile, "hasReasoning" | "picks" | "archived">;

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort();
const parseList = (v: string | null) => uniqSorted((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const without = (xs: string[], x: string) => xs.filter((y) => y !== x);

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  const off = uniqSorted(f.off);
  if (off.length) p.set("off", off.join(","));
  if (f.whyOnly) p.set("why", "1");
  return p.toString();
}

// Nothing writes `offtypes` any more, but old shared URLs still carry it.
export function fromQuery(q: string, guides: Pick<Guide, "id" | "type">[] = []): Filters {
  const p = new URLSearchParams(q);
  const offTypes = parseList(p.get("offtypes"));
  const fromTypes = guides.filter((g) => offTypes.includes(g.type)).map((g) => g.id);
  return {
    off: uniqSorted([...parseList(p.get("off")), ...fromTypes]),
    whyOnly: p.get("why") === "1",
  };
}

export function hasFilterParams(q: string): boolean {
  const p = new URLSearchParams(q);
  return ["off", "offtypes", "why"].some((k) => p.has(k));
}

export type Row = { guide: GuideInfo; entry: Entry; file: PickFile };

export function activeEntries(contestId: string, guides: GuideInfo[], files: Record<string, PickFile>, f: Filters): Row[] {
  const rows: Row[] = [];
  for (const guide of guides) {
    const file = files[guide.id];
    if (!file || !isCounted(f, guide.id, file)) continue;
    const entry = file.picks[contestId];
    if (entry) rows.push({ guide, entry, file });
  }
  return rows;
}

export function isPublished(file: EndorsementFile | undefined): file is EndorsementFile {
  return file?.status === "published";
}

export function publishedGuides(guides: Guide[], ends: Record<string, EndorsementFile>): Guide[] {
  return guides.filter((g) => isPublished(ends[g.id]));
}

export function pendingGuides(guides: Guide[], ends: Record<string, EndorsementFile>): Guide[] {
  return guides.filter((g) => !ends[g.id] || ends[g.id].status === "pending");
}

export function publishedFiles(ends: Record<string, EndorsementFile>): Record<string, PickFile> {
  const out: Record<string, PickFile> = {};
  for (const [id, file] of Object.entries(ends)) {
    if (!isPublished(file)) continue;
    out[id] = { hasReasoning: file.hasReasoning, picks: file.picks, ...(file.archived ? { archived: file.archived } : {}) };
  }
  return out;
}

function isCounted(f: Filters, id: string, file: PickFile): boolean {
  return isGuideOn(f, id) && !(f.whyOnly && !file.hasReasoning);
}

export function isGuideOn(f: Filters, id: string): boolean {
  return !f.off.includes(id);
}

export function toggleGuide(f: Filters, id: string): Filters {
  return { ...f, off: isGuideOn(f, id) ? uniqSorted([...f.off, id]) : without(f.off, id) };
}

export function filterSummary(
  f: Filters,
  guides: GuideInfo[],
  files: Record<string, PickFile>,
): { counted: number; published: number } {
  const published = guides.filter((g) => files[g.id]);
  return { counted: published.filter((g) => isCounted(f, g.id, files[g.id])).length, published: published.length };
}

export function countedLabel({ counted, published }: { counted: number; published: number }): string {
  return `${counted} of ${published} ${published === 1 ? "guide" : "guides"} counted`;
}

export function sanitizeFilters(f: Filters, guides: Pick<Guide, "id">[]): Filters {
  const ids = new Set(guides.map((g) => g.id));
  return { off: f.off.filter((id) => ids.has(id)), whyOnly: f.whyOnly };
}

export function initialFilters({
  query,
  stored,
  guides,
}: {
  query: string;
  stored: string | null;
  guides: Pick<Guide, "id" | "type">[];
}): Filters {
  const raw = hasFilterParams(query) ? query : (stored ?? "");
  return sanitizeFilters(fromQuery(raw, guides), guides);
}

// Not derived from the zod enum: client code must not import zod.
const TYPE_LABELS: Record<GuideType, string> = {
  newspaper: "Newspapers",
  party: "Parties",
  club: "Political clubs",
  union: "Unions",
  advocacy: "Advocacy groups",
  civic: "Civic groups",
};

export function typeState(type: string, f: Filters, guides: GuideInfo[]): "on" | "mixed" | "off" {
  const ofType = guides.filter((g) => g.type === type);
  const on = ofType.filter((g) => isGuideOn(f, g.id)).length;
  if (on === ofType.length) return "on";
  return on === 0 ? "off" : "mixed";
}

export function toggleTypeGroup(f: Filters, type: string, guides: GuideInfo[]): Filters {
  return setTypeGroup(f, type, guides, typeState(type, f, guides) !== "on");
}

export function setTypeGroup(f: Filters, type: string, guides: FilterGuide[], on: boolean): Filters {
  const ids = guides.filter((g) => g.type === type).map((g) => g.id);
  return { ...f, off: on ? f.off.filter((id) => !ids.includes(id)) : uniqSorted([...f.off, ...ids]) };
}

export type GuideGroup = { type: GuideType; heading: string; label: string; count: number; guides: GuideInfo[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function guideGroups(guides: GuideInfo[], files: Record<string, PickFile>, query: string): GuideGroup[] {
  const q = fold(query.trim());
  const out: GuideGroup[] = [];
  for (const [type, label] of Object.entries(TYPE_LABELS) as [GuideType, string][]) {
    const ofType = guides.filter((g) => g.type === type && files[g.id]);
    const matching = ofType.filter((g) => fold(g.name).includes(q) || fold(g.shortName ?? "").includes(q));
    if (matching.length) out.push({ type, heading: `${label} (${ofType.length})`, label, count: ofType.length, guides: matching });
  }
  return out;
}

export function filterQuery(query: string, ignore: string[]): string {
  const p = new URLSearchParams(query);
  for (const k of ignore) p.delete(k);
  return p.toString();
}

export function positionGuides(contestId: string, guides: GuideInfo[], files: Record<string, PickFile>): GuideInfo[] {
  return guides.filter((g) => files[g.id]?.picks[contestId]);
}

export function contestFiles(contestId: string, files: Record<string, PickFile>): Record<string, PickFile> {
  const out: Record<string, PickFile> = {};
  for (const [id, file] of Object.entries(files)) {
    const entry = file.picks[contestId];
    if (!entry) continue;
    const { archived, ...rest } = file;
    const kept = archived?.filter((a) => entry.quotes.some((q) => q.source === a.source));
    out[id] = { ...rest, picks: { [contestId]: entry }, ...(kept?.length ? { archived: kept } : {}) };
  }
  return out;
}

export function revealGuides(f: Filters, ids: string[], files: Record<string, PickFile>): Filters {
  return { off: f.off.filter((id) => !ids.includes(id)), whyOnly: f.whyOnly && ids.every((id) => files[id]?.hasReasoning) };
}

export const hiddenLabel = (n: number) => `${n} ${n === 1 ? "guide" : "guides"} hidden`;

export function carryQuery(search: string, keys: string[]): string {
  const from = new URLSearchParams(search);
  const p = new URLSearchParams();
  for (const [k, v] of from) if (keys.includes(k)) p.append(k, v);
  const q = p.toString();
  return q ? `?${q}` : "";
}
