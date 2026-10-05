import type { Entry } from "@/lib/schema";

const show = (e: Entry) => (Array.isArray(e.pick) ? e.pick.join(" / ") + (e.ranked ? " (ranked)" : "") : e.pick);

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
