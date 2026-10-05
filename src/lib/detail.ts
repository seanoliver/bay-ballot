import { candidateSlots, slotTone, type BarTone, type Slots } from "./bar";
import { groupByPick, reasons, sourceLink, type PickGroup } from "./display";
import type { Row } from "./filters";
import type { Contest } from "./schema";
import { tally } from "./score";

// The contest detail reads WHO (every guide, by pick) then WHY (only the quotes there are).

// `rank` is set only in ranked-choice contests, where a guide's order matters.
export type WhoGuide = { id: string; name: string; rank: number | null };
// `shown` first, `hidden` behind a "+N more" disclosure.
export type WhoRow = { key: string; label: string; count: number; tone: BarTone; shown: WhoGuide[]; hidden: WhoGuide[] };
export type ReasonQuote = { text: string; href: string };
export type ReasonItem = { guideId: string; guideName: string; quotes: ReasonQuote[] };
// `hidden`: quotes beyond each guide's first, revealed by a "+N more" disclosure.
export type ReasonSection = { key: string; title: string; tone: BarTone; items: ReasonItem[]; hidden: number };
export type ResultHeadline = { lead: string; tone: "yes" | "no" | "split" | "candidate" | "none"; detail: string };

const WHO_SHOWN = 4;
const guides = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

// Pick groups in bar order (Yes then No; candidates leader first) with their tone. `slots` should come
// from unfiltered data (candidateSlots) so colors match the bar; without it, from these rows.
function toned(contest: Contest, rows: Row[], slots?: Slots): { group: PickGroup; tone: BarTone }[] {
  const colors = slots ?? candidateSlots(contest, rows.map((r) => r.entry));
  return groupByPick(contest, rows).map((group) => ({
    group,
    tone: group.tone === "candidate" ? slotTone(colors, group.key) : group.tone,
  }));
}

// Guides quoted under Reasons lead (same order as there), then the rest alphabetically.
export function whoRows(contest: Contest, rows: Row[], slots?: Slots): WhoRow[] {
  return toned(contest, rows, slots).map(({ group, tone }) => {
    const quoted = group.rows.filter((r) => reasons(r).length > 0);
    const rest = group.rows.filter((r) => !quoted.includes(r)).sort((a, b) => a.guide.name.localeCompare(b.guide.name, "en"));
    const all = [...quoted, ...rest].map((r): WhoGuide => {
      const at = contest.rankedChoice && r.entry.ranked && Array.isArray(r.entry.pick) ? r.entry.pick.indexOf(group.key) : -1;
      return { id: r.guide.id, name: r.guide.name, rank: at >= 0 ? at + 1 : null };
    });
    return { key: group.key, label: group.label, count: group.rows.length, tone, shown: all.slice(0, WHO_SHOWN), hidden: all.slice(WHO_SHOWN) };
  });
}

export function reasonSections(contest: Contest, rows: Row[], slots?: Slots): ReasonSection[] {
  const out: ReasonSection[] = [];
  for (const { group, tone } of toned(contest, rows, slots)) {
    const items: ReasonItem[] = [];
    for (const r of group.rows) {
      const qs = reasons(r);
      if (qs.length) {
        items.push({ guideId: r.guide.id, guideName: r.guide.name, quotes: qs.map((q) => ({ text: q.text, href: sourceLink(r.file, q.source) })) });
      }
    }
    if (!items.length) continue;
    const title =
      group.tone === "candidate" ? `Why guides back ${group.label}` : group.key === "Y" ? "Reasons for" : "Reasons against";
    out.push({ key: group.key, title, tone, items, hidden: items.reduce((n, i) => n + i.quotes.length - 1, 0) });
  }
  return out;
}

export function resultHeadline(contest: Contest, rows: Row[]): ResultHeadline {
  const t = tally(contest, rows.map((r) => r.entry));
  const none: ResultHeadline = { lead: "No picks yet", tone: "none", detail: "" };
  if (t.kind === "measure") {
    if (t.verdict === "none") return none;
    if (t.verdict === "split") return { lead: "Split", tone: "split", detail: `${t.yes} Yes · ${t.no} No` };
    const yes = t.verdict === "Y";
    return { lead: yes ? "Yes" : "No", tone: yes ? "yes" : "no", detail: `${Math.max(t.yes, t.no)} of ${guides(t.total)} · ${t.pct}%` };
  }
  if (t.counts.length === 0) return none;
  if (contest.seats > 1) return { lead: "Most endorsed", tone: "candidate", detail: guides(t.total) };
  if (t.leader === null) return { lead: "Split", tone: "split", detail: `${t.tied.join(", ")} · ${t.counts[0].count} each` };
  return { lead: t.leader, tone: "candidate", detail: `${t.count} of ${guides(t.total)} · ${t.pct}%` };
}
