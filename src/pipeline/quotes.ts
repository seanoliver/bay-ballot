export type Page = { url: string; text: string };
export type KeptQuote = { text: string; source: string };

const MIN_LENGTH = 20;
const EDGE_QUOTES = /^["'“”‘’‛‟]+|["'“”‘’‛‟]+$/g;

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[\s ]+/g, "")
    .toLowerCase();
}

/** Keep only quotes that appear word-for-word (modulo punctuation style and whitespace) in a page. */
export function verifyQuotes(
  quotes: string[],
  pages: Page[],
): { kept: KeptQuote[]; dropped: string[] } {
  const normalizedPages = pages.map((p) => ({ url: p.url, text: normalize(p.text) }));
  const kept: KeptQuote[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const raw of quotes) {
    const text = raw.trim().replace(EDGE_QUOTES, "").trim();
    const norm = normalize(text);
    const page = text.length >= MIN_LENGTH ? normalizedPages.find((p) => p.text.includes(norm)) : undefined;
    if (!page) {
      dropped.push(raw);
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    kept.push({ text, source: page.url });
  }
  return { kept, dropped };
}
