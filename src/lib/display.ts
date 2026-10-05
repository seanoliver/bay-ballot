import type { Contest, Guide } from "./schema";
import type { Row } from "./filters";
import { tally } from "./score";
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
  if (t.total === 0) return { tone: "none", label: "No picks yet", detail: "", ranked: false };
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
    rows: rows.filter((r) => {
      const pick = r.entry.pick;
      if (!Array.isArray(pick)) return false;
      const names = r.entry.ranked && contest.seats === 1 ? pick.slice(0, 1) : pick;
      return names.includes(c.name);
    }),
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
