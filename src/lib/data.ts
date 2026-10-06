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

function ymlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((f) => !f.startsWith(".")).sort();
  const bad = names.find((f) => !f.endsWith(".yml"));
  if (bad) throw new Error(`${path.join(dir, bad)}: unexpected entry (only .yml files allowed)`);
  return names;
}

const stem = (f: string) => f.replace(/\.yml$/, "");

export function loadElection(root: string, election: string): ElectionData {
  const ballotFile = path.join(root, election, "ballot.yml");
  const ballot = readParsed(ballotFile, Ballot);
  if (ballot.election !== election) {
    throw new Error(`${ballotFile}: election '${ballot.election}' does not match directory '${election}'`);
  }
  const guidesDir = path.join(root, "guides");
  const guides: Guide[] = [];
  const seenGuides = new Set<string>();
  for (const f of ymlFiles(guidesDir)) {
    const file = path.join(guidesDir, f);
    const g = readParsed(file, Guide);
    if (g.id !== stem(f)) throw new Error(`${file}: filename does not match guide id '${g.id}'`);
    if (seenGuides.has(g.id)) throw new Error(`${file}: duplicate guide id '${g.id}'`);
    seenGuides.add(g.id);
    guides.push(g);
  }
  const endorsements: Record<string, EndorsementFile> = {};
  const endDir = path.join(root, election, "endorsements");
  for (const f of ymlFiles(endDir)) {
    const file = path.join(endDir, f);
    const e = readParsed(file, EndorsementFile);
    if (e.guide !== stem(f)) {
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
    for (const h of e.held ?? []) {
      if (!contests.has(h.contestId)) errors.push(`${id}: held pick for unknown contest '${h.contestId}'`);
    }
    if (e.status === "published" && Object.keys(e.picks).length === 0) {
      warnings.push(`${id}: published file has no picks`);
    }
    for (const [cid, entry] of Object.entries(e.picks)) {
      const c = contests.get(cid);
      if (!c) {
        errors.push(`${id}: unknown contest '${cid}'`);
        continue;
      }
      const where = `${id}/${cid}`;
      const isNames = Array.isArray(entry.pick);
      if (isNames && c.kind !== "candidate") {
        errors.push(`${where}: expected Y/N for a ${c.kind} contest, got a name list`);
        continue;
      }
      if (!isNames && c.kind === "candidate") {
        errors.push(`${where}: expected a name list for a candidate contest, got '${entry.pick}'`);
        continue;
      }
      if (!Array.isArray(entry.pick)) continue;
      if (entry.ranked && !c.rankedChoice) {
        errors.push(`${where}: ranked pick on a contest without ranked-choice voting`);
      }
      if (entry.rankedCount !== undefined) {
        if (!entry.ranked) errors.push(`${where}: rankedCount set on an unranked pick`);
        else if (entry.rankedCount > entry.pick.length) {
          errors.push(`${where}: rankedCount ${entry.rankedCount} exceeds ${entry.pick.length} name(s)`);
        }
      }
      for (const name of entry.pick) {
        const m = matchName(name, c.candidates);
        if (!m) errors.push(`${where}: '${name}' is not a candidate`);
        else if (m.fuzzy) warnings.push(`${where}: '${name}' matched '${m.name}' — fix spelling`);
      }
      // Single-seat races may carry an unranked dual endorsement; only multi-seat slates are capped.
      if (!entry.ranked && c.seats > 1 && entry.pick.length > c.seats) {
        warnings.push(`${where}: ${entry.pick.length} names exceeds ${c.seats} seat(s)`);
      }
    }
  }
  return { errors, warnings };
}
