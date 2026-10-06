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

// A nickname in parentheses or double quotes: Dionjay (DJ) Brookter, Emanuel "Manny" Yekutiel.
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
