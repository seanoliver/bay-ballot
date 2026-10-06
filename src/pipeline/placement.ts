import type { Contest } from "@/lib/schema";
import { normalizeWithMap, type KeptQuote, type Page } from "./quotes";

// Only headings count as markers: a short line (not a sentence ending in ".") with the marker
// near its start, such as "No on Prop G: …" or "Supervisor, District 10: …". Prose mentions
// ("The Controller cautions…", "…vote yes on BOTH RTM and Prop H") are cross-references, and a
// line that is only an image caption ("[Prop G: Closing Sunset Dunes Park]") trails its section.
const HEADING_CHARS = 40;
const HEADING_LINE_MAX = 120;
const isHeadingLine = (line: string) =>
  line.trim().length <= HEADING_LINE_MAX && !/\.\s*$/.test(line) && !/^\s*\[[^\]]*\]\s*$/.test(line);

const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Case-insensitive for one word only, so the letter in "Prop G" stays case-sensitive.
const ci = (word: string) =>
  [...word].map((ch) => (/[a-z]/i.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : escapeRegExp(ch))).join("");
const ciWords = (phrase: string) => phrase.trim().split(/\s+/).map(ci).join("\\s+");
const bounded = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "u");
// An office title as a heading: followed by the end of the line or ":", "—", "-", ",", "(", "|".
const asHeading = (body: string) => `${body}(?=[^\\S\\n]*(?:\\n|$|[:—–\\-,(|]))`;

