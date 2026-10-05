import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import { Ballot, EndorsementFile, Guide } from "./schema";
import { matchName } from "./names";

export type ElectionData = {
  ballot: Ballot;
  guides: Guide[];
  endorsements: Record<string, EndorsementFile>;
};

function readParsed<T>(file: string, schema: z.ZodType<T>): T {
  let raw: unknown;
  try {
    raw = parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}

const ymlFiles = (dir: string) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".yml")).sort() : [];

export function loadElection(root: string, election: string): ElectionData {
  const ballot = readParsed(path.join(root, election, "ballot.yml"), Ballot);
  const guidesDir = path.join(root, "guides");
  const guides = ymlFiles(guidesDir).map((f) => readParsed(path.join(guidesDir, f), Guide));
  const endorsements: Record<string, EndorsementFile> = {};
  const endDir = path.join(root, election, "endorsements");
  for (const f of ymlFiles(endDir)) {
    const file = path.join(endDir, f);
    const e = readParsed(file, EndorsementFile);
    if (e.guide !== f.replace(/\.yml$/, "")) {
      throw new Error(`${file}: filename does not match guide field '${e.guide}'`);
    }
    endorsements[e.guide] = e;
  }
  return { ballot, guides, endorsements };
}

export function listElections(root: string): string[] {
  return fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort();
}

export function validateElection(d: ElectionData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const contests = new Map<string, Ballot["contests"][number]>();

  for (const c of d.ballot.contests) {
    if (contests.has(c.id)) errors.push(`duplicate contest id '${c.id}'`);
    contests.set(c.id, c);
    if (c.jurisdiction.level === "district" && !c.jurisdiction.district?.trim()) {
      errors.push(`${c.id}: district jurisdiction requires a district`);
    }
    const seen = new Set<string>();
    for (const n of c.candidates) {
      if (seen.has(n)) errors.push(`${c.id}: duplicate candidate '${n}'`);
      seen.add(n);
    }
  }

  const guideIds = new Set(d.guides.map((g) => g.id));
  for (const [id, e] of Object.entries(d.endorsements)) {
    if (!guideIds.has(id)) errors.push(`${id}: no guides/${id}.yml`);
    if (e.election !== d.ballot.election) {
      errors.push(`${id}: election '${e.election}' does not match ballot '${d.ballot.election}'`);
    }
    if (e.status === "pending" && Object.keys(e.picks).length > 0) {
      warnings.push(`${id}: pending file has picks`);
    }
    for (const [cid, entry] of Object.entries(e.picks)) {
      const c = contests.get(cid);
      if (!c) {
        errors.push(`${id}: unknown contest '${cid}'`);
        continue;
      }
      const where = `${id}/${cid}`;
      const isNames = Array.isArray(entry.pick);
      if (isNames !== (c.kind === "candidate")) {
        errors.push(`${where}: pick type doesn't match contest kind`);
        continue;
      }
      if (!Array.isArray(entry.pick)) continue;
      for (const name of entry.pick) {
        const m = matchName(name, c.candidates);
        if (!m) errors.push(`${where}: '${name}' is not a candidate`);
        else if (m.fuzzy) warnings.push(`${where}: '${name}' matched '${m.name}' — fix spelling`);
      }
      if (!entry.ranked && entry.pick.length > c.seats) {
        warnings.push(`${where}: ${entry.pick.length} names exceeds ${c.seats} seat(s)`);
      }
    }
  }
  return { errors, warnings };
}
