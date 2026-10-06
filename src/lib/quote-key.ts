export function quoteKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MIN_CONTAINED = 40;

export function isRejected(text: string, contestId: string, rejected: { text: string; contestId?: string }[]): boolean {
  const q = quoteKey(text);
  return rejected.some((r) => {
    if (r.contestId && r.contestId !== contestId) return false;
    const k = quoteKey(r.text);
    return k === q || (Math.min(k.length, q.length) >= MIN_CONTAINED && (k.includes(q) || q.includes(k)));
  });
}
