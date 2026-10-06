import type { Entry } from "@/lib/schema";

const rankNote = (e: Entry) => (e.ranked ? ` (ranked${e.rankedCount ? ` ${e.rankedCount}` : ""})` : "");
const show = (e: Entry) => (Array.isArray(e.pick) ? e.pick.join(" / ") + rankNote(e) : e.pick);

/** Human-readable changes between two pick sets: "+" added, "~" changed, "q" quote count, "-" removed. */
export function diffPicks(before: Record<string, Entry>, after: Record<string, Entry>): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(after)) {
    const b = before[id];
    if (!b) {
      out.push(`+ ${id}: ${show(e)}`);
      continue;
    }
    if (show(b) !== show(e)) out.push(`~ ${id}: ${show(b)} -> ${show(e)}`);
    if (b.quotes.length !== e.quotes.length) out.push(`q ${id}: ${b.quotes.length} -> ${e.quotes.length}`);
  }
  for (const [id, e] of Object.entries(before)) if (!after[id]) out.push(`- ${id}: ${show(e)}`);
  return out;
}

/** One line per guide before the details: "<id>: <n> picks (+a ~c -r), <k> quotes, <x> notes". */
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
