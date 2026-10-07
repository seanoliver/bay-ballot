import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import { Area, AreaFile, Ballot, CountyBallot, EndorsementFile, Guide, type Contest } from "./schema";
import { areaCounties, areasOf, ballotCounty, inArea, STATE_DISTRICTS } from "./areas";
import { countySlug } from "./counties";
import { matchName } from "./names";
import { isRejected } from "./quote-key";

export type ElectionData = {
  ballot: Ballot;
  guides: Guide[];
  endorsements: Record<string, EndorsementFile>;
  areas: Area[];
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

function loadAreas(root: string): Area[] {
  const dir = path.join(root, "areas");
  const files = ymlFiles(dir);
  if (files.length === 0) throw new Error(`${dir}: no area files`);
  const loaded = files.map((f) => {
    const file = path.join(dir, f);
    const a = readParsed(file, AreaFile);
    if (a.id !== stem(f)) throw new Error(`${file}: filename does not match area id '${a.id}'`);
    return a;
  });
  return loaded.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((a) => Area.parse(a));
}

function loadBallot(root: string, election: string, areas: Area[]): Ballot {
  const ballotFile = path.join(root, election, "ballot.yml");
  const ballot = readParsed(ballotFile, Ballot);
  if (ballot.election !== election) {
    throw new Error(`${ballotFile}: election '${ballot.election}' does not match directory '${election}'`);
  }
  const sourceOf = new Map<string, string>();
  const claim = (c: Contest, file: string) => {
    const prev = sourceOf.get(c.id);
    if (prev) throw new Error(`duplicate contest id '${c.id}' in ${prev} and ${file}`);
    sourceOf.set(c.id, file);
  };
  for (const c of ballot.contests) {
    claim(c, ballotFile);
    const county = ballotCounty(c, areas);
    if (county) throw new Error(`${ballotFile}: ${c.id} is a ${county} contest; move it to ballot/${countySlug(county)}.yml`);
  }
  const shared = new Set(ballot.contests);
  const contests = [...ballot.contests];
  const dir = path.join(root, election, "ballot");
  const counties = areaCounties(areas);
  const slugs = counties.map(countySlug);
  const files = ymlFiles(dir);
  for (const f of files) {
    if (!slugs.includes(stem(f))) throw new Error(`${path.join(dir, f)}: no area is in a county with this slug (known: ${slugs.join(", ")})`);
  }
  for (const county of counties) {
    const f = `${countySlug(county)}.yml`;
    if (!files.includes(f)) continue;
    const file = path.join(dir, f);
    const { placement = {}, contests: mine } = readParsed(file, CountyBallot);
    const placed = new Map<string, Contest[]>();
    const rest: Contest[] = [];
    for (const c of mine) {
      claim(c, file);
      const at = ballotCounty(c, areas);
      if (at !== county) throw new Error(`${file}: ${c.id} is ${at === null ? "a statewide or regional" : at === undefined ? "a no-area" : `a ${at}`} contest, not ${county}`);
      if (placement[c.section]) placed.set(c.section, [...(placed.get(c.section) ?? []), c]);
      else rest.push(c);
    }
    for (const [section, cs] of placed) {
      const after = placement[section];
      const i = contests.findLastIndex((c) => shared.has(c) && c.section === after);
      if (i < 0) throw new Error(`${file}: placement section '${after}' is not in ballot.yml`);
      contests.splice(i + 1, 0, ...cs);
    }
    contests.push(...rest);
  }
  return { ...ballot, contests };
}

export function loadElection(root: string, election: string): ElectionData {
  const areas = loadAreas(root);
  const ballot = loadBallot(root, election, areas);
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
  return { ballot, guides, endorsements, areas };
}

export function listElections(root: string): string[] {
  return fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}$/.test(d)).sort();
}

