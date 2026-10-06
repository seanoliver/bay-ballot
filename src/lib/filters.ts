import type { EndorsementFile, Entry, Guide, GuideType } from "./schema";

// `off` holds published guide ids the reader turned off; it is the only guide state.
// District filters were removed; an address lookup replaces them later. Old URLs may still carry
// sup/ad/cd/bart params; they are ignored and dropped on the next filter change.
export type Filters = {
  off: string[];
  whyOnly: boolean;
};

export const EMPTY: Filters = { off: [], whyOnly: false };

// What the ballot view needs about a guide and its published file (keeps client props small).
export type GuideInfo = Pick<Guide, "id" | "name" | "shortName" | "type">;
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

// Old URLs may carry `offtypes`; those expand to the ids of `guides` with those types.
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

// `files` holds published files only (see publishedFiles).
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

// A published guide counts toward tallies unless it's turned off, or is list-only under whyOnly.
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

// Drops guide ids a stale URL or stored value could carry that this election doesn't have.
export function sanitizeFilters(f: Filters, guides: Pick<Guide, "id">[]): Filters {
  const ids = new Set(guides.map((g) => g.id));
  return { off: f.off.filter((id) => ids.has(id)), whyOnly: f.whyOnly };
}

// Filter params in the URL win; otherwise the filters last saved on this device.
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

// Plural labels in display order. Kept here (not derived from the zod enum) so client code doesn't pull in zod.
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

// All on unless all are already on, in which case all off. `guides` are published guides.
export function toggleTypeGroup(f: Filters, type: string, guides: GuideInfo[]): Filters {
  const ids = guides.filter((g) => g.type === type).map((g) => g.id);
  if (typeState(type, f, guides) === "on") return { ...f, off: uniqSorted([...f.off, ...ids]) };
  return { ...f, off: f.off.filter((id) => !ids.includes(id)) };
}

// `heading` is label plus count, for accessible names; the UI shows the count in its own column.
export type GuideGroup = { type: GuideType; heading: string; label: string; count: number; guides: GuideInfo[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Published guides grouped by type; `query` filters by name or short name (case- and accent-insensitive).
// Headings count the whole type so the checkbox reads the same while searching.
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
