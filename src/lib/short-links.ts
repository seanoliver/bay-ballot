import fs from "node:fs";
import path from "node:path";
import { listElections } from "./data";

export type ShortLink = { source: string; destination: string; permanent: false };

const ELECTION = /^\d{4}-\d{2}$/;
const ALWAYS_RESERVED = ["api", "_next"];

function entries(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((name) => {
    if (name.startsWith("(")) return entries(path.join(dir, name));
    if (name.startsWith("[")) return [];
    const stem = name.replace(/\.[^.]+$/, "");
    // Metadata files are served with a different extension (sitemap.ts → /sitemap.xml).
    return [...new Set([name, stem, `${stem}.xml`, `${stem}.txt`])];
  });
}

export function reservedSegments(root: string = process.cwd()): string[] {
  return [...new Set([...entries(path.join(root, "src/app")), ...entries(path.join(root, "public")), ...ALWAYS_RESERVED])];
}

export function shortLinkCollisions(areaIds: string[], reserved: string[]): string[] {
  const taken = new Set([...reserved, ...ALWAYS_RESERVED]);
  return areaIds.flatMap((id) => {
    if (taken.has(id)) return [`area '${id}' collides with the top-level route /${id}`];
    if (ELECTION.test(id)) return [`area '${id}' looks like an election id`];
    return [];
  });
}

export function shortLinkRedirects({ areaIds, election, reserved }: { areaIds: string[]; election: string; reserved: string[] }): ShortLink[] {
  const errors = shortLinkCollisions(areaIds, reserved);
  if (errors.length) throw new Error(`short links: ${errors.join("; ")}`);
  return areaIds.map((id) => ({ source: `/${id}`, destination: `/${election}/${id}`, permanent: false }));
}

export function siteShortLinks(root: string = process.cwd()): ShortLink[] {
  const data = path.join(root, "data");
  const election = listElections(data).at(-1);
  if (!election) throw new Error(`${data}: no elections found`);
  const areaIds = fs
    .readdirSync(path.join(data, "areas"))
    .filter((f) => f.endsWith(".yml"))
    .map((f) => f.replace(/\.yml$/, ""))
    .sort();
  return shortLinkRedirects({ areaIds, election, reserved: reservedSegments(root) });
}
