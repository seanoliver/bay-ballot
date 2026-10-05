import type { Contest, Entry } from "./schema";

export type MeasureTally = { kind: "measure"; yes: number; no: number; total: number; verdict: "Y" | "N" | "split" | "none"; pct: number };
export type CandidateCount = { name: string; count: number; fromRanked: boolean };
export type CandidateTally = { kind: "candidate"; total: number; counts: CandidateCount[]; leader: string | null; count: number; pct: number; split: boolean; leaderRanked: boolean };
export type Tally = MeasureTally | CandidateTally;

export function tally(contest: Contest, entries: Entry[]): Tally {
  const total = entries.length;
  if (contest.kind !== "candidate") {
    const yes = entries.filter((e) => e.pick === "Y").length;
    const no = entries.filter((e) => e.pick === "N").length;
    const verdict = total === 0 ? "none" : yes === no ? "split" : yes > no ? "Y" : "N";
    return { kind: "measure", yes, no, total, verdict, pct: total ? Math.round((100 * Math.max(yes, no)) / total) : 0 };
  }
  const map = new Map<string, CandidateCount>();
  for (const e of entries) {
    if (!Array.isArray(e.pick)) continue;
    const names = new Set(e.ranked && contest.seats === 1 ? e.pick.slice(0, 1) : e.pick);
    for (const name of names) {
      const c = map.get(name) ?? { name, count: 0, fromRanked: false };
      c.count += 1;
      if (e.ranked) c.fromRanked = true;
      map.set(name, c);
    }
  }
  const counts = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const top = counts[0];
  const split = counts.length > 1 && counts[1].count === top.count;
  return {
    kind: "candidate", total, counts,
    leader: top ? top.name : null,
    count: top?.count ?? 0,
    pct: total && top ? Math.round((100 * top.count) / total) : 0,
    split,
    leaderRanked: !!top?.fromRanked,
  };
}
