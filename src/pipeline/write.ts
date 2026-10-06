import { Document, isMap, isScalar, parseDocument, type Pair } from "yaml";
import { isDeepStrictEqual } from "node:util";
import type { ArchivedSource, EndorsementFile, Entry } from "@/lib/schema";
import { sourcesFor } from "./sources";

/**
 * New snapshots replace older ones for the same source; snapshots for sources that weren't
 * re-archived this run are kept, and ones for sources the file no longer lists are dropped.
 */
function mergeArchived(prev: EndorsementFile, fresh: ArchivedSource[]): ArchivedSource[] {
  const bySource = new Map((prev.archived ?? []).map((a) => [a.source, a]));
  for (const a of fresh) bySource.set(a.source, a);
  return sourcesFor(prev).flatMap((url) => bySource.get(url) ?? []);
}

/**
 * The endorsement file after an extraction run. Settings come from `prev`; picks and fetch facts
 * are new. fetchedAt moves only when picks or quotes changed, so unchanged files stay unchanged.
 */
export function nextFile(
  prev: EndorsementFile,
  picks: Record<string, Entry>,
  hasReasoning: boolean,
  today: string,
  archived?: ArchivedSource[],
): EndorsementFile {
  // A held pick stays held (and out of `picks`) while extraction keeps returning it unchanged;
  // a different pick for that contest drops the hold and goes back through verification.
  const held = (prev.held ?? []).filter((h) => picks[h.contestId] && isDeepStrictEqual(picks[h.contestId].pick, h.pick));
  if (held.length) {
    picks = { ...picks };
    for (const h of held) delete picks[h.contestId];
  }
  // isDeepStrictEqual ignores key order, so a reordered but identical result keeps its date.
  const unchanged = isDeepStrictEqual(prev.picks, picks);
  return {
    guide: prev.guide,
    election: prev.election,
    status: Object.keys(picks).length > 0 ? "published" : "pending",
    source: prev.source,
    extraSources: prev.extraSources,
    fetchWith: prev.fetchWith,
    manual: prev.manual,
    allowForeignSources: prev.allowForeignSources,
    archived: archived ? mergeArchived(prev, archived) : prev.archived,
    fetchedAt: unchanged ? prev.fetchedAt : today, // date picks or quotes last changed
    hasReasoning,
    held: held.length ? held : undefined,
    picks,
  };
}

/**
 * A warning when a run would wipe existing picks or cut them below half (usually a fetch or
 * extraction failure, not a real change), else null. `force` accepts the result anyway.
 */
export function shrinkWarning(
  id: string,
  prev: Record<string, Entry>,
  next: Record<string, Entry>,
  { force = false }: { force?: boolean } = {},
): string | null {
  const before = Object.keys(prev).length;
  const after = Object.keys(next).length;
  if (force || before === 0 || after * 2 >= before) return null;
  return `  !! ${id}: ${after} picks (previous ${before}), file left unchanged; rerun with --force to accept`;
}

const KEY_ORDER = [
  "guide", "election", "status", "source", "extraSources", "fetchWith", "manual",
  "allowForeignSources", "archived", "fetchedAt", "hasReasoning", "held", "picks",
] as const satisfies readonly (keyof EndorsementFile)[];

/** An entry without its schema defaults (ranked: false, quotes: []), so files stay short. */
function compactEntry(e: Entry): Record<string, unknown> {
  return {
    pick: e.pick,
    ...(e.ranked ? { ranked: true } : {}),
    ...(e.rankedCount !== undefined ? { rankedCount: e.rankedCount } : {}),
    ...(e.quotes.length ? { quotes: e.quotes } : {}),
  };
}

function ordered(file: EndorsementFile): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of KEY_ORDER) {
    const v = file[k];
    if (v === undefined) continue;
    out[k] = k === "picks" ? Object.fromEntries(Object.entries(file.picks).map(([id, e]) => [id, compactEntry(e)])) : v;
  }
  return out;
}

type Comments = { before?: string | null; inline?: string | null };

function topLevelComments(previous: string): Map<string, Comments> {
  const out = new Map<string, Comments>();
  const doc = parseDocument(previous);
  if (!isMap(doc.contents)) return out;
  for (const p of doc.contents.items as Pair[]) {
    if (!isScalar(p.key)) continue;
    out.set(String(p.key.value), {
      before: p.key.commentBefore,
      inline: isScalar(p.value) ? p.value.comment : undefined,
    });
  }
  return out;
}

/**
 * Serialize an endorsement file with a stable key order and no line wrapping. When `previous`
 * (the old file's text) is given, comments on top-level keys that still exist are carried over,
 * so hand-written notes like "# page also lists the June slate" survive re-extraction.
 */
export function toYaml(file: EndorsementFile, { previous }: { previous?: string } = {}): string {
  const doc = new Document(ordered(file));
  if (previous !== undefined && isMap(doc.contents)) {
    const comments = topLevelComments(previous);
    for (const p of doc.contents.items as Pair[]) {
      if (!isScalar(p.key)) continue;
      const c = comments.get(String(p.key.value));
      if (!c) continue;
      if (c.before) p.key.commentBefore = c.before;
      if (c.inline && isScalar(p.value)) p.value.comment = c.inline;
    }
  }
  return doc.toString({ lineWidth: 0 });
}
