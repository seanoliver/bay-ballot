import type { Contest } from "./schema";
import type { Tally } from "./score";

// Candidate tones run neutral to accent so they never read as Yes/No.
export type BarTone = "yes" | "no" | "c1" | "c2" | "c3" | "c4" | "empty";
export type BarSegment = { key: string; label: string; count: number; pct: number; tone: BarTone };
export type BarSummary = { aria: string; caption: string };

const CANDIDATE_TONES = ["c1", "c2", "c3", "c4"] as const;
const MAX_SEGMENTS = CANDIDATE_TONES.length;
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

// What a collapsed contest's bar draws. Measures and single-seat races are one stacked bar whose
// segments sum to 100. Multi-seat races are up to `seats` independent bars, each `count` of `total` guides.
export function barSegments(t: Tally, contest: Pick<Contest, "seats">): BarSegment[] {
  if (isEmpty(t)) return [EMPTY];
  if (t.kind === "measure") {
    const sides = [
      { key: "Y", name: "Yes", count: t.yes, tone: "yes" as const },
      { key: "N", name: "No", count: t.no, tone: "no" as const },
    ].filter((s) => s.count > 0);
    const pct = percents(sides.map((s) => s.count));
    return sides.map((s, i) => ({ key: s.key, label: `${s.name} ${pct[i]}%`, count: s.count, pct: pct[i], tone: s.tone }));
  }
  if (contest.seats > 1) {
    return t.counts.slice(0, contest.seats).map((c) => ({
      key: c.name,
      label: c.name,
      count: c.count,
      pct: Math.round((100 * c.count) / t.total),
      tone: "c1",
    }));
  }
  const named = t.counts.length > MAX_SEGMENTS ? t.counts.slice(0, MAX_SEGMENTS - 1) : t.counts;
  const rest = t.counts.slice(named.length);
  const parts = named.map((c) => ({ key: c.name, label: c.name, count: c.count }));
  if (rest.length) parts.push({ key: "others", label: `${rest.length} others`, count: rest.reduce((n, c) => n + c.count, 0) });
  const pct = percents(parts.map((p) => p.count));
  return parts.map((p, i) => ({ ...p, pct: pct[i], tone: CANDIDATE_TONES[i] }));
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
  const named = t.counts.slice(0, MAX_SEGMENTS);
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
