import type { Ballot, Contest, EndorsementFile, Entry, Guide, Quote } from "./schema";
import type { Row } from "./filters";
import { countedNames, tally } from "./score";
import type { Tally } from "./score";

export type Headline = {
  tone: "yes" | "no" | "candidate" | "split" | "none";
  label: string;
  detail: string;
  ranked: boolean;
};

export type PickGroup = { key: string; label: string; tone: "yes" | "no" | "candidate"; rows: Row[] };
export type TopPick = { name: string; count: number; total: number };
export type RankedDetail = { guideName: string; order: string[] };

// Multi-seat races have no single winner, so they never read as "Split"; topPicks lists the names.
export function headline(t: Tally, seats = 1): Headline {
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) return { tone: "none", label: "No picks yet", detail: "", ranked: false };
  if (t.kind === "candidate" && seats > 1) return { tone: "candidate", label: "Most endorsed", detail: "", ranked: false };
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

// The `seats` most-endorsed names; every name tied with the last seat is included.
export function topPicks(t: Tally, seats: number): TopPick[] {
  if (t.kind !== "candidate" || t.counts.length === 0) return [];
  const cutoff = t.counts[Math.min(seats, t.counts.length) - 1].count;
  return t.counts.filter((c) => c.count >= cutoff).map((c) => ({ name: c.name, count: c.count, total: t.total }));
}

export function groupByPick(contest: Contest, rows: Row[]): PickGroup[] {
  const t = tally(contest, rows.map((r) => r.entry));
  if (t.kind === "measure") {
    const groups: PickGroup[] = [
      { key: "Y", label: "Yes", tone: "yes", rows: rows.filter((r) => r.entry.pick === "Y") },
      { key: "N", label: "No", tone: "no", rows: rows.filter((r) => r.entry.pick === "N") },
    ];
    return groups.filter((g) => g.rows.length > 0);
  }
  return t.counts.map((c) => ({
    key: c.name,
    label: c.name,
    tone: "candidate" as const,
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

export function contestHeadline(contest: Contest, rows: Row[]): { headline: Headline; topPicks: TopPick[] } {
  const t = tally(contest, rows.map((r) => r.entry));
  return { headline: headline(t, contest.seats), topPicks: contest.seats > 1 ? topPicks(t, contest.seats) : [] };
}

// The one-line description under a contest title; candidate races are described by their title.
export function cardDescription(contest: Contest): string | null {
  return contest.kind === "measure" && contest.description ? contest.description : null;
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

// A guide's pick as it counts toward the tally: a ranked single-seat pick shows only its #1, marked ranked.
export function rowPick(contest: Contest, entry: Entry): { label: string; ranked: boolean } {
  if (!Array.isArray(entry.pick)) return { label: pickLabel(entry), ranked: false };
  return { label: countedNames(contest, entry).join(", "), ranked: entry.ranked };
}

// Quotes to show for a row; none when the guide doesn't publish reasoning.
export function reasons(row: Row): Quote[] {
  return row.file.hasReasoning ? row.entry.quotes : [];
}

// Why a row shows no quote; null when it has one.
export function rowNote(row: Row): string | null {
  if (!row.file.hasReasoning) return "Publishes a list only, no reasons";
  return row.entry.quotes.length > 0 ? null : "No quote for this pick";
}

export function rankedLine(entry: Entry): string | null {
  return entry.ranked && Array.isArray(entry.pick) ? `Ranked: ${rankedLabel(entry.pick)}` : null;
}

// Prefer the archived snapshot so links survive the guide page changing or going away.
export function sourceLink(file: EndorsementFile, url: string): string {
  return file.archived?.find((a) => a.source === url)?.snapshot ?? url;
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


// "San Francisco · November 3, 2026": the city on the ballot (else the ballot title) and election day.
export function electionSubtitle(ballot: Pick<Ballot, "title" | "date" | "contests">): string {
  const city = ballot.contests.find((c) => c.jurisdiction.level === "city")?.jurisdiction.name;
  return `${city ?? ballot.title} · ${formatDate(ballot.date)}`;
}

export function topPickCount(p: TopPick): string {
  return `${p.count} of ${p.total} ${p.total === 1 ? "guide" : "guides"}`;
}
