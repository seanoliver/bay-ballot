import path from "node:path";
import { listElections, loadElection, type ElectionData } from "./data";
import { pendingNote } from "./display";
import { pendingGuides, publishedFiles, publishedGuides, type GuideInfo } from "./filters";

export const DATA_ROOT = path.join(process.cwd(), "data");

export function elections(root: string = DATA_ROOT): string[] {
  return listElections(root);
}

export function latestElection(root: string = DATA_ROOT): string {
  const all = elections(root);
  const last = all.at(-1);
  if (!last) throw new Error(`${root}: no elections found`);
  return last;
}

const cache = new Map<string, ElectionData>();

// Loads (once per process) an election from DATA_ROOT; undefined for ids that aren't election directories.
export function election(id: string): ElectionData | undefined {
  if (!elections().includes(id)) return undefined;
  let d = cache.get(id);
  if (!d) {
    d = loadElection(DATA_ROOT, id);
    cache.set(id, d);
  }
  return d;
}

// The ballot view's props: published guides and files only, slimmed, plus the pending note.
export function ballotViewProps(d: ElectionData) {
  const published = publishedGuides(d.guides, d.endorsements);
  return {
    ballot: d.ballot,
    guides: published.map(({ id, name, shortName, type }): GuideInfo => ({ id, name, ...(shortName ? { shortName } : {}), type })),
    files: publishedFiles(d.endorsements),
    pending: pendingNote(pendingGuides(d.guides, d.endorsements)),
  };
}
