import { createHash } from "node:crypto";
import path from "node:path";
import { areaContests, snapshotOf, viewFor, type ElectionSnapshot } from "./area-view";
import { listElections, loadElection, type ElectionData } from "./data";
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

// Cached per load, so the metadata and the page share one snapshot and its memoized views.
const snapshots = new WeakMap<ElectionData, ElectionSnapshot>();
export function electionSnapshot(d: ElectionData): ElectionSnapshot {
  let s = snapshots.get(d);
  if (!s) {
    s = snapshotOf(d);
    snapshots.set(d, s);
  }
  return s;
}

// Versioned by content, so a browser never pairs one deploy's page with another's data.
const urls = new WeakMap<ElectionSnapshot, string>();
export function snapshotUrl(s: ElectionSnapshot): string {
  let url = urls.get(s);
  if (!url) {
    url = `/${s.election}/snapshot.json?v=${createHash("sha1").update(JSON.stringify(s)).digest("hex").slice(0, 10)}`;
    urls.set(s, url);
  }
  return url;
}

export function ballotViewProps(d: ElectionData, { area = null }: { area?: Area | null } = {}) {
  const { groups, guides, allGuides, files, pending, fallback } = viewFor(electionSnapshot(d), area?.id ?? null);
  return {
    ballot: { ...d.ballot, contests: areaContests(d.ballot.contests, area) },
    groups,
    guides,
    allGuides,
    files,
    pending,
    ...(area ? { fallback } : {}),
  };
}
