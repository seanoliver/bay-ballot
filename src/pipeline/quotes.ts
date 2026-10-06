import type { Contest } from "@/lib/schema";

export type Page = { url: string; text: string; kind: "html" | "pdf" };
export type KeptQuote = { text: string; source: string };
export type DropReason =
  | "not-found"
  | "too-short"
  | "crosses-boundary"
  | "attributed-speech"
  | "partial-sentence"
  | "not-substantive"
  | "not-standalone";
export type DroppedQuote = { quote: string; reason: DropReason };

const MIN_WORDS = 5;
const MIN_CHARS = 20;
const MIN_CJK_CHARS = 10;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const ATTRIBUTION_WINDOW = 80;
const ATTRIBUTION_PHRASES = [
  "opponents", "critics", "proponents say", "supporters say", "they say",
  "they claim", "argue that", "according to", "claims that", "say that",
];
const TRAILING_ATTRIBUTION =
  /^\s*["”’]?\s*,?\s*(?:[^.]{0,40}\s)?(says|said|argues?|argued|claims?|claimed|warns?|warned|according to)\b/i;
const EDGE_QUOTES = /^["'“”‘’‛‟]+|["'“”‘’‛‟]+$/g;

export function segments(page: Page): string[] {
  if (page.kind === "html") return page.text.split("\n");
  const joined = page.text.replace(/([a-z])-\n([a-z])/g, "$1$2");
  return joined.split(/\n\s*\n|\f/);
}

function normalizeChar(ch: string): string {
  return ch
    .normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s/g, "")
    .toLowerCase();
}

/** `map[i]` is the index in `s` of the char that produced `norm[i]`. */
export function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    for (const out of normalizeChar(ch)) {
      norm += out;
      map.push(i);
    }
    i += ch.length;
  }
  return { norm, map };
}

const normalize = (s: string) => normalizeWithMap(s).norm;