const PROP_WORD = `(?:${ci("proposition")}|${ci("prop")}\\.?|${ci("measure")})`;
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/** "First Last" patterns for a candidate: first name or nickname (initials' dots optional), then last name. */
function namePatterns(candidate: string): string[] {
  const nick = candidate.match(/\(([^)]*)\)|["“”]([^"“”]*)["“”]/);
  const bare = candidate.replace(/\s*(?:\([^)]*\)|["“”][^"“”]*["“”])\s*/, " ").replace(/,/g, " ");
  const tokens = bare.split(/\s+/).filter((t) => t && !SUFFIX.test(t));
  if (tokens.length < 2) return [];
  const last = escapeRegExp(tokens.at(-1)!);
  const firstForms = [tokens[0], ...(nick ? [nick[1] ?? nick[2]] : [])].map((f) =>
    escapeRegExp(f.replace(/\./g, "")).split("").join("\\.?"),
  );
  // Up to two middle tokens between first and last ("Michael T. Nguyen", "Lisa Palagi Wynn").
  return firstForms.map((f) => `${f}\\.?(?:\\s+\\S+){0,2}?\\s+${last}`);
}

function districtPatterns(c: Contest): string[] {
  const n = c.jurisdiction.district;
  if (!n) return [];
  const d = `(?:${ci("district")}\\s*|D-?)${n}`;
  switch (c.jurisdiction.name) {
    case "Supervisor": {
      const sup = `${ci("supervisor")}s?`;
      // A bare "District 8" / "D8" means a supervisor race on SF guides; longer BART and BOE
      // headings ("BART D8") win where they overlap.
      return [`(?:${ciWords("board of")}\\s+)?${sup},?\\s*${d}`, `${d}(?:,?\\s*${sup})?`];
    }
    case "Assembly":
      return [`(?:${ci("state")}\\s+)?${ci("assembly")},?\\s*${d}`, `AD-?\\s*${n}`];
    case "Congress":
      return [`${ci("congress")}(?:${ci("ional")})?,?\\s*${d}`, `CA-${n}`, ciWords(c.title)];
    case "BART":
      return [`BART(?:\\s+${ci("board")})?(?:\\s+${ciWords("of directors")})?,?\\s*${d}`];
    case "Board of Equalization":
      return [`(?:${ciWords("board of equalization")}|BOE),?\\s*${d}`];
    default:
      return [];
  }
}

/** Patterns that mark where a contest's section starts on a guide's page. */
export function contestMarkers(c: Contest): RegExp[] {
  const out: string[] = [];
  if (c.kind === "measure") {
    const id = c.title.match(/^Proposition\s+(\w+)$/)?.[1];
    if (id) out.push(`(?:${PROP_WORD}|(?:${ci("yes")}|${ci("no")})\\s+${ci("on")})\\s*${escapeRegExp(id)}`);
    if (c.id === "rtm") out.push("RTM", `${ci("regional")}\\s+(?:${ci("transit")}\\s+)?${ci("measure")}`);
  } else {
    if (c.jurisdiction.district) out.push(...districtPatterns(c));
    else out.push(asHeading(ciWords(c.title)));
    if (c.id === "lt-governor") out.push(asHeading(`${ci("lt")}\\.?\\s+${ci("gov")}(?:${ci("ernor")})?`));
    if (c.id === "assessor") out.push(asHeading(ci("assessor")));
    if (c.id === "court-of-appeal-1") out.push(ciWords("court of appeal"));
    if (c.kind === "retention" && /^Supreme Court/.test(c.title)) {
      out.push(ciWords("supreme court"), escapeRegExp(c.title.split(/\s+/).at(-1)!));
    }
    for (const name of c.candidates) out.push(...namePatterns(name));
  }
  // Whitespace inside a marker never crosses a line ("Measure\nA 14-year…" is not Prop A).
  return out.map((p) => bounded(p.replace(/\\s/g, "[^\\S\\n]")));
}

type Marker = { start: number; end: number; ids: string[] };

const markerCache = new WeakMap<Page, Marker[]>();

/** Section headings on a page, cached per page object. */
function pageMarkers(page: Page, contests: Contest[]): Marker[] {
  let m = markerCache.get(page);
  if (!m) {
    m = headingMarkers(page.text, contests);
    markerCache.set(page, m);
  }
  return m;
}

/**
 * One marker per heading section. Overlapping matches go to the longest ("Lieutenant Governor"
 * over "Governor", "BART D8" over "D8"); a heading naming several contests covers all of them,
 * as does a run of consecutive heading lines ("Prop 41: …" / "Prop 42: …" / "Prop 43: …"
 * followed by one shared write-up). The last line's contests come first in `ids`.
 */
function headingMarkers(text: string, contests: Contest[]): Marker[] {
  const lines: { start: number; text: string }[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    lines.push({ start: at, text: line });
    at += line.length + 1;
  }
  const lineIndex = (pos: number) => lines.findLastIndex((l) => l.start <= pos);

  const found: { start: number; end: number; id: string; line: number }[] = [];
  for (const c of contests) {
    for (const re of contestMarkers(c)) {
      for (const m of text.matchAll(new RegExp(re.source, `${re.flags}g`))) {
        const li = lineIndex(m.index);
        const line = lines[li];
        if (m.index - line.start > HEADING_CHARS || !isHeadingLine(line.text)) continue;
        found.push({ start: m.index, end: m.index + m[0].length, id: c.id, line: li });
      }
    }
  }
  const kept = found.filter(
    (a) => !found.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start),
  );

  const byLine = new Map<number, { end: number; ids: string[] }>();
  for (const m of kept) {
    const prev = byLine.get(m.line);
    if (prev) {
      if (!prev.ids.includes(m.id)) prev.ids.push(m.id);
      prev.end = Math.max(prev.end, m.end);
    } else byLine.set(m.line, { end: m.end, ids: [m.id] });
  }

  const out: Marker[] = [];
  let prevLine = -2;
  for (const li of [...byLine.keys()].sort((a, b) => a - b)) {
    const cur = byLine.get(li)!;
    const last = out.at(-1);
    if (last && li === prevLine + 1) {
      last.ids = [...cur.ids, ...last.ids.filter((id) => !cur.ids.includes(id))];
      last.end = Math.max(last.end, cur.end);
    } else out.push({ start: lines[li].start, end: cur.end, ids: [...cur.ids] });
    prevLine = li;
  }
  return out;
}

/**
 * The contest a quote actually sits under, when that is not `contestId`; else null. A quote
 * counts as placed if it names its own contest, or if any occurrence on its page has no heading
 * before it (a single-contest page) or has this contest among the nearest heading's contests.
 */
export function misplacedUnder(quote: KeptQuote, contestId: string, pages: Page[], contests: Contest[]): string | null {
  const page = pages.find((p) => p.url === quote.source);
  if (!page) return null;
  const own = contests.find((c) => c.id === contestId);
  if (own && contestMarkers(own).some((re) => re.test(quote.text))) return null;
  const { norm, map } = normalizeWithMap(page.text);
  const q = normalizeWithMap(quote.text).norm;
  if (!q) return null;
  const markers = pageMarkers(page, contests);
  let other: string | null = null;
  for (let i = norm.indexOf(q); i !== -1; i = norm.indexOf(q, i + 1)) {
    const pos = map[i];
    const before = markers.filter((m) => m.end <= pos).at(-1);
    if (!before || before.ids.includes(contestId)) return null;
    other ??= before.ids[0];
  }
  return other;
}
