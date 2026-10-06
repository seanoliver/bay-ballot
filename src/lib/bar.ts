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
// A race with a single endorsed candidate is neutral throughout.
function slotsFromCounts(contest: Pick<Contest, "candidates">, counts: CandidateCount[]): Slots {
  const order = (name: string) => {
    const i = contest.candidates.indexOf(name);
    return i === -1 ? Infinity : i;
  };
  const endorsed = counts.filter((c) => c.count > 0);
  // A lone candidate has no rival to tell apart; a color would only suggest a contest.
  if (endorsed.length === 1) return new Map([[endorsed[0].name, "other"]]);
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
  if (t.counts.length === 1) {
    const c = t.counts[0];
    return [{ key: c.name, label: c.name, count: c.count, pct: 100, tone: slotTone(colors, c.name) }];
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

const guidesOf = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;
const single = (t: Tally, contest: Pick<Contest, "seats">) => t.kind === "candidate" && contest.seats === 1 && t.counts.length === 1;

// The bar's accessible name (it is role="img").
export function barSummary(t: Tally, contest: Pick<Contest, "title" | "seats">): { aria: string } {
  if (isEmpty(t)) return { aria: `${contest.title}: no picks yet` };
  if (t.kind === "measure") return { aria: `${contest.title}: ${t.yes} Yes, ${t.no} No` };
  if (contest.seats > 1) {
    return { aria: `${contest.title}: ${t.counts.slice(0, contest.seats).map((c) => `${c.name} ${c.count} of ${t.total}`).join(", ")}` };
  }
  const names = t.counts.map((c) => `${c.name} ${c.count}`).join(", ");
  return { aria: `${contest.title}: ${names}${t.counts.length === 1 ? ", no other endorsements" : ""}` };
}

export type LegendItem = { key: string; label: string; value: string; tone: BarTone | "split" };
export type BarLegend = { lead: LegendItem | null; others: LegendItem[]; caption: string };

// The line under a list bar, one grammar everywhere: the answer (winner's share, or the leader's),
// then the rest as counts, then the guide total once. A single candidate gets no % (it isn't a contest).
export function barLegend(t: Tally, contest: Pick<Contest, "seats" | "candidates">, slots?: Slots): BarLegend {
  if (isEmpty(t)) return { lead: null, others: [], caption: "No picks yet" };
  if (t.kind === "measure") {
    if (t.verdict === "split") return { lead: { key: "split", label: "Split", value: `${t.yes}–${t.no}`, tone: "split" }, others: [], caption: guidesOf(t.total) };
    const yes = t.verdict === "Y";
    return {
      lead: { key: yes ? "Y" : "N", label: yes ? "Yes" : "No", value: `${t.pct}%`, tone: yes ? "yes" : "no" },
      others: [],
      caption: `${Math.max(t.yes, t.no)} of ${guidesOf(t.total)}`,
    };
  }
  const segments = barSegments(t, contest, slots);
  if (single(t, contest)) {
    const c = t.counts[0];
    return { lead: { key: c.name, label: c.name, value: "", tone: segments[0].tone }, others: [], caption: `${guidesOf(c.count)}, no other endorsements` };
  }
  const items = segments.map((s): LegendItem => ({ key: s.key, label: s.label, value: String(s.count), tone: s.tone }));
  if (t.leader === null) return { lead: null, others: items, caption: `Split · ${guidesOf(t.total)}` };
  const [first, ...rest] = items;
  return { lead: { ...first, value: `${t.pct}%` }, others: rest, caption: guidesOf(t.total) };
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

// A few words for the tightest rows, split so the label can truncate and the number never does.
export function barShortParts(t: Tally, contest: Pick<Contest, "seats">): { label: string; value: string } {
  if (isEmpty(t)) return { label: "No picks", value: "" };
  if (t.kind === "measure") {
    if (t.verdict === "split") return { label: "Split", value: "" };
    return { label: t.verdict === "Y" ? "Yes" : "No", value: `${t.pct}%` };
  }
  if (contest.seats > 1) return { label: `Top ${contest.seats}`, value: "" };
  if (single(t, contest)) return { label: surname(t.counts[0].name), value: `· ${t.counts[0].count}` };
  return t.leader === null ? { label: "Split", value: "" } : { label: surname(t.leader), value: `${t.pct}%` };
}

export function barShort(t: Tally, contest: Pick<Contest, "seats">): string {
  const { label, value } = barShortParts(t, contest);
  return value ? `${label} ${value}` : label;
}


// The verdict a measure's text should wear: its winner (Yes always draws first, so never segment 0).
export function winnerTone(t: Tally): "yes" | "no" | "split" | null {
  if (t.kind !== "measure" || t.verdict === "none") return null;
  return t.verdict === "Y" ? "yes" : t.verdict === "N" ? "no" : "split";
}

