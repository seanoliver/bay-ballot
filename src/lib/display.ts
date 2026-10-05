import type { Contest, EndorsementFile, Entry, Guide, Quote } from "./schema";
import type { Row } from "./filters";
import { countedNames, tally } from "./score";
import type { Tally } from "./score";

export type Headline = {
  tone: "yes" | "no" | "candidate" | "split" | "none";
  label: string;
  detail: string;
  ranked: boolean;
};

export type PickGroup = { key: string; label: string; rows: Row[] };
export type RankedDetail = { guideName: string; order: string[] };

export function headline(t: Tally): Headline {
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) return { tone: "none", label: "No picks yet", detail: "", ranked: false };
  if (t.kind === "measure") {
    if (t.verdict === "split") {
      return { tone: "split", label: "Split", detail: `${t.yes} Yes · ${t.no} No`, ranked: false };
    }
    const yes = t.verdict === "Y";
    return {
      tone: yes ? "yes" : "no",
      label: `${yes ? "Yes" : "No"} ${t.pct}%`,
      detail: `${Math.max(t.yes, t.no)} of ${t.total}`,
      ranked: false,
    };
  }
  if (t.split || t.leader === null) {
    return { tone: "split", label: "Split", detail: t.tied.join(", "), ranked: false };
  }
  return {
    tone: "candidate",
    label: t.leader,
    detail: `${t.pct}% (${t.count} of ${t.total})`,
    ranked: t.leaderRanked,
  };
}

export function runnersUp(t: Tally): string {
  if (t.kind !== "candidate" || t.split || t.leader === null) return "";
  return t.counts
    .slice(1)
    .map((c) => `${c.name} ${c.count}`)
    .join(" · ");
}

export function groupByPick(contest: Contest, rows: Row[]): PickGroup[] {
  const t = tally(contest, rows.map((r) => r.entry));
  if (t.kind === "measure") {
    const groups: PickGroup[] = [
      { key: "Y", label: "Yes", rows: rows.filter((r) => r.entry.pick === "Y") },
      { key: "N", label: "No", rows: rows.filter((r) => r.entry.pick === "N") },
    ];
    return groups.filter((g) => g.rows.length > 0);
  }
  return t.counts.map((c) => ({
    key: c.name,
    label: c.name,
    rows: rows.filter((r) => countedNames(contest, r.entry).includes(c.name)),
  }));
}

export function rankedDetails(rows: Row[]): RankedDetail[] {
  const out: RankedDetail[] = [];
  for (const r of rows) {
    if (r.entry.ranked && Array.isArray(r.entry.pick)) {
      out.push({ guideName: r.guide.name, order: r.entry.pick });
    }
  }
  return out;
}

export function pendingNote(guides: Guide[]): string | null {
  const n = guides.length;
  if (n === 0) return null;
  return n === 1 ? "1 guide hasn't published yet" : `${n} guides haven't published yet`;
}

export function contestHeadline(contest: Contest, rows: Row[]): { headline: Headline; runnersUp: string } {
  const t = tally(contest, rows.map((r) => r.entry));
  return { headline: headline(t), runnersUp: runnersUp(t) };
}

export type Section = { name: string; contests: Contest[] };

export function sections(contests: Contest[]): Section[] {
  const out: Section[] = [];
  for (const c of contests) {
    const s = out.find((x) => x.name === c.section);
    if (s) s.contests.push(c);
    else out.push({ name: c.section, contests: [c] });
  }
  return out;
}

export function rankedLabel(order: string[]): string {
  return order.map((n, i) => `${i + 1}. ${n}`).join(", ");
}

export function pickLabel(entry: Entry): string {
  if (entry.pick === "Y") return "Yes";
  if (entry.pick === "N") return "No";
  return entry.ranked ? rankedLabel(entry.pick) : entry.pick.join(", ");
}

// Quotes to show for a row; none when the guide doesn't publish reasoning.
export function reasons(row: Row): Quote[] {
  return row.file.hasReasoning ? row.entry.quotes : [];
}

export type GuidePick = { contest: Contest; entry: Entry; label: string };

export function guidePicks(contests: Contest[], file: EndorsementFile): GuidePick[] {
  const out: GuidePick[] = [];
  for (const contest of contests) {
    const entry = file.picks[contest.id];
    if (entry) out.push({ contest, entry, label: pickLabel(entry) });
  }
  return out;
}

// Dates are calendar days; read the YYYY-MM-DD prefix in UTC so the server's timezone can't shift them.
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

export function formatDate(iso: string): string {
  return day(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

export function monthYear(iso: string): string {
  return day(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long" });
}

export function guidesPublished(n: number): string {
  return `${n} ${n === 1 ? "guide" : "guides"} published`;
}
