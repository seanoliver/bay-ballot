import { barSegments, candidateSlots, surname, type BarSegment, type BarTone, type Slots } from "./bar";
import { cardDescription, contestHeadline } from "./display";
import type { Row } from "./filters";
import type { Contest } from "./schema";
import { tally } from "./score";

// The data behind a contest's share image and share description, kept apart from the drawing.

export type ShareLegendItem = { label: string; count: number; tone: BarTone };
export type ShareSeat = { label: string; count: number; pct: number; tone: BarTone };
export type ShareCard = {
  title: string;
  kicker: string | null; // a measure's description
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

// Titles sized for a share card: common long forms shortened, then capped at a word boundary.
export function shortTitle(title: string): string {
  const t = title
    .replace(/^Proposition\b/, "Prop")
    .replace(/^United States Representative\b/, "U.S. Rep.")
    .replace(/^Board of Supervisors\b/, "Supervisor");
  if (t.length <= MAX_TITLE) return t;
  const cut = t.slice(0, MAX_TITLE - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
}

// `rows`: every published guide's entry for the contest (no filters), so the card matches a fresh visit.
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

const sfGuides = (n: number) => `${n} SF voter ${n === 1 ? "guide" : "guides"}`;

// One line for the page description and social previews.
export function shareDescription(card: ShareCard): string {
  const head = `${card.title}: `;
  if (card.lead === null) return `${head}no SF voter guide has taken a position yet`;
  if (card.multi) return `${head}${card.seats.map((s) => s.label).join(", ")} lead among ${sfGuides(card.total)}`;
  if (card.leadTone === "split") return `${head}split among ${sfGuides(card.total)}`;
  if (card.segments.length === 1 && card.leadTone === "candidate") return `${head}${card.lead}, endorsed by ${sfGuides(card.total)}`;
  return `${head}${card.lead} of ${sfGuides(card.total)}`;
}

// The contest most guides took a position on (the first on ties), for the site-wide example bar.
export function mostPositions<C extends { id: string }>(contests: C[], rowsFor: (id: string) => Row[]): C | undefined {
  let best: C | undefined;
  let most = -1;
  for (const c of contests) {
    const n = rowsFor(c.id).length;
    if (n > most) [best, most] = [c, n];
  }
  return best;
}
