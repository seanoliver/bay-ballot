export function quoteKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const MIN_CONTAINED = 40;

/** Equal up to quotes, spacing and case, or one holds the other once both are long enough. */
export function sameQuoteText(a: string, b: string): boolean {
  const x = quoteKey(a);
  const y = quoteKey(b);
  return x === y || (Math.min(x.length, y.length) >= MIN_CONTAINED && (x.includes(y) || y.includes(x)));
}

export function isRejected(text: string, contestId: string, rejected: { text: string; contestId?: string }[]): boolean {
  return rejected.some((r) => (!r.contestId || r.contestId === contestId) && sameQuoteText(r.text, text));
}
