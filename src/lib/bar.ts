import type { Contest, Entry } from "./schema";
import { tally, type CandidateCount, type Tally } from "./score";

// Candidate tones are four distinct hues (never the Yes/No colors); "other" is neutral.
export type BarTone = "yes" | "no" | "c1" | "c2" | "c3" | "c4" | "other" | "empty";
export type Slot = 1 | 2 | 3 | 4 | "other";
export type Slots = Map<string, Slot>;
export type BarSegment = { key: string; label: string; count: number; pct: number; tone: BarTone };
export type BarSummary = { aria: string; caption: string };

const SLOT_TONES = { 1: "c1", 2: "c2", 3: "c3", 4: "c4", other: "other" } as const;
const MAX_SLOTS = 4;
const EMPTY: BarSegment = { key: "none", label: "No picks yet", count: 0, pct: 100, tone: "empty" };

const guides = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

// Whole-number percents of `counts` that always sum to 100 (largest remainder).
function percents(counts: number[]): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  const exact = counts.map((c) => (100 * c) / sum);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    out[i] += 1;
  }
  return out;
}

const isEmpty = (t: Tally) => t.total === 0 || (t.kind === "candidate" && t.counts.length === 0);

// Color follows the candidate, never their rank: slots are assigned from the unfiltered counts, so a
// filter that drops the leader doesn't repaint anyone. The top four by count get slots 1-4 in
// ballot order (names not on the ballot list follow, by count then name); the rest are "other".
function slotsFromCounts(contest: Pick<Contest, "candidates">, counts: CandidateCount[]): Slots {
  const order = (name: string) => {
    const i = contest.candidates.indexOf(name);
    return i === -1 ? Infinity : i;
  };
  const endorsed = counts.filter((c) => c.count > 0);
  const byCount = [...endorsed].sort((a, b) => b.count - a.count || order(a.name) - order(b.name) || a.name.localeCompare(b.name, "en"));
  const kept = byCount.slice(0, MAX_SLOTS);
  const ranked = new Map(byCount.map((c, i) => [c.name, i]));
  const slotted = [...kept].sort((a, b) => order(a.name) - order(b.name) || (ranked.get(a.name) ?? 0) - (ranked.get(b.name) ?? 0));
  const out: Slots = new Map();
  slotted.forEach((c, i) => out.set(c.name, (i + 1) as Slot));
  for (const c of byCount.slice(MAX_SLOTS)) out.set(c.name, "other");
  return out;
}

// `entries` should be every published guide's entry for the contest, before filters.
export function candidateSlots(contest: Contest, entries: Entry[]): Slots {
  const t = tally(contest, entries);
  return t.kind === "candidate" ? slotsFromCounts(contest, t.counts) : new Map();
}

export function slotTone(slots: Slots, name: string): BarTone {
  return SLOT_TONES[slots.get(name) ?? "other"];
}

// What a collapsed contest's bar draws. Measures and single-seat races are one stacked bar whose
// segments sum to 100. Multi-seat races are up to `seats` independent bars, each `count` of `total` guides.
// `slots` (from candidateSlots on unfiltered entries) fixes each candidate's color; without it,
// slots come from this tally.
export function barSegments(t: Tally, contest: Pick<Contest, "seats" | "candidates">, slots?: Slots): BarSegment[] {
  if (isEmpty(t)) return [EMPTY];
  if (t.kind === "measure") {
    const sides = [
      { key: "Y", name: "Yes", count: t.yes, tone: "yes" as const },
      { key: "N", name: "No", count: t.no, tone: "no" as const },
    ].filter((s) => s.count > 0);
    const pct = percents(sides.map((s) => s.count));
    return sides.map((s, i) => ({ key: s.key, label: `${s.name} ${pct[i]}%`, count: s.count, pct: pct[i], tone: s.tone }));
  }
  const colors = slots ?? slotsFromCounts(contest, t.counts);
  if (contest.seats > 1) {
    return t.counts.slice(0, contest.seats).map((c) => ({
      key: c.name,
      label: c.name,
      count: c.count,
      pct: Math.round((100 * c.count) / t.total),
      tone: slotTone(colors, c.name),
    }));
  }
  const named = t.counts.filter((c) => colors.get(c.name) !== undefined && colors.get(c.name) !== "other");
  const rest = t.counts.filter((c) => !named.includes(c));
  const parts = named.map((c) => ({ key: c.name, label: c.name, count: c.count, tone: slotTone(colors, c.name) }));
  if (rest.length) {
    parts.push({ key: "others", label: `${rest.length} ${rest.length === 1 ? "other" : "others"}`, count: rest.reduce((n, c) => n + c.count, 0), tone: "other" });
  }
  const pct = percents(parts.map((p) => p.count));
  return parts.map((p, i) => ({ ...p, pct: pct[i] }));
}

// The bar's accessible name (role="img") and the short visible caption beside it.
export function barSummary(t: Tally, contest: Pick<Contest, "title" | "seats">): BarSummary {
  if (isEmpty(t)) return { aria: `${contest.title}: no picks yet`, caption: "No picks yet" };
  if (t.kind === "measure") {
    return {
      aria: `${contest.title}: ${t.yes} Yes, ${t.no} No`,
      caption: t.verdict === "split" ? `Split ${t.yes}–${t.no}` : `${Math.max(t.yes, t.no)} of ${guides(t.total)}`,
    };
  }
  if (contest.seats > 1) {
    const top = t.counts.slice(0, contest.seats);
    return { aria: `${contest.title}: ${top.map((c) => `${c.name} ${c.count} of ${t.total}`).join(", ")}`, caption: guides(t.total) };
  }
  const named = t.counts.slice(0, MAX_SLOTS);
  return {
    aria: `${contest.title}: ${t.counts.map((c) => `${c.name} ${c.count}`).join(", ")}`,
    caption: named.map((c) => `${c.name} ${c.count}`).join(" · ") + (t.counts.length > named.length ? " · …" : ""),
  };
}

const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

// The last name for tight labels: nicknames ("DJ", "Manny") and generational suffixes are dropped.
export function surname(name: string): string {
  const tokens = name
    .replace(/\([^)]*\)|["“”][^"“”]*["“”]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  while (tokens.length > 1 && SUFFIX.test(tokens.at(-1) as string)) tokens.pop();
  return tokens.at(-1) ?? name;
}

// A few words for the tightest rows: the measure verdict, the single-seat leader's share, or the seat count.
export function barShort(t: Tally, contest: Pick<Contest, "seats">): string {
  if (isEmpty(t)) return "No picks";
  if (t.kind === "measure") {
    if (t.verdict === "split") return "Split";
    return `${t.verdict === "Y" ? "Yes" : "No"} ${t.pct}%`;
  }
  if (contest.seats > 1) return `Top ${contest.seats}`;
  return t.leader === null ? "Split" : `${surname(t.leader)} ${t.pct}%`;
}


// The verdict a measure's text should wear: its winner (Yes always draws first, so never segment 0).
export function winnerTone(t: Tally): "yes" | "no" | "split" | null {
  if (t.kind !== "measure" || t.verdict === "none") return null;
  return t.verdict === "Y" ? "yes" : t.verdict === "N" ? "no" : "split";
}
