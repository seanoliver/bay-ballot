import { candidateSlots, slotTone, surname, type BarTone, type Slots } from "./bar";
import { displayName, groupByPick, reasons, sourceLink } from "./display";
import type { Row } from "./filters";
import type { Contest, GuideType } from "./schema";
import { tally } from "./score";

export type SideGuide = { id: string; name: string; short: string; type: GuideType; quoted: boolean };
export type SideQuote = { guideId: string; guideName: string; type: GuideType; text: string; href: string };
export type Side = { key: string; label: string; tone: BarTone; count: number; guides: SideGuide[]; quotes: SideQuote[] };
export type ResultHeadline = { lead: string; tone: "yes" | "no" | "split" | "candidate" | "none"; detail: string };

const guides = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

export function detailSides(contest: Contest, rows: Row[], slots?: Slots): { sides: Side[]; others: Side[] } {
  const colors = slots ?? candidateSlots(contest, rows.map((r) => r.entry));
  const all = groupByPick(contest, rows).map((g): Side => {
    const quoted = g.rows.filter((r) => reasons(r).length > 0);
    const rest = g.rows.filter((r) => !quoted.includes(r)).sort((a, b) => a.guide.name.localeCompare(b.guide.name, "en"));
    return {
      key: g.key,
      label: g.label,
      tone: g.tone === "candidate" ? slotTone(colors, g.key) : g.tone,
      count: g.rows.length,
      guides: [...quoted, ...rest].map((r) => ({
        id: r.guide.id,
        name: r.guide.name,
        short: displayName(r.guide, { short: true }),
        type: r.guide.type,
        quoted: quoted.includes(r),
      })),
      quotes: quoted.flatMap((r) =>
        reasons(r).map((q) => ({ guideId: r.guide.id, guideName: r.guide.name, type: r.guide.type, text: q.text, href: sourceLink(r.file, q.source) })),
      ),
    };
  });
  const top = contest.kind === "candidate" && contest.seats > 1 ? contest.seats : all.length;
  return { sides: all.slice(0, top), others: all.slice(top) };
}

const SHORT = 200;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, name: string) =>
  [name, surname(name)].some((n) => new RegExp(`\\b${escape(n)}\\b`, "i").test(text));

export function pickReasons(side: Side, rows: Row[], contest: Contest): { top: SideQuote[]; rest: SideQuote[] } {
  const rivals =
    contest.kind === "candidate"
      ? [...new Set([...contest.candidates, ...rows.flatMap((r) => (Array.isArray(r.entry.pick) ? r.entry.pick : []))])].filter((n) => n !== side.key)
      : [];
  const attack = (q: SideQuote) => !mentions(q.text, side.key) && rivals.some((n) => mentions(q.text, n));
  const score = (q: SideQuote) => [attack(q) ? 1 : 0, q.text.length > SHORT ? 1 : 0, q.text.length];
  const better = (a: SideQuote, b: SideQuote) => {
    const [x, y] = [score(a), score(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };

  const bestPerGuide = side.guides
    .map((g) => side.quotes.filter((q) => q.guideId === g.id))
    .filter((qs) => qs.length > 0)
    .map((qs) => [...qs].sort(better)[0]);
  const ranked = [...bestPerGuide].sort(better);

  const top: SideQuote[] = [];
  const types = new Set<GuideType>();
  for (const q of ranked) {
    if (top.length < 2 && !types.has(q.type)) {
      top.push(q);
      types.add(q.type);
    }
  }
  for (const q of ranked) if (top.length < 2 && !top.includes(q)) top.push(q);
  return { top, rest: side.quotes.filter((q) => !top.includes(q)) };
}

export function resultHeadline(contest: Contest, rows: Row[]): ResultHeadline {
  const t = tally(contest, rows.map((r) => r.entry));
  const none: ResultHeadline = { lead: "No picks yet", tone: "none", detail: "" };
  if (t.kind === "measure") {
    if (t.verdict === "none") return none;
    if (t.verdict === "split") return { lead: "Split", tone: "split", detail: guides(t.total) };
    const yes = t.verdict === "Y";
    return { lead: `${yes ? "Yes" : "No"} ${t.pct}%`, tone: yes ? "yes" : "no", detail: guides(t.total) };
  }
  if (t.counts.length === 0) return none;
  if (contest.seats > 1) return { lead: t.counts.slice(0, contest.seats).map((c) => c.name).join(", "), tone: "candidate", detail: guides(t.total) };
  if (t.counts.length === 1) return { lead: t.counts[0].name, tone: "candidate", detail: `${guides(t.counts[0].count)}, no other endorsements` };
  if (t.leader === null) return { lead: "Split", tone: "split", detail: guides(t.total) };
  return { lead: `${t.leader} ${t.pct}%`, tone: "candidate", detail: guides(t.total) };
}
