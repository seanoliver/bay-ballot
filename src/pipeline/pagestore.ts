import { createHash } from "node:crypto";
import type { Ballot } from "@/lib/schema";
import type { Aliases } from "@/lib/names";
import type { Fetched } from "./fetch";
import { contestMarkerSet, lowerWords, needleOf, type Matcher } from "./placement";

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const WEEKDAYS = "mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const DATE_PATTERNS = [
  new RegExp(`\\b(?:${WEEKDAYS})\\.?,?(?=\\s)`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "gi"), // Oct. 5, 2026
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?(?:,?\\s+\\d{4})?\\b`, "gi"), // 5 October 2026
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{4}\\b`, "gi"), // October 2026
  /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?/gi, // 9:30 am, 21:30
  /\b\d{1,2}\s*[ap]\.?m\.?(?![a-z])/gi, // 9am, 9 p.m.
];
const RELATIVE_TIME = /\b(?:\d+|an?|a few)\s+(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+ago\b|\bjust now\b/gi;
const FRESHNESS_PREFIX = /^(?:last\s+)?(?:updated|posted|published|edited)\b/i;
const FILLER = /\b(?:on|at|by|yesterday|today)\b|[:\-–—.,]/gi;
const COUNTER = /\b\d[\d,.]*\s*[kKmM]?\s+(?:comments?|shares?|likes?|views?|followers?|retweets?|reposts?|reactions?|replies)\b/g;
const BOILERPLATE =
  /cookie|accept all|privacy policy|terms of (?:service|use)|subscribe|newsletter|sign up|all rights reserved|©|\bcopyright\b|skip to (?:main )?content/i;
const IMAGE_FILE_ALT = /^\[[^\]]*\.(?:png|jpe?g|gif|webp|svg|heic|avif)\]$/i;
// Not part of BOILERPLATE: a breadcrumb like "Home > Endorsements" must drop even though it has an endorsement word.
const NAVIGATION = /^(?:you are here\b|breadcrumbs?\b)/i;
const MAX_BOILERPLATE_LINE = 200;

const ENDORSEMENT_WORDS =
  /\b(?:endors\w*|recommend\w*|support\w*|oppos\w*|vote\s+(?:yes|no|for|against)|yes\s+on|no\s+on|ranked|rank|slate)\b|#\s?1\b/i;
// A verdict at the start of a line: "YES", "No - …", "Strong yes", "No position", "✓".
const VERDICT = /^[\W_]*(?:(?:strong(?:ly)?|hell|oh hell)\s+)?(?:yes|no|support|oppose|neutral)\b|^[\W_]*(?:✓|✔|✗|✘|❌|✅)/i;
const GENERIC_CONTEST = /\b(?:[Pp]rop(?:osition)?s?\.?|PROP(?:OSITION)?S?\.?|[Mm]easure|MEASURE)\s*[A-Z0-9]{1,3}\b|\bRTM\b/;

type Markers = { always: RegExp[]; byNeedle: Map<string, RegExp[]> };
const NO_MARKERS: Markers = { always: [], byNeedle: new Map() };

function hits(line: string, { always, byNeedle }: Markers): boolean {
  if (always.some((re) => re.test(line))) return true;
  return lowerWords(line).some((w) => byNeedle.get(w)?.some((re) => re.test(line)));
}

function endorsementContent(line: string, markers: Markers = NO_MARKERS): boolean {
  return VERDICT.test(line) || ENDORSEMENT_WORDS.test(line) || GENERIC_CONTEST.test(line) || hits(line, markers);
}

export function normalizePageText(text: string, { ballot }: { ballot?: Ballot } = {}): string {
  const markers = ballot ? ballotMarkers(ballot, {}) : undefined;
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    let line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    line = line.replace(COUNTER, " ").replace(RELATIVE_TIME, " ");
    for (const re of DATE_PATTERNS) line = line.replace(re, " ");
    line = line.replace(/\s*[·|•,]\s*(?=[·|•,]|$)/g, "").replace(/^[\s·|•,:-]+/, "").replace(/\s+/g, " ").trim();
    if (!line || /^(?:yesterday|today)$/i.test(line)) continue;
    if (FRESHNESS_PREFIX.test(line) && line.replace(FRESHNESS_PREFIX, "").replace(FILLER, " ").trim() === "") continue;
    if (NAVIGATION.test(line)) continue;
    if (IMAGE_FILE_ALT.test(line)) continue;
    if (line.length <= MAX_BOILERPLATE_LINE && BOILERPLATE.test(line) && !endorsementContent(line, markers)) continue;
    // No dedupe or sorting: bare "YES"/"NO" lines under each heading carry the picks.
    out.push(line);
  }
  return out.join("\n");
}

const PDF_DIGEST = /^pdf-sha256:[0-9a-f]{64}$/;
export const isPdfDigest = (text: string) => PDF_DIGEST.test(text);

export function storedText(fetched: Fetched, { ballot }: { ballot?: Ballot } = {}): string {
  if (fetched.kind === "pdf" && fetched.text.trim() === "") {
    return `pdf-sha256:${createHash("sha256").update(fetched.base64).digest("hex")}`;
  }
  return normalizePageText(fetched.text, { ballot });
}

