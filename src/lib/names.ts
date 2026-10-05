const INITIAL = /\b[a-z]\.\s*/g;

const letters = (s: string) =>
  s.replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

// Fold a name for fuzzy comparison: strip accents/case, and drop middle
// initials ("N.") only when at least two name tokens remain. Otherwise keep
// them so "A. Smith" and "B. Smith" don't collide.
const fold = (s: string) => {
  const base = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const stripped = letters(base.replace(INITIAL, ""));
  return stripped.split(" ").length >= 2 ? stripped : letters(base);
};

export function matchName(
  input: string,
  candidates: string[],
): { name: string; fuzzy: boolean } | null {
  if (candidates.includes(input)) return { name: input, fuzzy: false };
  const hits = candidates.filter((c) => fold(c) === fold(input));
  return hits.length === 1 ? { name: hits[0], fuzzy: true } : null;
}
