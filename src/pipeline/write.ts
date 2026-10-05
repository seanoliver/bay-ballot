import { Document, isMap, isScalar, parseDocument, type Pair } from "yaml";
import type { EndorsementFile, Entry } from "@/lib/schema";

/** The endorsement file after an extraction run. Settings come from `prev`; picks and fetch facts are new. */
export function nextFile(
  prev: EndorsementFile,
  picks: Record<string, Entry>,
  hasReasoning: boolean,
  today: string,
  archived?: string[],
): EndorsementFile {
  return {
    guide: prev.guide,
    election: prev.election,
    status: Object.keys(picks).length > 0 ? "published" : "pending",
    source: prev.source,
    extraSources: prev.extraSources,
    fetchWith: prev.fetchWith,
    manual: prev.manual,
    allowForeignSources: prev.allowForeignSources,
    archived: archived ?? prev.archived,
    fetchedAt: today,
    hasReasoning,
    picks,
  };
}

const KEY_ORDER = [
  "guide", "election", "status", "source", "extraSources", "fetchWith", "manual",
  "allowForeignSources", "archived", "fetchedAt", "hasReasoning", "picks",
] as const satisfies readonly (keyof EndorsementFile)[];

/** An entry without its schema defaults (ranked: false, quotes: []), so files stay short. */
function compactEntry(e: Entry): Record<string, unknown> {
  return { pick: e.pick, ...(e.ranked ? { ranked: true } : {}), ...(e.quotes.length ? { quotes: e.quotes } : {}) };
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
