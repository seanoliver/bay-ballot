import { createHash } from "node:crypto";
import type { Ballot } from "@/lib/schema";
import type { Aliases } from "@/lib/names";
import type { Fetched } from "./fetch";
import { contestMarkers } from "./placement";

// Normalized page text is stored per source so a daily refresh can tell a real change (a new
// pick, a changed rank) from churn (dates, "3 hours ago", cookie banners) without calling a model.

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const WEEKDAYS = "mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const DATE_PATTERNS = [
  new RegExp(`\\b(?:${WEEKDAYS})\\.?,?(?=\\s)`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "gi"), // Oct. 5, 2026
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?(?:,?\\s+\\d{4})?\\b`, "gi"), // 5 October 2026
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{4}\\b`, "gi"), // October 2026
  /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, // 2026-10-05
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // 10/05/2026
  /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?/gi, // 9:30 am, 21:30
  /\b\d{1,2}\s*[ap]\.?m\.?(?![a-z])/gi, // 9am, 9 p.m.
];
// Lines that only report freshness: "3 hours ago", "Updated 5 minutes ago", "Last updated yesterday".
const RELATIVE_LINE =
  /^(?:(?:last\s+)?updated|posted|published|edited)\b|\b(?:\d+|an?|a few)\s+(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+ago\b|^(?:just now|yesterday|today)$/i;
const COUNTER = /\b\d[\d,.]*\s*[kKmM]?\s+(?:comments?|shares?|likes?|views?|followers?|retweets?|reposts?|reactions?|replies)\b/g;
const BOILERPLATE =
  /cookie|accept all|privacy policy|terms of (?:service|use)|subscribe|newsletter|sign up|all rights reserved|©|\bcopyright\b|skip to (?:main )?content/i;
const MAX_BOILERPLATE_LINE = 200;

/** Page text with dates, relative times, counters and boilerplate removed; whitespace collapsed; duplicate lines dropped. */
export function normalizePageText(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    let line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (RELATIVE_LINE.test(line)) continue;
    if (line.length <= MAX_BOILERPLATE_LINE && BOILERPLATE.test(line)) continue;
    line = line.replace(COUNTER, " ");
    for (const re of DATE_PATTERNS) line = line.replace(re, " ");
    line = line.replace(/\s*[·|•,]\s*(?=[·|•,]|$)/g, "").replace(/^[\s·|•,:-]+/, "").replace(/\s+/g, " ").trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out.join("\n");
}

const PDF_DIGEST = /^pdf-sha256:[0-9a-f]{64}$/;

/** What gets stored for a fetched source: normalized text, or a digest for a PDF with no extractable text. */
export function storedText(fetched: Fetched): string {
  if (fetched.kind === "pdf" && fetched.text.trim() === "") {
    return `pdf-sha256:${createHash("sha256").update(fetched.base64).digest("hex")}`;
  }
  return normalizePageText(fetched.text);
}

const ENDORSEMENT_WORDS =
  /\b(?:endors\w*|recommend\w*|support\w*|oppos\w*|vote\s+(?:yes|no)|yes\s+on|no\s+on|ranked|rank|slate)\b|#\s?1\b/i;
const NAME_SUFFIX = /^(?:jr|sr|ii|iii|iv)\.?$/i;

function nameMarkers(ballot: Ballot, extra: Aliases): RegExp[] {
  const names = new Set<string>();
  const add = (n: string) => {
    const bare = n.replace(/\s*(?:\([^)]*\)|["“”][^"“”]*["“”])\s*/, " ").replace(/,/g, " ").trim();
    names.add(bare);
    const surname = bare.split(/\s+/).filter((t) => !NAME_SUFFIX.test(t)).at(-1);
    if (surname && surname.length >= 4) names.add(surname);
  };
  for (const c of ballot.contests) {
    for (const n of c.candidates) add(n);
    for (const list of Object.values(c.aliases ?? {})) list.forEach(add);
  }
  for (const list of Object.values(extra)) list.forEach(add);
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return [...names].filter(Boolean).map((n) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(n)}(?![\\p{L}\\p{N}])`, "iu"));
}

/**
 * True when the difference between two versions of a page could change an endorsement: an
 * added or removed line names a contest, candidate, alias or surname, or uses an endorsement
 * word. Date, counter, boilerplate and whitespace changes never count.
 */
export function relevantChange(oldText: string, newText: string, ballot: Ballot, aliases: Aliases = {}): boolean {
  const a = new Set(normalizePageText(oldText).split("\n"));
  const b = new Set(normalizePageText(newText).split("\n"));
  const changed = [...[...a].filter((l) => !b.has(l)), ...[...b].filter((l) => !a.has(l))].filter(Boolean);
  if (changed.length === 0) return false;
  const markers = [...ballot.contests.flatMap(contestMarkers), ...nameMarkers(ballot, aliases)];
  return changed.some((line) => ENDORSEMENT_WORDS.test(line) || markers.some((re) => re.test(line)));
}

export type Gate = "new" | "same" | "irrelevant" | "relevant";

/** How a freshly fetched page compares with what is stored for it. */
export function pageGate(stored: string | null, fresh: string, ballot: Ballot, aliases: Aliases = {}): Gate {
  if (stored === null) return "new";
  if (stored === fresh) return "same";
  if (PDF_DIGEST.test(stored) || PDF_DIGEST.test(fresh)) return "relevant";
  return relevantChange(stored, fresh, ballot, aliases) ? "relevant" : "irrelevant";
}

const MAX_SLUG = 100;

/** A stable, file-safe name for a source URL: host (without www.) plus path. */
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
