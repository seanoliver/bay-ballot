export type Page = { url: string; text: string; kind: "html" | "pdf" };
export type KeptQuote = { text: string; source: string };
export type DropReason =
  | "not-found"
  | "too-short"
  | "crosses-boundary"
  | "attributed-speech"
  | "partial-sentence";
export type DroppedQuote = { quote: string; reason: DropReason };

const MIN_WORDS = 5;
const MIN_CHARS = 20;
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

/** Match starts at segment start or right after . ! ? : ; (optionally followed by a closing quote). */
export function isSentenceStart(before: string): boolean {
  let b = before.trimEnd();
  if (b === "") return true;
  if (/["“”]$/.test(b)) b = b.slice(0, -1).trimEnd();
  return b === "" || /[.!?:;]$/.test(b);
}

function isSentenceEnd(span: string, after: string): boolean {
  const a = after.trimStart().replace(/^["”’)\]]+/, "").trimStart();
  return a === "" || /^[.!?]/.test(a) || /[.!?]$/.test(span);
}

/** Span sits inside quotation marks, or is preceded by phrasing that attributes it to someone else. */
export function isAttributedSpeech(before: string, after: string, previous = ""): boolean {
  const curlyInside = before.lastIndexOf("“") > before.lastIndexOf("”") && after.includes("”");
  const straightInside = (before.match(/"/g) ?? []).length % 2 === 1 && after.includes('"');
  if (curlyInside || straightInside) return true;
  const hasPhrase = (t: string) => ATTRIBUTION_PHRASES.some((p) => t.toLowerCase().includes(p));
  return (
    hasPhrase(before.slice(-ATTRIBUTION_WINDOW)) ||
    hasPhrase(previous) ||
    previous.trimEnd().endsWith(":") ||
    TRAILING_ATTRIBUTION.test(after.slice(0, 60))
  );
}

type Candidate = { text: string } | { reason: DropReason };

function findInSegment(segment: string, previous: string, normQuote: string): Candidate[] {
  const { norm, map } = normalizeWithMap(segment);
  const out: Candidate[] = [];
  for (let i = norm.indexOf(normQuote); i !== -1; i = norm.indexOf(normQuote, i + 1)) {
    const start = map[i];
    const end = map[i + normQuote.length - 1] + 1;
    const span = segment.slice(start, end);
    const before = segment.slice(0, start);
    const after = segment.slice(end);
    if (isAttributedSpeech(before, after, previous)) {
      out.push({ reason: "attributed-speech" });
    } else if (!isSentenceStart(before) || !isSentenceEnd(span, after)) {
      out.push({ reason: "partial-sentence" });
    } else {
      out.push({ text: span.replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

/** Keep only quotes found word-for-word inside one segment of a page, publishing the page's own text. */
export function verifyQuotes(
  quotes: string[],
  pages: Page[],
): { kept: KeptQuote[]; dropped: DroppedQuote[] } {
  const pageSegments = pages.map((p) => ({ page: p, segs: segments(p) }));
  const wholePages = pageSegments.map(({ segs }) => normalize(segs.join("")));
  const kept: KeptQuote[] = [];
  const dropped: DroppedQuote[] = [];
  const seen = new Set<string>();

  for (const raw of quotes) {
    const trimmed = raw.trim().replace(EDGE_QUOTES, "").trim();
    const normQuote = normalize(trimmed);
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS || normQuote.length < MIN_CHARS) {
      dropped.push({ quote: raw, reason: "too-short" });
      continue;
    }

    let reason: DropReason | null = null;
    let found: KeptQuote | null = null;
    let foundNorm = "";
    outer: for (const { page, segs } of pageSegments) {
      let previous = "";
      for (const seg of segs) {
        const candidates = findInSegment(seg, previous, normQuote);
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