export function validateElection(d: ElectionData): { errors: string[]; warnings: string[]; info: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const contests = new Map<string, Ballot["contests"][number]>();

  for (const c of d.ballot.contests) {
    if (contests.has(c.id)) errors.push(`duplicate contest id '${c.id}'`);
    contests.set(c.id, c);
    if (c.jurisdiction.level === "district" && !c.jurisdiction.district?.trim()) {
      errors.push(`${c.id}: district jurisdiction requires a district`);
    }
    const j = c.jurisdiction;
    if ((j.level === "district" || j.level === "region") && !j.within) errors.push(`${c.id}: ${j.level} jurisdiction requires within`);
    if (j.level === "district" && !STATE_DISTRICTS.includes(j.name) && (j.within?.length ?? 0) > 1) {
      errors.push(`${c.id}: a local district must be within one place`);
    }
    const seen = new Set<string>();
    for (const n of c.candidates) {
      if (seen.has(n)) errors.push(`${c.id}: duplicate candidate '${n}'`);
      seen.add(n);
    }
  }

  for (const a of d.areas) {
    if (contests.has(a.id)) errors.push(`area '${a.id}' collides with contest '${a.id}': both would be /${d.ballot.election}/${a.id}`);
  }
  for (const c of d.ballot.contests) {
    if (areasOf(c, d.areas).length === 0) errors.push(`${c.id}: in no area (check its jurisdiction and data/areas/)`);
  }
  for (const g of d.guides) {
    const mine = d.areas.filter((a) => g.areas.includes(a.id));
    const byLetter = new Map<string, string[]>();
    for (const c of d.ballot.contests) {
      const letter = c.kind === "measure" && c.jurisdiction.level !== "state" && c.id !== "rtm" ? c.title.match(/(?:Proposition|Measure)\s+(\w+)$/)?.[1] : undefined;
      if (letter && mine.some((a) => inArea(c, a))) byLetter.set(letter, [...(byLetter.get(letter) ?? []), c.id]);
    }
    for (const [letter, ids] of byLetter) {
      if (ids.length > 1) info.push(`${g.id}: measure letter ${letter} is on ${ids.join(" and ")}; a quote under a bare "Measure ${letter}" heading counts for each`);
    }
  }
  const areaIds = new Set(d.areas.map((a) => a.id));
  for (const g of d.guides) {
    for (const a of g.areas) if (!areaIds.has(a)) errors.push(`${g.id}: unknown area '${a}'`);
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
    const guide = d.guides.find((g) => g.id === id);
    for (const h of e.held ?? []) {
      const c = contests.get(h.contestId);
      if (!c) errors.push(`${id}: held pick for unknown contest '${h.contestId}'`);
      else if (guide && !areasOf(c, d.areas).some((a) => guide.areas.includes(a.id))) {
        errors.push(`${id}/${h.contestId}: held pick is outside the guide's areas (${guide.areas.join(", ")})`);
      }
    }
    if (e.status === "published" && Object.keys(e.picks).length === 0) {
      warnings.push(`${id}: published file has no picks`);
    }
    for (const [cid, entry] of Object.entries(e.picks)) {
      for (const q of entry.quotes) if (isRejected(q.text, cid, e.rejectedQuotes ?? [])) errors.push(`${id}/${cid}: quote is in rejectedQuotes: "${q.text}"`);
      const c = contests.get(cid);
      if (!c) {
        errors.push(`${id}: unknown contest '${cid}'`);
        continue;
      }
      const where = `${id}/${cid}`;
      if (guide && !areasOf(c, d.areas).some((a) => guide.areas.includes(a.id))) {
        errors.push(`${where}: contest is outside the guide's areas (${guide.areas.join(", ")})`);
      }
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
      // Not single-seat races: they may carry an unranked dual endorsement.
      if (!entry.ranked && c.seats > 1 && entry.pick.length > c.seats) {
        warnings.push(`${where}: ${entry.pick.length} names exceeds ${c.seats} seat(s)`);
      }
    }
  }
  return { errors, warnings, info };
}
