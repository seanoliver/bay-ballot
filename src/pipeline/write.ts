import { Document, isMap, isScalar, parseDocument, type Pair } from "yaml";
import { isDeepStrictEqual } from "node:util";
import type { ArchivedSource, EndorsementFile, Entry } from "@/lib/schema";
import { isRejected } from "@/lib/quote-key";
import { sourcesFor } from "./sources";

function mergeArchived(prev: EndorsementFile, fresh: ArchivedSource[]): ArchivedSource[] {
  const bySource = new Map((prev.archived ?? []).map((a) => [a.source, a]));
  for (const a of fresh) bySource.set(a.source, a);
  return sourcesFor(prev).flatMap((url) => bySource.get(url) ?? []);
}

export function nextFile(
  prev: EndorsementFile,
  picks: Record<string, Entry>,
  hasReasoning: boolean,
  today: string,
  archived?: ArchivedSource[],
): EndorsementFile {
  const held = (prev.held ?? []).filter((h) => picks[h.contestId] && isDeepStrictEqual(picks[h.contestId].pick, h.pick));
  if (held.length) {
    picks = { ...picks };
    for (const h of held) delete picks[h.contestId];
  }
  const rejected = prev.rejectedQuotes ?? [];
  if (rejected.length) {
    picks = Object.fromEntries(Object.entries(picks).map(([id, e]) => [id, { ...e, quotes: e.quotes.filter((q) => !isRejected(q.text, id, rejected)) }]));
  }
  // isDeepStrictEqual ignores key order, so a reordered but identical result keeps its date.
  const unchanged = isDeepStrictEqual(prev.picks, picks);
  return {
    ...prev,
    status: Object.keys(picks).length > 0 ? "published" : "pending",
    archived: archived ? mergeArchived(prev, archived) : prev.archived,
    fetchedAt: unchanged ? prev.fetchedAt : today, // date picks or quotes last changed
    hasReasoning,
    held: held.length ? held : undefined,
    picks,
  };
}

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

export const KEY_ORDER = [
  "guide", "election", "status", "source", "extraSources", "fetchWith", "fetchFrom", "manual",
  "allowForeignSources", "archived", "fetchedAt", "hasReasoning", "held", "rejectedQuotes", "picks",
] as const satisfies readonly (keyof EndorsementFile)[];

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
