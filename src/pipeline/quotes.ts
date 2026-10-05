export type Page = { url: string; text: string; kind: "html" | "pdf" };
export type KeptQuote = { text: string; source: string };
export type DropReason =
  | "not-found"
  | "too-short"
  | "crosses-boundary"
  | "attributed-speech"
  | "partial-sentence"
  | "not-substantive";
export type DroppedQuote = { quote: string; reason: DropReason };

const MIN_WORDS = 5;
const MIN_CHARS = 20;
// CJK text has no spaces between words, so length is counted in characters instead.
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

/** Split page text into segments; a quote must lie entirely inside one. */
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

/** Normalize, keeping for each output char the index of its source char in `s`. */
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

/** Match starts at segment start or right after . ! ? : ; 。！？ (optionally followed by a closing quote). */
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
// Text opens in the first person when we/our/us/my is its first or second word ("We think…",
// "From our writeup in June:"), not "The Mayor told us:" or "It will cost our businesses…".
const FIRST_PERSON_OPENING = /^\s*(?:\S+\s+)?(we|our|us|my)\b/i;
// Abbreviations whose period does not end a sentence.
const ABBREVIATIONS = /\b(?:U\.S\.A\.|U\.S\.|Mrs\.|Mr\.|Ms\.|Dr\.|St\.|No\.(?=\s*\d)|Prop\.|Jr\.|Sr\.|vs\.|e\.g\.|i\.e\.)/gi;
const hasPhrase = (t: string) => ATTRIBUTION_PHRASES.some((p) => t.toLowerCase().includes(p));

/** Split `before` (capped to the attribution window) into the open sentence and the one before it. */
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

// Own voice: the sentence opens in the first person ("We think…", "In our view…") or names the
// guide. A "we/our/us" later in the sentence ("It will cost our businesses…") is not enough.
const speaksAsGuide = (span: string, ownNames: string[]) =>
  FIRST_PERSON_OPENING.test(span) || ownNames.some((n) => n.trim() !== "" && mentions(span, n.trim()));

// A speech verb whose subject isn't the guide ("Chan writes", not "We wrote").
const OTHERS_SPEECH_VERB = new RegExp(`(?<!\\b(?:we|i)\\s+)${SPEECH_VERB.source}`, "i");

/** A sentence that reports someone else's words: an attribution phrase or a speech verb. */
const isReportedSpeech = (sentence: string) => hasPhrase(sentence) || SPEECH_VERB.test(sentence);

export type AttributionContext = { span?: string; ownNames?: string[] };

/**
 * Span sits inside quotation marks, or is attributed to someone else: an attribution phrase
 * earlier in its own sentence, a previous sentence with an attribution phrase or speech verb (unless the span
 * speaks as the guide: "we/our/us" or the guide's name), a phrase in the previous segment, a
 * previous segment ending in a colon that doesn't open in the first person ("The Chamber
 * writes:", "The Mayor told us:", but not "From our writeup in June:"), or a trailing "..., the Chamber says".
 */
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

// Endorsement announcements and calls to vote state a pick, not a reason for it.
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
// Words that introduce a reason. "to" counts only before a verb-like word ("to save Muni"),
// not "to endorse" or "to everyone".
const REASON =
  /\b(?:because|since|will|would|could|has|have|had|record|so\s+that|which|as\s+an?|for\s+(?:more|better|safer|cleaner|stronger|fewer|less|lower)|who\s+(?:has|have|will|would|is|was)|to\s+(?!(?:endorse|support|recommend|vote|announce|everyone|all|our|the|a|an|you|us|them)\b)[a-z]+)\b/i;

/** False for quotes that only announce, slogan, call to vote or thank, with no reason in them. */
export function isSubstantive(text: string): boolean {
  const t = text.trim().replace(EDGE_QUOTES, "").trim();
  if (THANKS.test(t)) return false;
  // A long sentence that opens like an announcement usually goes on to say something.
  if (t.split(/\s+/).length > MAX_ANNOUNCEMENT_WORDS) return true;
  if (!ANNOUNCEMENTS.some((re) => re.test(t))) return true;
  return REASON.test(t);
}

/** Keep only quotes found word-for-word inside one segment of a page, publishing the page's own text. */
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
