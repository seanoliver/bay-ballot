import path from "node:path";
import { areaGuides, inArea, placeGroups } from "./areas";
import { listElections, loadElection, type ElectionData } from "./data";
import { pendingNote } from "./display";
import { pendingGuides, publishedFiles, publishedGuides, type GuideInfo } from "./filters";
import type { Area } from "./schema";

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

export function election(id: string): ElectionData | undefined {
  if (!elections().includes(id)) return undefined;
  let d = cache.get(id);
  if (!d) {
    d = loadElection(DATA_ROOT, id);
    cache.set(id, d);
  }
  return d;
}

export function ballotViewProps(d: ElectionData, { area = null }: { area?: Area | null } = {}) {
  const inScope = area ? areaGuides(d.guides, area) : d.guides;
  const published = publishedGuides(inScope, d.endorsements);
  const ids = new Set(published.map((g) => g.id));
  const contests = area ? d.ballot.contests.filter((c) => inArea(c, area)) : d.ballot.contests;
  return {
    ballot: { ...d.ballot, contests },
    groups: placeGroups(contests, d.areas),
    guides: published.map(({ id, name, shortName, type }): GuideInfo => ({ id, name, ...(shortName ? { shortName } : {}), type })),
    files: Object.fromEntries(Object.entries(publishedFiles(d.endorsements)).filter(([id]) => ids.has(id))),
    pending: pendingNote(pendingGuides(inScope, d.endorsements)),
  };
}