export function isSentenceStart(before: string): boolean {
  let b = before.trimEnd();
  if (b === "") return true;
  if (/["“”]$/.test(b)) b = b.slice(0, -1).trimEnd();
  return b === "" || /[.!?:;。！？]$/.test(b);
}

function isSentenceEnd(span: string, after: string): boolean {
  const a = after.trimStart().replace(/^["”’)\]]+/, "").trimStart();
  return a === "" || /^[.!?。！？]/.test(a) || /[.!?。！？]$/.test(span);
}

function isTooShort(quote: string, normQuote: string): boolean {
  const cjk = quote.match(CJK)?.length ?? 0;
  if (cjk > 0) return cjk < MIN_CJK_CHARS;
  const words = quote.split(/\s+/).filter(Boolean).length;
  return words < MIN_WORDS || normQuote.length < MIN_CHARS;
}

const SENTENCE_END = /[.!?。！？]/g;
// we/our/us/my as the first or second word: "We think…", "From our writeup…".
const FIRST_PERSON_OPENING = /^\s*(?:\S+\s+)?(we|our|us|my)\b/i;
const ABBREVIATIONS = /\b(?:U\.S\.A\.|U\.S\.|Mrs\.|Mr\.|Ms\.|Dr\.|St\.|No\.(?=\s*\d)|Prop\.|Jr\.|Sr\.|vs\.|e\.g\.|i\.e\.)/gi;
const hasPhrase = (t: string) => ATTRIBUTION_PHRASES.some((p) => t.toLowerCase().includes(p));

function sentencesBefore(before: string): { current: string; previous: string } {
  const w = before.slice(-ATTRIBUTION_WINDOW);
  const masked = w.replace(ABBREVIATIONS, (a) => a.replace(/\./g, "_")); // same length, so indexes line up
  const ends = [...masked.matchAll(SENTENCE_END)].map((m) => m.index);
  const last = ends.at(-1);
  if (last === undefined) return { current: w, previous: "" };
  const prevEnd = ends.at(-2);
  return { current: w.slice(last + 1), previous: w.slice(prevEnd === undefined ? 0 : prevEnd + 1, last) };
}

const SPEECH_VERB = /\b(says|said|argues|argued|claims|claimed|warns|warned|writes|wrote)\b/i;

const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word-bounded for any script and for names ending in punctuation: "SPUR" is not in "spurred".
const mentions = (text: string, name: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "iu").test(text);

const speaksAsGuide = (span: string, ownNames: string[]) =>
  FIRST_PERSON_OPENING.test(span) || ownNames.some((n) => n.trim() !== "" && mentions(span, n.trim()));

// A speech verb whose subject isn't the guide ("Chan writes", not "We wrote").
const OTHERS_SPEECH_VERB = new RegExp(`(?<!\\b(?:we|i)\\s+)${SPEECH_VERB.source}`, "i");

const isReportedSpeech = (sentence: string) => hasPhrase(sentence) || SPEECH_VERB.test(sentence);

export type AttributionContext = { span?: string; ownNames?: string[] };

export function isAttributedSpeech(
  before: string,
  after: string,
  previous = "",
  { span = "", ownNames = [] }: AttributionContext = {},
): boolean {
  const curlyInside = before.lastIndexOf("“") > before.lastIndexOf("”") && after.includes("”");
  const straightInside = (before.match(/"/g) ?? []).length % 2 === 1 && after.includes('"');
  if (curlyInside || straightInside) return true;
  const { current, previous: prevSentence } = sentencesBefore(before);
  // "The Chamber writes:" introduces someone else's words; "From our writeup in June:" does not.
  const colonIntro =
    previous.trimEnd().endsWith(":") &&
    (!FIRST_PERSON_OPENING.test(previous) || hasPhrase(previous) || OTHERS_SPEECH_VERB.test(previous));
  const speaksAsSelf = speaksAsGuide(span, ownNames);
  return (
    hasPhrase(current) ||
    (isReportedSpeech(span) && !speaksAsSelf) ||
    (isReportedSpeech(prevSentence) && !speaksAsSelf) ||
    hasPhrase(previous) ||
    colonIntro ||
    TRAILING_ATTRIBUTION.test(after.slice(0, 60))
  );
}

type Candidate = { text: string } | { reason: DropReason };

function findInSegment(segment: string, previous: string, normQuote: string, ownNames: string[]): Candidate[] {
  const { norm, map } = normalizeWithMap(segment);
  const out: Candidate[] = [];
  for (let i = norm.indexOf(normQuote); i !== -1; i = norm.indexOf(normQuote, i + 1)) {
    const start = map[i];
    const end = map[i + normQuote.length - 1] + 1;
    const span = segment.slice(start, end);
    const before = segment.slice(0, start);
    const after = segment.slice(end);
    if (isAttributedSpeech(before, after, previous, { span, ownNames })) {
      out.push({ reason: "attributed-speech" });
    } else if (!isSentenceStart(before) || !isSentenceEnd(span, after)) {
      out.push({ reason: "partial-sentence" });
    } else {
      out.push({ text: span.replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

const ANNOUNCEMENTS = [
  /^we(?:'re|’re| are)?\s+(?:so\s+|very\s+)?(?:proud|thrilled|excited|happy|pleased|honored|delighted)\s+to\s+(?:endorse|support|recommend)\b/i,
  /^we\s+(?:endorse|support|recommend|urge)\b/i,
  /^(?:please\s+)?(?:vote|re-?elect|elect)\b/i,
  /^(?:yes|no)\s+on\b/i,
  // "Connie Chan for Congress!": a short slogan naming an office.
  /^(?:\S+\s+){0,6}for\s+(?:congress|supervisor|assembly|senate|governor|mayor|district|bart|school\s+board|board\s+of|d\d)\b[^.?]*!\s*$/i,
];
const MAX_ANNOUNCEMENT_WORDS = 15;
const THANKS = /^(?:thank\s+you|thanks)\b/i;
// "to" counts only before a verb-like word: "to save Muni", not "to endorse" or "to everyone".
const REASON =
  /\b(?:because|since|will|would|could|has|have|had|record|so\s+that|which|as\s+an?|for\s+(?:more|better|safer|cleaner|stronger|fewer|less|lower)|who\s+(?:has|have|will|would|is|was)|to\s+(?!(?:endorse|support|recommend|vote|announce|everyone|all|our|the|a|an|you|us|them)\b)[a-z]+)\b/i;

export function isSubstantive(text: string): boolean {
  const t = text.trim().replace(EDGE_QUOTES, "").trim();
  if (THANKS.test(t)) return false;
  if (t.split(/\s+/).length > MAX_ANNOUNCEMENT_WORDS) return true;
  if (!ANNOUNCEMENTS.some((re) => re.test(t))) return true;
  return REASON.test(t);
}

const ANAPHORIC_OPENING = /^\W*(?:this|that|it|these|those|he|she|they|his|her|their|such)\b/i;
const SELF_CONTAINED_NOUNS =
  "city|state|county|country|year|election|ballot|measure|proposition|prop|initiative|charter";
const SELF_REFERENCE = new RegExp(
  `^\\W*(?:this|that|these|those)\\s+(?:${SELF_CONTAINED_NOUNS})(?:s|['’]s)?(?![\\p{L}\\p{N}])`,
  "iu",
);
const NAME_SUFFIX = /^(?:jr|sr|ii|iii|iv)\.?$/i;

function surnames(c: Contest): string[] {
  return c.candidates
    .map((n) => n.replace(/\s*(?:\([^)]*\)|["“”][^"“”]*["“”])\s*/, " ").replace(/,/g, " "))
    .map((n) => n.split(/\s+/).filter((t) => t && !NAME_SUFFIX.test(t)).at(-1) ?? "")
    .filter((t) => t.length > 1);
}

function namesSubject(text: string, c: Contest): boolean {
  const bounded = (body: string, flags = "u") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, flags);
  if (c.kind === "measure") {
    const id = c.id === "rtm" ? "RTM" : c.id.match(/^prop-(\w+)$/)?.[1];
    if (!id) return false;
    if (c.id === "rtm") return bounded("RTM|Regional\\s+(?:Transit\\s+)?Measure", "iu").test(text);
    return bounded(`(?:Prop(?:osition)?\\.?|Measure)\\s*${id}`, "iu").test(text);
  }
  return surnames(c).some((s) => bounded(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text));
}

const PERSONAL_PRONOUN = /^\W*(?:he|she|his|her)\b/i;

export function standsAlone(text: string, contest: Contest, { names }: { names?: string[] } = {}): boolean {
  const t = text.trim();
  if (!ANAPHORIC_OPENING.test(t) || SELF_REFERENCE.test(t)) return true;
  if (names?.length === 1 && PERSONAL_PRONOUN.test(t)) return true;
  return namesSubject(t, contest);
}

export function verifyQuotes(
  quotes: string[],
  pages: Page[],
  { ownNames = [] }: { ownNames?: string[] } = {},
): { kept: KeptQuote[]; dropped: DroppedQuote[] } {
  const pageSegments = pages.map((p) => ({ page: p, segs: segments(p) }));
  const wholePages = pageSegments.map(({ segs }) => normalize(segs.join("")));
  const kept: KeptQuote[] = [];
  const dropped: DroppedQuote[] = [];
  const seen = new Set<string>();

  for (const raw of quotes) {
    const trimmed = raw.trim().replace(EDGE_QUOTES, "").trim();
    const normQuote = normalize(trimmed);
    if (isTooShort(trimmed, normQuote)) {
      dropped.push({ quote: raw, reason: "too-short" });
      continue;
    }
    if (!isSubstantive(trimmed)) {
      dropped.push({ quote: raw, reason: "not-substantive" });
      continue;
    }

    let reason: DropReason | null = null;
    let found: KeptQuote | null = null;
    let foundNorm = "";
    outer: for (const { page, segs } of pageSegments) {
      let previous = "";
      for (const seg of segs) {
        const candidates = findInSegment(seg, previous, normQuote, ownNames);
        if (seg.trim() !== "") previous = seg;
        for (const c of candidates) {
          if ("text" in c) {
            found = { text: c.text, source: page.url };
            foundNorm = normalize(c.text);
            break outer;
          }
          reason ??= c.reason;
        }
      }
    }
    if (!found) {
      reason ??= wholePages.some((w) => w.includes(normQuote)) ? "crosses-boundary" : "not-found";
      dropped.push({ quote: raw, reason });
      continue;
    }
    if (seen.has(foundNorm)) continue;
    seen.add(foundNorm);
    kept.push(found);
  }
  return { kept, dropped };
}
