import type { Entry } from "@/lib/schema";

const rankNote = (e: Entry) => (e.ranked ? ` (ranked${e.rankedCount ? ` ${e.rankedCount}` : ""})` : "");
const show = (e: Entry) => (Array.isArray(e.pick) ? e.pick.join(" / ") + rankNote(e) : e.pick);
const clip = (t: string) => (t.length > 60 ? `${t.slice(0, 60)}…` : t);

export function diffPicks(before: Record<string, Entry>, after: Record<string, Entry>): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(after)) {
    const b = before[id];
    if (!b) {
      out.push(`+ ${id}: ${show(e)}`);
      continue;
    }
    const samePick = show(b) === show(e);
    if (!samePick) out.push(`~ ${id}: ${show(b)} -> ${show(e)}`);
    if (b.quotes.length !== e.quotes.length) out.push(`q ${id}: ${b.quotes.length} -> ${e.quotes.length}`);
    // A shortened quote keeps the count, so name each published quote that is gone or rewritten.
    if (samePick) for (const q of b.quotes) if (!e.quotes.some((x) => x.text === q.text)) out.push(`q ${id}: removed "${clip(q.text)}"`);
  }
  for (const [id, e] of Object.entries(before)) if (!after[id]) out.push(`- ${id}: ${show(e)}`);
  return out;
}

export function summaryLine(
  id: string,
  before: Record<string, Entry>,
  after: Record<string, Entry>,
  notes: string[],
): string {
  const lines = diffPicks(before, after);
  const count = (prefix: string) => lines.filter((l) => l.startsWith(prefix)).length;
  const quotes = Object.values(after).reduce((n, e) => n + e.quotes.length, 0);
  const picks = Object.keys(after).length;
  return `${id}: ${picks} picks (+${count("+ ")} ~${count("~ ")} -${count("- ")}), ${quotes} quotes, ${notes.length} notes`;
}
