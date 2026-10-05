import path from "node:path";
import { listElections, loadElection, type ElectionData } from "./data";
import type { EndorsementFile } from "./schema";

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

// Prefer the archived snapshot so links survive the guide page changing or going away.
export function sourceLink(file: EndorsementFile, url: string): string {
  return file.archived?.find((a) => a.source === url)?.snapshot ?? url;
}
