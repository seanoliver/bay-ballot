import type { Ballot, Contest, EndorsementFile, Entry, Guide, GuideType } from "./schema";

// `off` holds published guide ids the reader turned off; it is the only guide state.
export type Filters = {
  off: string[];
  whyOnly: boolean;
  districts: Record<string, string>;
};

export const EMPTY: Filters = { off: [], whyOnly: false, districts: {} };

// What the ballot view needs about a guide and its published file (keeps client props small).
export type GuideInfo = Pick<Guide, "id" | "name" | "type">;
export type PickFile = Pick<EndorsementFile, "hasReasoning" | "picks" | "archived">;

// URL param -> jurisdiction name. Order here is the serialization order.
const DISTRICT_PARAMS: Record<string, string> = {
  sup: "Supervisor",
  ad: "Assembly",
  cd: "Congress",
  bart: "BART",
};

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort();
const parseList = (v: string | null) => uniqSorted((v ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const without = (xs: string[], x: string) => xs.filter((y) => y !== x);

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  const off = uniqSorted(f.off);
  if (off.length) p.set("off", off.join(","));
  if (f.whyOnly) p.set("why", "1");
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) {
    const v = f.districts[name];
    if (v) p.set(param, v);
  }
  return p.toString();
}

// Old URLs may carry `offtypes`; those expand to the ids of `guides` with those types.
export function fromQuery(q: string, guides: Pick<Guide, "id" | "type">[] = []): Filters {
  const p = new URLSearchParams(q);
  const districts: Record<string, string> = {};
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) {
    const v = p.get(param);
    if (v) districts[name] = v;
  }
  const offTypes = parseList(p.get("offtypes"));
  const fromTypes = guides.filter((g) => offTypes.includes(g.type)).map((g) => g.id);
  return {
    off: uniqSorted([...parseList(p.get("off")), ...fromTypes]),
    whyOnly: p.get("why") === "1",
    districts,
  };
}

export function hasFilterParams(q: string): boolean {
  const p = new URLSearchParams(q);
  return ["off", "offtypes", "why", ...Object.keys(DISTRICT_PARAMS)].some((k) => p.has(k));
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

export function visibleContest(c: Contest, f: Pick<Filters, "districts">): boolean {
  if (c.jurisdiction.level !== "district") return true;
  const chosen = f.districts[c.jurisdiction.name];
  return chosen === undefined || chosen === c.jurisdiction.district;
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

export type DistrictSelect = { name: string; items: { value: string | null; label: string }[] };

export function districtSelect(ballot: Pick<Ballot, "contests">): DistrictSelect[] {
  return Object.entries(districtOptions(ballot)).map(([name, ds]) => ({
    name,
    items: [{ value: null, label: "All" }, ...ds.map((d) => ({ value: d, label: `District ${d}` }))],
  }));
}

export function setDistrict(f: Filters, name: string, value: string | null): Filters {
  const districts = { ...f.districts };
  if (value === null) delete districts[name];
  else districts[name] = value;
  return { ...f, districts };
}

// Drops anything a stale URL or stored value could carry that this election doesn't have.
export function sanitizeFilters(f: Filters, ballot: Pick<Ballot, "contests">, guides: Pick<Guide, "id">[]): Filters {
  const ids = new Set(guides.map((g) => g.id));
  const opts = districtOptions(ballot);
  const districts: Record<string, string> = {};
  for (const [name, v] of Object.entries(f.districts)) {
    if (opts[name]?.includes(v)) districts[name] = v;
  }
  return { off: f.off.filter((id) => ids.has(id)), whyOnly: f.whyOnly, districts };
}

// Filter params in the URL win; otherwise the filters last saved on this device.
export function initialFilters({
  query,
  stored,
  ballot,
  guides,
}: {
  query: string;
  stored: string | null;
  ballot: Pick<Ballot, "contests">;
  guides: Pick<Guide, "id" | "type">[];
}): Filters {
  const raw = hasFilterParams(query) ? query : (stored ?? "");
  return sanitizeFilters(fromQuery(raw, guides), ballot, guides);
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

export type GuideGroup = { type: GuideType; heading: string; guides: GuideInfo[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Published guides grouped by type; `query` filters by name (case- and accent-insensitive).
// Headings count the whole type so the checkbox reads the same while searching.
export function guideGroups(guides: GuideInfo[], files: Record<string, PickFile>, query: string): GuideGroup[] {
  const q = fold(query.trim());
  const out: GuideGroup[] = [];
  for (const [type, label] of Object.entries(TYPE_LABELS) as [GuideType, string][]) {
    const ofType = guides.filter((g) => g.type === type && files[g.id]);
    const matching = ofType.filter((g) => fold(g.name).includes(q));
    if (matching.length) out.push({ type, heading: `${label} (${ofType.length})`, guides: matching });
  }
  return out;
}
