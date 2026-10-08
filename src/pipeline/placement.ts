import type { Contest } from "@/lib/schema";
import { normalizeWithMap, type KeptQuote, type Page } from "./quotes";

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
const asHeading = (body: string) => `${body}(?=[^\\S\\n]*(?:\\n|$|[:—–\\-,(|]))`;

const PROP_WORD = `(?:${ci("proposition")}|${ci("prop")}\\.?|${ci("measure")})`;
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

function namePatterns(candidate: string): Pattern[] {
  const nick = candidate.match(/\(([^)]*)\)|["“”]([^"“”]*)["“”]/);
  const bare = candidate.replace(/\s*(?:\([^)]*\)|["“”][^"“”]*["“”])\s*/, " ").replace(/,/g, " ");
  const tokens = bare.split(/\s+/).filter((t) => t && !SUFFIX.test(t));
  if (tokens.length < 2) return [];
  const last = escapeRegExp(tokens.at(-1)!);
  const firstForms = [tokens[0], ...(nick ? [nick[1] ?? nick[2]] : [])].map((f) =>
    escapeRegExp(f.replace(/\./g, "")).split("").join("\\.?"),
  );
  return firstForms.map((f) => ({ body: `${f}\\.?(?:\\s+\\S+){0,2}?\\s+${last}`, needle: needleOf(tokens.at(-1)!) }));
}

const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth"];
const MEASURE_TITLE = /^(?:(.+?)\s+)?(Proposition|Measure)\s+(\w+)$/;
const measureLetter = (c: Contest) => (c.kind === "measure" && c.id !== "rtm" ? (c.title.match(MEASURE_TITLE)?.[3] ?? null) : null);
const sameDistrict = (a: Contest, b: Contest) =>
  a.id !== b.id && a.jurisdiction.name === b.jurisdiction.name && a.jurisdiction.district === b.jurisdiction.district;
const placeWords = (place: string, city: boolean) => (city ? `${ciWords(place)}(?!\\s+${ci("county")})` : ciWords(place));
const nearPlace = (place: string, body: string, city: boolean) => [
  `${placeWords(place, city)}[^\\n]{0,40}?${body}`,
  `${body}[^\\n]{0,40}?${placeWords(place, city)}`,
];

function measurePatterns(c: Contest, siblings: Contest[], sharedBare: boolean): string[] {
  const m = c.title.match(MEASURE_TITLE);
  if (!m) return [];
  const [, place, word, id] = m;
  const letter = escapeRegExp(id);
  const yesNo = `(?:${ci("yes")}|${ci("no")})\\s+${ci("on")}`;
  if (!siblings.some((s) => s.id !== c.id && measureLetter(s) === id)) return [`(?:${PROP_WORD}|${yesNo})\\s*${letter}`];
  // Every contest sharing the letter keeps the bare marker, so an unqualified heading carries all their ids.
  const bare = `(?:${ci("measure")}|${yesNo})\\s*${letter}`;
  const shared = sharedBare ? [bare] : [];
  if (word === "Proposition" && !place) return [`(?:${ci("proposition")}|${ci("prop")}\\.?)\\s*${letter}`, ...shared];
  return place ? [...nearPlace(place, bare, c.jurisdiction.level === "city"), ...shared] : shared;
}

function districtPatterns(c: Contest): string[] {
  const n = c.jurisdiction.district;
  if (!n) return [];
  const d = `(?:${ci("district")}\\s*|D-?)${n}`;
  switch (c.jurisdiction.name) {
    case "Supervisor": {
      const sup = `${ci("supervisor")}s?`;
      const named = `(?:${ciWords("board of")}\\s+)?${sup},?\\s*${d}`;
      // A bare "District 8" / "D8" means a supervisor race only on SF guides; elsewhere it is usually a council seat.
      return c.jurisdiction.within?.[0]?.name === "San Francisco" ? [named, `${d}(?:,?\\s*${sup})?`] : [named, `${d},?\\s*${sup}`];
    }
    case "Assembly":
      return [`(?:${ci("state")}\\s+)?${ci("assembly")},?\\s*${d}`, `AD-?\\s*${n}`];
    case "Congress":
      return [`${ci("congress")}(?:${ci("ional")})?,?\\s*${d}`, `CA-${n}`, ciWords(c.title)];
    case "BART":
      return [`BART(?:\\s+${ci("board")})?(?:\\s+${ciWords("of directors")})?,?\\s*${d}`];
    case "Board of Equalization":
      return [`(?:${ciWords("board of equalization")}|BOE),?\\s*${d}`];
    case "Court of Appeal": {
      const nth = `(?:${n}(?:st|nd|rd|th)|${ci(ORDINALS[Number(n)] ?? n)})`;
      return [
        `${nth}\\s+(?:${ci("district")}\\s+)?${ciWords("court of appeal")}s?`,
        `${ciWords("court of appeal")}s?,?\\s*${nth}\\s+${ci("district")}`,
        `${nth}\\s+${ciWords("appellate district")}`,
      ];
    }
    case "City Council":
      return [`(?:${ci("city")}\\s+)?${ci("council")}(?:${ci("member")})?,?\\s*${d}`];
    case "State Senate":
      return [`(?:${ci("state")}\\s+)?${ci("senate")},?\\s*${d}`, `SD-?\\s*${n}`];
    default:
      return [];
  }
}

export type Matcher = { re: RegExp; needle?: string };
export const lowerWords = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
// Only for literal text the pattern matches verbatim (bar case) between word boundaries.
export const needleOf = (literal: string) => lowerWords(literal).reduce<string | undefined>((a, b) => (b.length > (a?.length ?? 0) ? b : a), undefined);
type Pattern = { body: string; needle?: string };

export function contestMarkers(c: Contest, siblings: Contest[] = [], opts: { sharedBare?: boolean } = {}): RegExp[] {
  return contestMarkerSet(c, siblings, opts).map((m) => m.re);
}

export function contestMarkerSet(c: Contest, siblings: Contest[] = [], { sharedBare = true }: { sharedBare?: boolean } = {}): Matcher[] {
  const out: (string | Pattern)[] = [];
  if (c.kind === "measure") {
    if (c.id === "rtm") out.push("RTM", `${ci("regional")}\\s+(?:${ci("transit")}\\s+)?${ci("measure")}`);
    else out.push(...measurePatterns(c, siblings, sharedBare));
  } else {
    const dp = c.jurisdiction.district ? districtPatterns(c) : [];
    const within = c.jurisdiction.within?.length === 1 ? c.jurisdiction.within[0] : null;
    const qualify = within !== null && siblings.some((s) => sameDistrict(s, c));
    if (dp.length) out.push(...(qualify ? dp.flatMap((p) => nearPlace(within.name, p, within.level === "city")) : dp));
    else out.push(asHeading(ciWords(c.title)));
    if (c.id === "lt-governor") out.push(asHeading(`${ci("lt")}\\.?\\s+${ci("gov")}(?:${ci("ernor")})?`));
    if (c.id === "assessor") out.push(asHeading(ci("assessor")));
    if (c.jurisdiction.name === "Court of Appeal" && !siblings.some((s) => s.id !== c.id && s.jurisdiction.name === "Court of Appeal")) {
      out.push(ciWords("court of appeal"));
    }
    if (c.kind === "retention" && /^Supreme Court/.test(c.title)) {
      out.push(ciWords("supreme court"), escapeRegExp(c.title.split(/\s+/).at(-1)!));
    }
    for (const name of c.candidates) out.push(...namePatterns(name));
  }
  // Whitespace inside a marker never crosses a line ("Measure\nA 14-year…" is not Prop A).
  return out.map((p) => (typeof p === "string" ? { body: p } : p)).map(({ body, needle }) => ({ re: bounded(body.replace(/\\s/g, "[^\\S\\n]")), needle }));
}

type Marker = { start: number; end: number; ids: string[] };

const markerCache = new WeakMap<Page, Marker[]>();

function pageMarkers(page: Page, contests: Contest[]): Marker[] {
  let m = markerCache.get(page);
  if (!m) {
    m = headingMarkers(page.text, contests);
    markerCache.set(page, m);
  }
  return m;
}

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
    for (const re of contestMarkers(c, contests)) {
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

export function misplacedUnder(quote: KeptQuote, contestId: string, pages: Page[], contests: Contest[]): string | null {
  const page = pages.find((p) => p.url === quote.source);
  if (!page) return null;
  const own = contests.find((c) => c.id === contestId);
  if (own && contestMarkers(own, contests, { sharedBare: false }).some((re) => re.test(quote.text))) return null;
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
