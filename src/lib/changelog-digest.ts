import { counted } from "./display";
import type { ChangelogEntry } from "./schema";

// Client-safe: no fs or zod imports.
export type Show = "all" | "site" | "data";
export const SHOWS: readonly Show[] = ["all", "site", "data"];

/** Class on a day's folded rows; the page's noscript style shows them, since nothing can expand a day without JavaScript. */
export const FOLDED_ROWS = "changelog-rows";

export type SiteItem = ChangelogEntry & { file: string };
export type DataRow = { file: string; guide: string | null; name: string | null; text: string; details?: string; pr?: number };
export type GuideRow = DataRow & { date: string };
export type DigestDay = { date: string; site: SiteItem[]; data: DataRow[] };
export type DigestArea = { id: string; name: string; guides: string[] };
export type DigestQuery = { show: Show; area: string | null };

type GuideName = { id: string; name: string };

export function dataRow(e: ChangelogEntry & { file: string }, guides: Map<string, GuideName>): DataRow {
  const g = e.guide ? guides.get(e.guide) : undefined;
  const extra = { ...(e.details ? { details: e.details } : {}), ...(e.pr ? { pr: e.pr } : {}) };
  if (!g) return { file: e.file, guide: null, name: null, text: e.title, ...extra };
  const named = e.title.startsWith(`${g.name} `);
  return { file: e.file, guide: g.id, name: named ? g.name : null, text: named ? e.title.slice(g.name.length + 1) : e.title, ...extra };
}

/** One guide's data entries, newest first, with its name dropped from the front of each title. */
export function guideHistory(entries: SiteItem[], guide: GuideName): GuideRow[] {
  const byId = new Map([[guide.id, guide]]);
  return entries
    .filter((e) => e.type === "data" && e.guide === guide.id)
    .map((e) => {
      const row = dataRow(e, byId);
      return { ...row, date: e.date, text: row.name ? row.text.charAt(0).toUpperCase() + row.text.slice(1) : row.text };
    });
}

export function changelogDays(entries: SiteItem[], guides: GuideName[]): DigestDay[] {
  const byId = new Map(guides.map((g) => [g.id, g]));
  const out: DigestDay[] = [];
  for (const e of entries) {
    let last = out.at(-1);
    if (last?.date !== e.date) {
      last = { date: e.date, site: [], data: [] };
      out.push(last);
    }
    if (e.type === "data") last.data.push(dataRow(e, byId));
    else last.site.push(e);
  }
  return out;
}

export const rowInArea = (row: Pick<DataRow, "guide">, guides: ReadonlySet<string> | null) => guides === null || row.guide === null || guides.has(row.guide);

export function dataSummary(rows: Pick<DataRow, "guide">[]): string {
  const guides = new Set(rows.flatMap((r) => (r.guide ? [r.guide] : []))).size;
  const updates = counted(rows.length, "update");
  if (guides === 0) return updates;
  return guides === rows.length ? `${counted(guides, "guide")} updated` : `${counted(guides, "guide")} updated · ${updates}`;
}

export function visibleDays(days: DigestDay[], { show, guides }: { show: Show; guides: ReadonlySet<string> | null }): DigestDay[] {
  return days
    .map((d) => ({ date: d.date, site: show === "data" ? [] : d.site, data: show === "site" ? [] : d.data.filter((r) => rowInArea(r, guides)) }))
    .filter((d) => d.site.length > 0 || d.data.length > 0);
}

export function readDigestQuery(search: string, areaIds: readonly string[]): DigestQuery {
  const q = new URLSearchParams(search);
  const show = SHOWS.find((s) => s === q.get("show")) ?? "all";
  const area = q.get("area");
  return { show, area: show !== "site" && area !== null && areaIds.includes(area) ? area : null };
}

export function digestSearch({ show, area }: DigestQuery): string {
  const q = new URLSearchParams();
  if (show !== "all") q.set("show", show);
  if (area) q.set("area", area);
  const s = q.toString();
  return s ? `?${s}` : "";
}
