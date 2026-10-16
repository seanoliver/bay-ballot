import type { Entry } from "@/lib/schema";
import { samePick } from "./extract";
import { normalizeWithMap } from "./quotes";

const rankNote = (e: Entry) => (e.ranked ? ` (ranked${e.rankedCount ? ` ${e.rankedCount}` : ""})` : "");
const show = (e: Entry) => (Array.isArray(e.pick) ? e.pick.join(" / ") + rankNote(e) : e.pick);
// Counts code points, so the cut never splits an emoji.
const clip = (t: string) => {
  const chars = [...t];
  return chars.length > 60 ? `${chars.slice(0, 60).join("")}…` : t;
};
// Quote text is scraped; as inline code on one line it can't add mentions, links or images to the PR body.
const asCode = (t: string) => `\`${clip(t.replace(/[\s`]+/g, " ").trim())}\``;
const norm = (t: string) => normalizeWithMap(t).norm;

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
    // Same rule as keepPrevQuotes: an unranked pick in a new name order is the same pick.
    if (!samePick(b, e)) continue;
    for (const q of b.quotes) {
      if (e.quotes.some((x) => x.text === q.text)) continue;
      const reworded = e.quotes.some((x) => norm(x.text) === norm(q.text));
      out.push(`q ${id}: ${reworded ? "reworded" : "removed"} ${asCode(q.text)}`);
    }
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