const NAME_SUFFIX = /^(?:jr|sr|ii|iii|iv)\.?$/i;

function nameMarkers(ballot: Ballot, extra: Aliases): Matcher[] {
  const names = new Set<string>();
  // A surname alone matches as written or in capitals, so "Park" or "PARK" counts but "the park" doesn't.
  const surnames = new Set<string>();
  const add = (n: string) => {
    const bare = n.replace(/\s*(?:\([^)]*\)|["“”][^"“”]*["“”])\s*/, " ").replace(/,/g, " ").trim();
    names.add(bare);
    const surname = bare.split(/\s+/).filter((t) => !NAME_SUFFIX.test(t)).at(-1);
    if (surname && surname.length >= 4) surnames.add(surname);
  };
  for (const c of ballot.contests) {
    for (const n of c.candidates) add(n);
    for (const list of Object.values(c.aliases ?? {})) list.forEach(add);
  }
  for (const list of Object.values(extra)) list.forEach(add);
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = (n: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(n)}(?![\\p{L}\\p{N}])`, flags);
  const surnameOnly = [...surnames].filter((n) => !names.has(n));
  return [
    ...[...names].filter(Boolean).map((n) => ({ re: re(n, "iu"), needle: needleOf(n) })),
    ...surnameOnly.flatMap((n) => [n, n.toUpperCase()].map((form) => ({ re: re(form, "u"), needle: needleOf(form) }))),
  ];
}

// Keyed by identity, so build a new Ballot rather than mutating one that has been gated.
const markerCache = new WeakMap<Ballot, Map<string, Markers>>();

function ballotMarkers(ballot: Ballot, aliases: Aliases): Markers {
  let byAliases = markerCache.get(ballot);
  if (!byAliases) markerCache.set(ballot, (byAliases = new Map()));
  const key = JSON.stringify(aliases);
  let markers = byAliases.get(key);
  if (!markers) {
    markers = { always: [], byNeedle: new Map() };
    for (const { re, needle } of [...ballot.contests.flatMap((c) => contestMarkerSet(c, ballot.contests)), ...nameMarkers(ballot, aliases)]) {
      if (needle === undefined) markers.always.push(re);
      else markers.byNeedle.set(needle, [...(markers.byNeedle.get(needle) ?? []), re]);
    }
    byAliases.set(key, markers);
  }
  return markers;
}

export function changedLines(a: string[], b: string[]): { removed: number[]; added: number[] } {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  // lcs[i][j] = LCS length of a[start+i..endA) and b[start+j..endB), stored row-major.
  const lcs = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] =
        a[start + i] === b[start + j]
          ? lcs[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1]);
    }
  }
  const removed: number[] = [];
  const added: number[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      i++;
      j++;
    } else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1]) removed.push(start + i++);
    else added.push(start + j++);
  }
  while (i < n) removed.push(start + i++);
  while (j < m) added.push(start + j++);
  return { removed, added };
}

const CONTEXT_LINES = 3;
const MAX_LABEL_WORDS = 4;

export function relevantChange(oldText: string, newText: string, ballot: Ballot, aliases: Aliases = {}): boolean {
  const markers = ballotMarkers(ballot, aliases);
  const a = normalizePageText(oldText, { ballot }).split("\n");
  const b = normalizePageText(newText, { ballot }).split("\n");
  const { removed, added } = changedLines(a, b);
  const mentions = (line: string) => GENERIC_CONTEST.test(line) || hits(line, markers);
  const inA = new Set(a);
  const inB = new Set(b);
  const relevant = (lines: string[], idx: number, other: Set<string>) => {
    const line = lines[idx];
    if (!line) return false;
    // Verdicts and short labels count even if the text exists elsewhere: "YES" under another heading is a new pick.
    const isLabel = VERDICT.test(line) || line.split(/\s+/).length <= MAX_LABEL_WORDS;
    // A moved line naming a contest or candidate can be a reordered ranking, so it is never exempt.
    if (!isLabel && !mentions(line) && other.has(line)) return false;
    if (endorsementContent(line, markers)) return true;
    let nearContest = false;
    for (let k = idx - 1; k >= Math.max(0, idx - CONTEXT_LINES); k--) if (mentions(lines[k])) nearContest = true;
    if (nearContest && /\bagainst\b/i.test(line)) return true;
    return nearContest && line.split(/\s+/).length <= MAX_LABEL_WORDS;
  };
  return removed.some((i) => relevant(a, i, inB)) || added.some((j) => relevant(b, j, inA));
}

export type Gate = "new" | "same" | "irrelevant" | "relevant";

export function pageGate(stored: string | null, fresh: string, ballot: Ballot, aliases: Aliases = {}): Gate {
  if (stored === null) return "new";
  if (stored === fresh) return "same";
  if (PDF_DIGEST.test(stored) || PDF_DIGEST.test(fresh)) return "relevant";
  return relevantChange(stored, fresh, ballot, aliases) ? "relevant" : "irrelevant";
}

const MAX_SLUG = 100;

export function sourceSlug(url: string): string {
  const u = new URL(url);
  const slug = `${u.hostname.replace(/^www\./, "")}${u.pathname}${u.search}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= MAX_SLUG) return slug;
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 10);
  return `${slug.slice(0, MAX_SLUG - 11)}-${hash}`;
}
