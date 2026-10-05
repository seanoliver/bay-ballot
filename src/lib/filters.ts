import type { Ballot, Contest, EndorsementFile, Entry, Guide, GuideType } from "./schema";

export type Filters = {
  off: string[];
  offTypes: string[];
  whyOnly: boolean;
  districts: Record<string, string>;
};

export const EMPTY: Filters = { off: [], offTypes: [], whyOnly: false, districts: {} };

// URL param -> jurisdiction name. Order here is the serialization order.
const DISTRICT_PARAMS: Record<string, string> = {
  sup: "Supervisor",
  ad: "Assembly",
  cd: "Congress",
  bart: "BART",
};

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort();
const parseList = (v: string | null) => uniqSorted((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  const off = uniqSorted(f.off);
  const offTypes = uniqSorted(f.offTypes);
  if (off.length) p.set("off", off.join(","));
  if (offTypes.length) p.set("offtypes", offTypes.join(","));
  if (f.whyOnly) p.set("why", "1");
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) {
    const v = f.districts[name];
    if (v) p.set(param, v);
  }
  return p.toString();
}

export function fromQuery(q: string): Filters {
  const p = new URLSearchParams(q);
  const districts: Record<string, string> = {};
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) {
    const v = p.get(param);
    if (v) districts[name] = v;
  }
  return {
    off: parseList(p.get("off")),
    offTypes: parseList(p.get("offtypes")),
    whyOnly: p.get("why") === "1",
    districts,
  };
}

export type Row = { guide: Guide; entry: Entry; file: EndorsementFile };

export function activeEntries(
  contestId: string,
  guides: Guide[],
  ends: Record<string, EndorsementFile>,
  f: Filters,
): Row[] {
  const rows: Row[] = [];
  for (const guide of guides) {
    const file = ends[guide.id];
    if (!isPublished(file)) continue;
    if (!isCounted(f, guide, file)) continue;
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

export function visibleContest(c: Contest, f: Pick<Filters, "districts">): boolean {
  if (c.jurisdiction.level !== "district") return true;
  const chosen = f.districts[c.jurisdiction.name];
  return chosen === undefined || chosen === c.jurisdiction.district;
}

// A published guide counts toward tallies unless it's turned off by id or type, or is list-only under whyOnly.
function isCounted(f: Filters, guide: Guide, file: EndorsementFile): boolean {
  return isGuideOn(f, guide) && !(f.whyOnly && !file.hasReasoning);
}

export function isGuideOn(f: Filters, guide: Guide): boolean {
  return !f.off.includes(guide.id) && !f.offTypes.includes(guide.type);
}

export function filterSummary(
  f: Filters,
  guides: Guide[],
  ends: Record<string, EndorsementFile>,
): { counted: number; published: number } {
  const published = publishedGuides(guides, ends);
  return { counted: published.filter((g) => isCounted(f, g, ends[g.id])).length, published: published.length };
}

export function countedLabel({ counted, published }: { counted: number; published: number }): string {
  return `${counted} of ${published} ${published === 1 ? "guide" : "guides"} counted`;
}

export function hasFilterParams(q: string): boolean {
  const p = new URLSearchParams(q);
  return ["off", "offtypes", "why", ...Object.keys(DISTRICT_PARAMS)].some((k) => p.has(k));
}

// Filterable district types (those with a URL param) -> the districts on this ballot, numerically sorted.
export function districtOptions(ballot: Pick<Ballot, "contests">): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const name of Object.values(DISTRICT_PARAMS)) {
    const ds = ballot.contests
      .filter((c) => c.jurisdiction.level === "district" && c.jurisdiction.name === name && c.jurisdiction.district)
      .map((c) => c.jurisdiction.district as string);
    if (ds.length) out[name] = [...new Set(ds)].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }
  return out;
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

export function guideTypeOptions(
  guides: Guide[],
  ends: Record<string, EndorsementFile>,
): { type: GuideType; label: string }[] {
  const present = new Set(publishedGuides(guides, ends).map((g) => g.type));
  return (Object.keys(TYPE_LABELS) as GuideType[])
    .filter((t) => present.has(t))
    .map((type) => ({ type, label: TYPE_LABELS[type] }));
}

// Drops anything a stale URL or stored value could carry that this election doesn't have.
export function sanitizeFilters(f: Filters, ballot: Pick<Ballot, "contests">, guides: Guide[]): Filters {
  const ids = new Set(guides.map((g) => g.id));
  const opts = districtOptions(ballot);
  const districts: Record<string, string> = {};
  for (const [name, v] of Object.entries(f.districts)) {
    if (opts[name]?.includes(v)) districts[name] = v;
  }
  return {
    off: f.off.filter((id) => ids.has(id)),
    offTypes: f.offTypes.filter((t) => t in TYPE_LABELS),
    whyOnly: f.whyOnly,
    districts,
  };
}

const without = (xs: string[], x: string) => xs.filter((y) => y !== x);

// Turning on a guide whose whole type is off turns that type back on but keeps its siblings off.
export function toggleGuide(f: Filters, guide: Guide, guides: Guide[]): Filters {
  if (isGuideOn(f, guide)) return { ...f, off: uniqSorted([...f.off, guide.id]) };
  if (!f.offTypes.includes(guide.type)) return { ...f, off: without(f.off, guide.id) };
  const siblings = guides.filter((g) => g.type === guide.type && g.id !== guide.id).map((g) => g.id);
  return { ...f, offTypes: without(f.offTypes, guide.type), off: uniqSorted([...without(f.off, guide.id), ...siblings]) };
}

// Turning a type back on turns all of its guides on.
export function toggleType(f: Filters, type: string, guides: Guide[]): Filters {
  if (!f.offTypes.includes(type)) return { ...f, offTypes: uniqSorted([...f.offTypes, type]) };
  const ofType = new Set(guides.filter((g) => g.type === type).map((g) => g.id));
  return { ...f, offTypes: without(f.offTypes, type), off: f.off.filter((id) => !ofType.has(id)) };
}
