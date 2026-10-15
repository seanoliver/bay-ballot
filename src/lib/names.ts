const LETTER_MAP: Record<string, string> = { ł: "l", ø: "o", ß: "ss", đ: "d", æ: "ae" };

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);
const TITLES = new Set([
  "dr", "mr", "mrs", "ms", "mx", "rev", "hon", "judge", "justice", "supervisor", "assemblymember",
  "senator", "rep", "mayor", "councilmember", "commissioner", "director",
]);
const isInitial = (t: string) => [...t].length === 1;

function tokenize(s: string): { names: string[]; initials: string[] } {
  const tokens = s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[łøßđæ]/g, (c) => LETTER_MAP[c])
    .replace(/[.'‘’"“”`]/g, "")
    // A hyphen inside a word joins it: "Dion-Jay" = "Dionjay".
    .replace(/(?<=[\p{L}\p{N}])[-‐‑‒–—](?=[\p{L}\p{N}])/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t));
  while (tokens.length > 0 && TITLES.has(tokens[0]) && tokens.slice(1).filter((t) => !isInitial(t)).length >= 2) {
    tokens.shift();
  }
  return {
    names: tokens.filter((t) => !isInitial(t)),
    initials: tokens.filter(isInitial),
  };
}

function isSubsequence(sub: string[], full: string[]): boolean {
  let i = 0;
  for (const x of full) if (i < sub.length && sub[i] === x) i++;
  return i === sub.length;
}

type Tokens = ReturnType<typeof tokenize>;

const NICKNAME = /\s*(?:\(([^)]*)\)|["“”]([^"“”]*)["“”])\s*/;

function variants(candidate: string): Tokens[] {
  const m = candidate.match(NICKNAME);
  if (!m) return [tokenize(candidate)];
  const bare = tokenize(candidate.replace(NICKNAME, " "));
  const nick = tokenize(m[1] ?? m[2]);
  const out = [tokenize(candidate), bare];
  if (nick.names.length > 0 && bare.names.length > 0) {
    out.push({ names: [...nick.names, ...bare.names.slice(1)], initials: bare.initials });
  }
  return out;
}

function namesFit(a: string[], b: string[]): boolean {
  if (a.length === b.length) return a.every((t, i) => t === b[i]);
  return a.length >= 2 && a.length < b.length && a[0] === b[0] && a.at(-1) === b.at(-1) && isSubsequence(a, b);
}

function compatible(input: string, candidate: string): boolean {
  const a = tokenize(input);
  return (
    a.names.length > 0 &&
    variants(candidate).some((b) => namesFit(a.names, b.names) && isSubsequence(a.initials, b.initials))
  );
}

export type Aliases = Record<string, string[]>;

export function matchName(
  input: string,
  candidates: string[],
  aliases: Aliases = {},
): { name: string; fuzzy: boolean } | null {
  if (candidates.includes(input)) return { name: input, fuzzy: false };
  const hits = candidates.filter(
    (c) => compatible(input, c) || (aliases[c] ?? []).some((alt) => compatible(input, alt)),
  );
  // Alias hits are fuzzy too, so the caller flags them for review.
  return hits.length === 1 ? { name: hits[0], fuzzy: true } : null;
}

// Edits, counting two swapped adjacent letters as one ("Weiner" for "Wiener").
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// First names may differ by one letter or share a 3-letter start ("Debbie" for "Deborah"); last names by one letter, and only in names of 5+ letters.
function nearNames(a: string[], b: string[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const [af, bf, al, bl] = [a[0], b[0], a.at(-1)!, b.at(-1)!];
  const firstNear = af === bf || editDistance(af, bf) <= 1 || (af.length >= 3 && bf.length >= 3 && af.slice(0, 3) === bf.slice(0, 3));
  const lastNear = al === bl || (Math.min(al.length, bl.length) >= 5 && editDistance(al, bl) <= 1);
  return firstNear && lastNear;
}

/** The one candidate a name that `matchName` rejected probably means, for a person to confirm. Never use it to publish a pick. */
export function suggestName(input: string, candidates: string[], aliases: Aliases = {}): string | null {
  const a = tokenize(input).names;
  const hits = candidates.filter((c) =>
    [c, ...(aliases[c] ?? [])].some((name) => variants(name).some((b) => nearNames(a, b.names))),
  );
  return hits.length === 1 ? hits[0] : null;
}
