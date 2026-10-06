import { barSegments, candidateSlots, surname, type BarSegment, type BarTone, type Slots } from "./bar";
import { cardDescription, contestHeadline } from "./display";
import type { Row } from "./filters";
import type { Contest } from "./schema";
import { tally } from "./score";

export type ShareLegendItem = { label: string; count: number; tone: BarTone };
export type ShareSeat = { label: string; count: number; pct: number; tone: BarTone };
export type ShareCard = {
  title: string;
  kicker: string | null;
  lead: string | null;
  leadTone: "yes" | "no" | "split" | "candidate" | "none";
  sub: string;
  ranked: boolean;
  multi: boolean;
  segments: BarSegment[];
  legend: ShareLegendItem[];
  seats: ShareSeat[];
  total: number;
};

const MAX_TITLE = 56;
const guides = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

export function shortTitle(title: string): string {
  const t = title
    .replace(/^Proposition\b/, "Prop")
    .replace(/^United States Representative\b/, "U.S. Rep.")
    .replace(/^Board of Supervisors\b/, "Supervisor");
  if (t.length <= MAX_TITLE) return t;
  const cut = t.slice(0, MAX_TITLE - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
}

export function shareCard(contest: Contest, rows: Row[], slots?: Slots): ShareCard {
  const entries = rows.map((r) => r.entry);
  const t = tally(contest, entries);
  const colors = slots ?? candidateSlots(contest, entries);
  const base = {
    title: shortTitle(contest.title),
    kicker: cardDescription(contest),
    ranked: contestHeadline(contest, rows).headline.ranked,
    multi: false,
    segments: [] as BarSegment[],
    legend: [] as ShareLegendItem[],
    seats: [] as ShareSeat[],
    total: t.total,
  };
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) {
    return { ...base, lead: null, leadTone: "none", sub: "No guide has taken a position yet" };
  }

  const segments = barSegments(t, contest, colors);
  if (t.kind === "measure") {
    const legend = segments.map((s) => ({ label: s.key === "Y" ? "Yes" : "No", count: s.count, tone: s.tone }));
    if (t.verdict === "split") return { ...base, segments, legend, lead: "Split", leadTone: "split", sub: guides(t.total) };
    const yes = t.verdict === "Y";
    return {
      ...base,
      segments,
      legend,
      lead: `${yes ? "Yes" : "No"} ${t.pct}%`,
      leadTone: yes ? "yes" : "no",
      sub: `${Math.max(t.yes, t.no)} of ${guides(t.total)}`,
    };
  }

  if (contest.seats > 1) {
    const seats = segments.map((s) => ({ label: s.label, count: s.count, pct: s.pct, tone: s.tone }));
    return { ...base, multi: true, seats, lead: `Top ${contest.seats} of ${t.counts.length} candidates`, leadTone: "candidate", sub: guides(t.total) };
  }

  const legend = segments.map((s) => ({ label: s.key === "others" ? s.label : surname(s.label), count: s.count, tone: s.tone }));
  if (t.counts.length === 1) {
    return { ...base, segments, legend, lead: t.counts[0].name, leadTone: "candidate", sub: `${guides(t.counts[0].count)}, no other endorsements` };
  }
  if (t.leader === null) return { ...base, segments, legend, lead: "Split", leadTone: "split", sub: guides(t.total) };
  return { ...base, segments, legend, lead: `${t.leader} ${t.pct}%`, leadTone: "candidate", sub: `${t.count} of ${guides(t.total)}` };
}

export function mostPositions<C extends { id: string }>(contests: C[], rowsFor: (id: string) => Row[]): C | undefined {
  let best: C | undefined;
  let most = -1;
  for (const c of contests) {
    const n = rowsFor(c.id).length;
    if (n > most) [best, most] = [c, n];
  }
  return best;
}

export function breakLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    const line: string[] = [];
    while (i < words.length && [...line, words[i]].join(" ").length <= maxChars) line.push(words[i++]);
    if (line.length === 0) line.push(words[i++]); // a word longer than maxChars; without this the loop never advances
    if (line.length > 1 && line.at(-1) === "·" && i < words.length) {
      line.pop();
      i -= 1;
    }
    lines.push(line);
  }
  const out = lines.map((l) => l.join(" "));
  if (i < words.length) {
    let last = out[out.length - 1];
    while (last.length > maxChars - 1 && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    out[out.length - 1] = `${last.replace(/[\s,.;:·]+$/, "")}…`;
  }
  return out;
}

export function shareLabel(iso: string, place: string): string {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} · ${place}`;
}
