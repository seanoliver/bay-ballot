import { surname } from "./bar";
import type { Entry, Quote } from "./schema";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
const word = (n: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, flags);

/** A full name matches in any case; a surname alone only as written or in capitals, so "Park" or "PARK" counts but "the park" doesn't. */
export function names(text: string, name: string, aliases: string[] = []): boolean {
  return [name, ...aliases].some((n) => {
    const last = surname(n);
    return word(n, "iu").test(text) || (last !== n && (word(last, "u").test(text) || word(last.toUpperCase(), "u").test(text)));
  });
}

/**
 * The picked candidates a quote names, when it names some but not all of them.
 * Undefined means the quote is about the whole pick: a measure, a single name, or a quote naming none or all of them.
 */
export function quoteAbout(text: string, pick: Entry["pick"], aliases: Record<string, string[]> = {}): string[] | undefined {
  if (!Array.isArray(pick) || pick.length < 2) return undefined;
  // A quote may use a first name alone ("Leah has the policy chops"), matched as written.
  const first = (n: string) => n.split(/\s+/)[0].replace(/[.,]/g, "");
  const byFirst = (n: string) => first(n).length >= 2 && n.includes(" ") && pick.filter((m) => first(m) === first(n)).length === 1 && word(first(n), "u").test(text);
  const named = pick.filter((n) => names(text, n, aliases[n]) || byFirst(n));
  return named.length && named.length < pick.length ? named : undefined;
}

/** Whether a guide's quote belongs under one of its picked candidates. */
export const quoteIsFor = (q: Pick<Quote, "about">, name: string) => !q.about || q.about.includes(name);

/**
 * Sets `about` on each quote that lacks it. A quote already published with `about` keeps it while those names are still picked,
 * so a hand-made correction survives the next extract.
 */
export function tagQuotes(
  picks: Record<string, Entry>,
  { prev = {}, aliases = {} }: { prev?: Record<string, Entry>; aliases?: Record<string, Record<string, string[]>> } = {},
): Record<string, Entry> {
  return Object.fromEntries(
    Object.entries(picks).map(([id, e]) => {
      const pick = e.pick;
      if (!Array.isArray(pick) || pick.length < 2) return [id, e];
      const quotes = e.quotes.map((q) => {
        if (q.about) return q;
        const was = prev[id]?.quotes.find((p) => p.text === q.text)?.about;
        const about = was?.every((n) => pick.includes(n)) ? was : quoteAbout(q.text, pick, aliases[id]);
        return about ? { ...q, about } : q;
      });
      return [id, quotes.some((q, i) => q !== e.quotes[i]) ? { ...e, quotes } : e];
    }),
  );
}
