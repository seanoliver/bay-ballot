import type { Contest, Entry } from "./schema";

export type MeasureTally = {
  kind: "measure";
  yes: number;
  no: number;
  total: number;
  verdict: "Y" | "N" | "split" | "none";
  pct: number;
};

export type CandidateCount = {
  name: string;
  count: number;
  // set for any name from a ranked entry; SF multi-seat races aren't ranked, so in practice this means a ranked #1
  fromRanked: boolean;
};

export type CandidateTally = {
  kind: "candidate";
  total: number;
  counts: CandidateCount[];
  leader: string | null;
  count: number;
  pct: number;
  split: boolean;
  tied: string[];
  leaderRanked: boolean;
};

export type Tally = MeasureTally | CandidateTally;

export function countedNames(contest: Contest, entry: Entry): string[] {
  if (!Array.isArray(entry.pick)) return [];
  return entry.ranked && contest.seats === 1 ? entry.pick.slice(0, 1) : entry.pick;
}

export function tally(contest: Contest, entries: Entry[]): Tally {
  if (contest.kind !== "candidate") {
    const yes = entries.filter((e) => e.pick === "Y").length;
    const no = entries.filter((e) => e.pick === "N").length;
    const total = yes + no;
    let verdict: MeasureTally["verdict"];
    if (total === 0) verdict = "none";
    else if (yes === no) verdict = "split";
    else verdict = yes > no ? "Y" : "N";
    return {
      kind: "measure",
      yes,
      no,
      total,
      verdict,
      pct: total ? Math.round((100 * Math.max(yes, no)) / total) : 0,
    };
  }

  const map = new Map<string, CandidateCount>();
  let total = 0;
  for (const e of entries) {
    if (!Array.isArray(e.pick)) continue;
    total += 1;
    const names = new Set(countedNames(contest, e));
    for (const name of names) {
      const c = map.get(name) ?? { name, count: 0, fromRanked: false };
      c.count += 1;
      if (e.ranked) c.fromRanked = true;
      map.set(name, c);
    }
  }
  const counts = [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"),
  );
  const top = counts[0];
  const split = counts.length > 1 && counts[1].count === top.count;
  if (!top || split) {
    return {
      kind: "candidate",
      total,
      counts,
      leader: null,
      count: 0,
      pct: 0,
      split,
      tied: split ? counts.filter((c) => c.count === top.count).map((c) => c.name) : [],
      leaderRanked: false,
    };
  }
  return {
    kind: "candidate",
    total,
    counts,
    leader: top.name,
    count: top.count,
    pct: Math.round((100 * top.count) / total),
    split: false,
    tied: [],
    leaderRanked: top.fromRanked,
  };
}
