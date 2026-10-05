const LETTER_MAP: Record<string, string> = { ł: "l", ø: "o", ß: "ss", đ: "d", æ: "ae" };

// Single-character tokens are initials, which the input may omit but never contradict or add.
function tokenize(s: string): { names: string[]; initials: string[] } {
  const tokens = s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[łøßđæ]/g, (c) => LETTER_MAP[c])
    .replace(/[.'‘’"“”`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  const isInitial = (t: string) => [...t].length === 1;
  return {
    names: tokens.filter((t) => !isInitial(t)),
    initials: tokens.filter(isInitial),
  };
}

// True if every element of `sub` appears in `full` in the same order.
function isSubsequence(sub: string[], full: string[]): boolean {
  let i = 0;
  for (const x of full) if (i < sub.length && sub[i] === x) i++;
  return i === sub.length;
}

function compatible(input: string, candidate: string): boolean {
  const a = tokenize(input);
  const b = tokenize(candidate);
  return (
    a.names.length > 0 &&
    a.names.length === b.names.length &&
    a.names.every((t, i) => t === b.names[i]) &&
    isSubsequence(a.initials, b.initials)
  );
}

export function matchName(
  input: string,
  candidates: string[],
): { name: string; fuzzy: boolean } | null {
  if (candidates.includes(input)) return { name: input, fuzzy: false };
  const hits = candidates.filter((c) => compatible(input, c));
  return hits.length === 1 ? { name: hits[0], fuzzy: true } : null;
}
