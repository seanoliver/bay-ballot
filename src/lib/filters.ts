import type { Contest, EndorsementFile, Entry, Guide } from "./schema";

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
    if (!file || file.status !== "published") continue;
    if (f.off.includes(guide.id) || f.offTypes.includes(guide.type)) continue;
    if (f.whyOnly && !file.hasReasoning) continue;
    const entry = file.picks[contestId];
    if (entry) rows.push({ guide, entry, file });
  }
  return rows;
}

export function pendingGuides(guides: Guide[], ends: Record<string, EndorsementFile>): Guide[] {
  return guides.filter((g) => !ends[g.id] || ends[g.id].status === "pending");
}

export function visibleContest(c: Contest, f: Pick<Filters, "districts">): boolean {
  if (c.jurisdiction.level !== "district") return true;
  const chosen = f.districts[c.jurisdiction.name];
  return chosen === undefined || chosen === c.jurisdiction.district;
}
