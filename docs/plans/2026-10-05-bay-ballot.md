# Bay Ballot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Ship bayballot.com: a summary-first, filterable list of every SF voter guide's endorsements for the Nov 3 2026 election, with quoted rationale, live by Fri 2026-10-16.

**Architecture:** Endorsement data lives as YAML in `data/`, validated by Zod schemas. A local CLI (`npm run bb`) fetches each guide's page, asks Claude to extract picks and quotes as structured output, drops any quote not found word-for-word in the page, and writes YAML for human review via `git diff`. A static Next.js (App Router) site reads the YAML at build time; all filtering happens client-side with state in the URL and localStorage.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind, `zod`, `yaml` (v2, YAML 1.2), `@anthropic-ai/sdk` (`claude-sonnet-5-5`), `cheerio`, `tsx`, Vitest, Playwright, Vercel.

**Design doc:** `~/cortex/wiki/side-projects/active/bay-ballot/2026-10-05-bay-ballot-design.md`

**Seed data:** `~/cortex/drafts/sf-nov-2026-guides.md` (6 guides, full ballot, sources) and the "2026 - General" tab of Sean's Voting sheet.

---

## Domain primer (read first)

- A **contest** is one thing on the ballot: a candidate race ("Supervisor, District 8"), a measure ("Prop B"), or a judicial **retention** vote (Yes/No on keeping a judge).
- A **guide** is an organization that publishes endorsements (a newspaper, party, Democratic club, union, advocacy group, or nonpartisan civic group).
- An **endorsement** is one guide's pick in one contest. Guides skip contests all the time; a skipped contest means *no position*: it is never counted and never listed.
- A guide that hasn't published yet for this election has `status: pending`. It is never counted; the UI shows a footnote ("2 guides haven't published yet").
- **Multi-seat races** (Board of Education: vote for 3) take several names. **Ranked picks** (SF uses ranked-choice voting for supervisors) list names in order; only #1 counts toward the headline, marked with `*`.
- **YAML gotcha:** YAML 1.1 parses bare `Y`/`N` as booleans. The `yaml` v2 package defaults to YAML 1.2 where they stay strings. Never switch to `js-yaml` or the 1.1 schema.

## Repo layout (target)

```
data/
  guides/<guide-id>.yml
  2026-11/ballot.yml
  2026-11/endorsements/<guide-id>.yml
  2026-11/sources/*.pdf
src/
  lib/schema.ts        # Zod schemas + types
  lib/data.ts          # load + validate YAML
  lib/names.ts         # candidate-name matching
  lib/score.ts         # tallies
  pipeline/fetch.ts    # page/PDF -> text or document
  pipeline/quotes.ts   # verbatim quote check
  pipeline/extract.ts  # Claude extraction
  pipeline/diff.ts     # change summary
  app/...              # Next.js pages
  components/...       # BallotView, ContestRow, GuidePanel
scripts/
  bb.ts                # CLI entry
  validate.ts          # data validation (CI)
tests/                 # vitest
e2e/                   # playwright
```

---

# Phase 1 — Data and pipeline (target: Sun 2026-10-11)

### Task 1: Scaffold the Next.js app

**Files:** whole repo (currently only `mockups/index.html` and `docs/`)

**Step 1:** Move existing files out of the way so create-next-app accepts the directory.

```bash
cd ~/code/projects/bay-ballot
mkdir -p /tmp/bb-keep && mv mockups docs /tmp/bb-keep/
```

**Step 2:** Scaffold.

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Accept defaults if prompted. Expected: `package.json`, `src/app/page.tsx` exist.

**Step 3:** Restore files and install dependencies.

```bash
mv /tmp/bb-keep/mockups /tmp/bb-keep/docs . && rmdir /tmp/bb-keep
npm i zod yaml @anthropic-ai/sdk cheerio
npm i -D vitest tsx @playwright/test
npx playwright install chromium
```

**Step 4:** Add scripts to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "e2e": "playwright test",
  "validate": "tsx scripts/validate.ts",
  "bb": "tsx scripts/bb.ts"
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

**Step 5:** Verify: `npm run build` succeeds; `npm test` reports "No test files found" (exit code 1 is fine at this point).

**Step 6:** Commit.

```bash
git add -A && git commit -m "chore: scaffold Next.js app with test tooling"
```

---

### Task 2: Schemas

**Files:**
- Create: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { Ballot, EndorsementFile, Guide } from "@/lib/schema";

describe("schemas", () => {
  it("parses a guide", () => {
    const g = Guide.parse(parse(`
id: growsf
name: GrowSF
description: Moderate SF political group focused on housing and public safety
type: advocacy
homepage: https://growsf.org/
previousElectionLink: https://growsf.org/voter-guide/june-2026/
`));
    expect(g.type).toBe("advocacy");
  });

  it("parses a ballot with defaults", () => {
    const b = Ballot.parse(parse(`
election: 2026-11
title: SF General Election
date: 2026-11-03
contests:
  - id: prop-b
    section: Local measures
    title: Prop B — Public Bank
    kind: measure
    jurisdiction: { level: city, name: San Francisco }
`));
    expect(b.contests[0].seats).toBe(1);
    expect(b.contests[0].candidates).toEqual([]);
  });

  it("keeps bare Y/N as strings (YAML 1.2)", () => {
    const e = EndorsementFile.parse(parse(`
guide: growsf
election: 2026-11
status: published
source: https://growsf.org/voter-guide/
fetchedAt: 2026-10-05
hasReasoning: true
picks:
  prop-b: { pick: N, quotes: ["A public bank would cost the city hundreds of millions."] }
  supervisor-d8: { pick: [Gary McCoy, Michael Nguyen], ranked: true }
`));
    expect(e.picks["prop-b"].pick).toBe("N");
    expect(e.picks["supervisor-d8"].ranked).toBe(true);
  });

  it("rejects more than 3 quotes", () => {
    expect(() => EndorsementFile.parse({
      guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05",
      hasReasoning: true, picks: { a: { pick: "Y", quotes: ["1", "2", "3", "4"] } },
    })).toThrow();
  });
});
```

**Step 2:** Run `npm test` → FAIL: cannot find module `@/lib/schema`.

**Step 3: Implement**

```ts
// src/lib/schema.ts
import { z } from "zod";

export const GuideType = z.enum(["newspaper", "party", "club", "union", "advocacy", "civic"]);
export type GuideType = z.infer<typeof GuideType>;

export const Guide = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  type: GuideType,
  homepage: z.string().url(),
  previousElectionLink: z.string().url().optional(),
  lean: z.number().min(0).max(100).optional(), // reserved for Trust/Avoid fast-follow
});
export type Guide = z.infer<typeof Guide>;

export const Jurisdiction = z.object({
  level: z.enum(["state", "county", "city", "district"]),
  name: z.string(), // e.g. "California", "San Francisco", "Supervisor", "Assembly"
  district: z.string().optional(), // e.g. "8"
});

export const Contest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  section: z.string(),
  title: z.string(),
  kind: z.enum(["candidate", "measure", "retention"]),
  description: z.string().optional(),
  link: z.string().url().optional(),
  candidates: z.array(z.string()).default([]),
  seats: z.number().int().positive().default(1),
  jurisdiction: Jurisdiction,
});
export type Contest = z.infer<typeof Contest>;

export const Ballot = z.object({
  election: z.string().regex(/^\d{4}-\d{2}$/),
  title: z.string(),
  date: z.coerce.string(),
  contests: z.array(Contest),
});
export type Ballot = z.infer<typeof Ballot>;

export const Entry = z.object({
  pick: z.union([z.enum(["Y", "N"]), z.array(z.string()).min(1)]),
  ranked: z.boolean().default(false),
  quotes: z.array(z.string()).max(3).default([]),
});
export type Entry = z.infer<typeof Entry>;

export const EndorsementFile = z.object({
  guide: z.string(),
  election: z.coerce.string(),
  status: z.enum(["published", "pending"]),
  source: z.string().url().optional(),
  fetchedAt: z.coerce.string(),
  hasReasoning: z.boolean(),
  picks: z.record(z.string(), Entry).default({}),
});
export type EndorsementFile = z.infer<typeof EndorsementFile>;
```

Note: `yaml` parses `2026-11` as a string and `2026-10-05` as a string under the 1.2 core schema; `z.coerce.string()` guards against either.

**Step 4:** `npm test` → PASS (4 tests).

**Step 5:** `git add -A && git commit -m "feat: data schemas"`

---

### Task 3: Candidate-name matching

**Files:**
- Create: `src/lib/names.ts`
- Test: `tests/names.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { matchName } from "@/lib/names";

const cands = ["Joaquín Torres", "Shirley N. Weber", "Malia M. Cohen"];

describe("matchName", () => {
  it("exact match", () => expect(matchName("Joaquín Torres", cands)).toEqual({ name: "Joaquín Torres", fuzzy: false }));
  it("accent-insensitive match is flagged", () => expect(matchName("Joaquin Torres", cands)).toEqual({ name: "Joaquín Torres", fuzzy: true }));
  it("middle initial dropped is flagged", () => expect(matchName("Shirley Weber", cands)).toEqual({ name: "Shirley N. Weber", fuzzy: true }));
  it("unknown name returns null", () => expect(matchName("Jane Doe", cands)).toBeNull());
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/lib/names.ts
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/\b[a-z]\.\s*/g, "") // drop middle initials like "N."
    .replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export function matchName(input: string, candidates: string[]): { name: string; fuzzy: boolean } | null {
  if (candidates.includes(input)) return { name: input, fuzzy: false };
  const hit = candidates.find((c) => fold(c) === fold(input));
  return hit ? { name: hit, fuzzy: true } : null;
}
```

**Step 4:** Run → PASS.

**Step 5:** `git add -A && git commit -m "feat: candidate name matching"`

---

### Task 4: Scoring

**Files:**
- Create: `src/lib/score.ts`
- Test: `tests/score.test.ts`

**Rules (from the design):**
- Inputs are already filtered to: published guides, toggled on, with an entry for this contest.
- Measure / retention: count Y and N. Verdict = the larger side; equal = `split`. `pct = round(100 * larger / total)`.
- Single-seat candidate: each guide contributes `names[0]` if `ranked`, otherwise every name (a dual endorsement counts for both). `total` = number of guides.
- Multi-seat (`seats > 1`): every listed name counts.
- Leader = highest count; tie for first = `split`. `leaderRanked` = true if any guide's count for the leader came from a ranked #1.

**Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { tally } from "@/lib/score";
import type { Contest, Entry } from "@/lib/schema";

const measure = { id: "prop-b", kind: "measure", seats: 1, candidates: [] } as unknown as Contest;
const race = { id: "sup-d8", kind: "candidate", seats: 1, candidates: ["A", "B", "C"] } as unknown as Contest;
const board = { id: "boe", kind: "candidate", seats: 3, candidates: ["A", "B", "C", "D"] } as unknown as Contest;
const e = (pick: Entry["pick"], ranked = false): Entry => ({ pick, ranked, quotes: [] });

describe("tally", () => {
  it("measure majority", () => {
    expect(tally(measure, [e("Y"), e("Y"), e("N")])).toMatchObject({ kind: "measure", yes: 2, no: 1, total: 3, verdict: "Y", pct: 67 });
  });
  it("measure tie is split", () => {
    expect(tally(measure, [e("Y"), e("N")])).toMatchObject({ verdict: "split" });
  });
  it("empty input", () => {
    expect(tally(measure, [])).toMatchObject({ total: 0, verdict: "none" });
  });
  it("single seat leader", () => {
    expect(tally(race, [e(["A"]), e(["A"]), e(["B"])])).toMatchObject({ kind: "candidate", leader: "A", count: 2, total: 3, pct: 67, split: false, leaderRanked: false });
  });
  it("ranked pick counts #1 only and flags leaderRanked", () => {
    const t = tally(race, [e(["B", "C"], true), e(["B"]), e(["A"])]);
    expect(t).toMatchObject({ leader: "B", count: 2, total: 3, leaderRanked: true });
    expect(t.kind === "candidate" && t.counts.find((c) => c.name === "C")).toBeFalsy();
  });
  it("dual endorsement counts both names", () => {
    const t = tally(race, [e(["A", "B"]), e(["A"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2 });
    expect(t.kind === "candidate" && t.counts.find((c) => c.name === "B")?.count).toBe(1);
  });
  it("candidate tie is split", () => {
    expect(tally(race, [e(["A"]), e(["B"])])).toMatchObject({ split: true });
  });
  it("multi-seat counts every name", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "D"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2, pct: 100 });
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/lib/score.ts
import type { Contest, Entry } from "./schema";

export type MeasureTally = { kind: "measure"; yes: number; no: number; total: number; verdict: "Y" | "N" | "split" | "none"; pct: number };
export type CandidateCount = { name: string; count: number; fromRanked: boolean };
export type CandidateTally = { kind: "candidate"; total: number; counts: CandidateCount[]; leader: string | null; count: number; pct: number; split: boolean; leaderRanked: boolean };
export type Tally = MeasureTally | CandidateTally;

export function tally(contest: Contest, entries: Entry[]): Tally {
  const total = entries.length;
  if (contest.kind !== "candidate") {
    const yes = entries.filter((e) => e.pick === "Y").length;
    const no = entries.filter((e) => e.pick === "N").length;
    const verdict = total === 0 ? "none" : yes === no ? "split" : yes > no ? "Y" : "N";
    return { kind: "measure", yes, no, total, verdict, pct: total ? Math.round((100 * Math.max(yes, no)) / total) : 0 };
  }
  const map = new Map<string, CandidateCount>();
  for (const e of entries) {
    if (!Array.isArray(e.pick)) continue;
    const names = e.ranked && contest.seats === 1 ? [e.pick[0]] : e.pick;
    for (const name of names) {
      const c = map.get(name) ?? { name, count: 0, fromRanked: false };
      c.count += 1;
      if (e.ranked) c.fromRanked = true;
      map.set(name, c);
    }
  }
  const counts = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const top = counts[0];
  const split = counts.length > 1 && counts[1].count === top.count;
  return {
    kind: "candidate", total, counts,
    leader: top ? top.name : null,
    count: top?.count ?? 0,
    pct: total && top ? Math.round((100 * top.count) / total) : 0,
    split,
    leaderRanked: !!top?.fromRanked,
  };
}
```

**Step 4:** Run → PASS (8 tests).

**Step 5:** `git add -A && git commit -m "feat: endorsement tallies"`

---

### Task 5: Data loader and validator

**Files:**
- Create: `src/lib/data.ts`, `scripts/validate.ts`
- Test: `tests/data.test.ts`, fixtures in `tests/fixtures/data/`

**Step 1:** Create fixtures:

`tests/fixtures/data/guides/growsf.yml`
```yaml
id: growsf
name: GrowSF
description: Moderate SF political group
type: advocacy
homepage: https://growsf.org/
```

`tests/fixtures/data/2026-11/ballot.yml`
```yaml
election: 2026-11
title: Test
date: 2026-11-03
contests:
  - id: prop-b
    section: Local measures
    title: Prop B
    kind: measure
    jurisdiction: { level: city, name: San Francisco }
  - id: assessor
    section: Local candidates
    title: Assessor-Recorder
    kind: candidate
    candidates: [Joaquín Torres]
    jurisdiction: { level: city, name: San Francisco }
```

`tests/fixtures/data/2026-11/endorsements/growsf.yml`
```yaml
guide: growsf
election: 2026-11
status: published
fetchedAt: 2026-10-05
hasReasoning: true
picks:
  prop-b: { pick: N }
  assessor: { pick: [Joaquin Torres] }
  prop-z: { pick: Y }
```

**Step 2: Failing test**

```ts
import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadElection, validateElection } from "@/lib/data";

const root = path.join(process.cwd(), "tests/fixtures/data");

describe("data", () => {
  it("loads an election", () => {
    const d = loadElection(root, "2026-11");
    expect(d.ballot.contests).toHaveLength(2);
    expect(d.guides.map((g) => g.id)).toEqual(["growsf"]);
    expect(d.endorsements.growsf.status).toBe("published");
  });
  it("reports unknown contests as errors and fuzzy names as warnings", () => {
    const r = validateElection(loadElection(root, "2026-11"));
    expect(r.errors).toEqual(["growsf: unknown contest 'prop-z'"]);
    expect(r.warnings).toEqual(["growsf/assessor: 'Joaquin Torres' matched 'Joaquín Torres' — fix spelling"]);
  });
});
```

**Step 3:** Run → FAIL.

**Step 4: Implement**

```ts
// src/lib/data.ts
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { Ballot, EndorsementFile, Guide } from "./schema";
import { matchName } from "./names";

const readYaml = (p: string) => parse(fs.readFileSync(p, "utf8"));
const ymlFiles = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".yml")).sort() : []);

export type ElectionData = {
  ballot: Ballot;
  guides: Guide[];
  endorsements: Record<string, EndorsementFile>;
};

export function loadElection(root: string, election: string): ElectionData {
  const ballot = Ballot.parse(readYaml(path.join(root, election, "ballot.yml")));
  const guides = ymlFiles(path.join(root, "guides")).map((f) => Guide.parse(readYaml(path.join(root, "guides", f))));
  const endorsements: Record<string, EndorsementFile> = {};
  const dir = path.join(root, election, "endorsements");
  for (const f of ymlFiles(dir)) {
    const e = EndorsementFile.parse(readYaml(path.join(dir, f)));
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
  const contests = new Map(d.ballot.contests.map((c) => [c.id, c]));
  const guideIds = new Set(d.guides.map((g) => g.id));
  for (const [id, e] of Object.entries(d.endorsements)) {
    if (!guideIds.has(id)) errors.push(`${id}: no guides/${id}.yml`);
    for (const [cid, entry] of Object.entries(e.picks)) {
      const c = contests.get(cid);
      if (!c) { errors.push(`${id}: unknown contest '${cid}'`); continue; }
      const isMeasure = c.kind !== "candidate";
      if (isMeasure !== !Array.isArray(entry.pick)) { errors.push(`${id}/${cid}: pick type doesn't match contest kind`); continue; }
      if (Array.isArray(entry.pick)) {
        for (const name of entry.pick) {
          const m = matchName(name, c.candidates);
          if (!m) errors.push(`${id}/${cid}: '${name}' is not a candidate`);
          else if (m.fuzzy) warnings.push(`${id}/${cid}: '${name}' matched '${m.name}' — fix spelling`);
        }
      }
    }
  }
  return { errors, warnings };
}
```

```ts
// scripts/validate.ts
import path from "node:path";
import { listElections, loadElection, validateElection } from "../src/lib/data";

const root = path.join(process.cwd(), "data");
let failed = false;
for (const election of listElections(root)) {
  const { errors, warnings } = validateElection(loadElection(root, election));
  warnings.forEach((w) => console.warn(`WARN  ${election} ${w}`));
  errors.forEach((e) => console.error(`ERROR ${election} ${e}`));
  if (errors.length || warnings.length) failed = true;
}
if (failed) process.exit(1);
console.log("data OK");
```

Warnings fail CI on purpose: a misspelled name should be fixed in the YAML, not shipped.

**Step 5:** `npm test` → PASS. **Step 6:** `git add -A && git commit -m "feat: data loader and validator"`

---

### Task 6: SF ballot and seed data

**Files:**
- Create: `data/2026-11/ballot.yml`, `data/2026-11/sources/` (download the two PDFs)
- Create: `data/guides/{growsf,sf-chronicle,league-pissed-off-voters,sf-dems,spur,lwv-sf}.yml`
- Create: `data/2026-11/endorsements/<same ids>.yml`

**Step 1:** Download sources.

```bash
mkdir -p data/2026-11/sources
curl -L -o data/2026-11/sources/SF-Voter-Pamphlet-Nov2026.pdf https://media.api.sf.gov/documents/N26_EN_VIP.pdf
```
Also save the CA SoS certified candidate list (`https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf`).

**Step 2:** Write `ballot.yml` covering every contest in `~/cortex/drafts/sf-nov-2026-guides.md`. Rules:
- IDs: `us-rep-11`, `us-rep-15`, `governor`, `lt-governor`, `secretary-of-state`, `controller`, `treasurer`, `attorney-general`, `insurance-commissioner`, `board-of-equalization-2`, `superintendent`, `assembly-17`, `assembly-19`, `supreme-court-groban`, `supreme-court-evans`, `court-of-appeal-1`, `supervisor-2/4/6/8/10`, `board-of-education`, `college-board`, `college-board-partial`, `bart-8`, `assessor`, `public-defender`, `prop-1` … `prop-45`, `rtm`, `prop-a` … `prop-j`.
- Candidate names exactly as in the SoS certified list / SF candidate list.
- Measures: `description` = the official one-line title, `link` = `https://voterguide.sos.ca.gov/propositions/<n>/` for state props, the sf.gov measure page for local ones.
- Jurisdiction: statewide → `{level: state, name: California}`; CA-11/15 and AD-17/19 → `{level: district, name: Congress|Assembly, district: "11"}`; supervisors → `{level: district, name: Supervisor, district: "8"}`; BART D8 → `{level: district, name: BART, district: "8"}`; citywide → `{level: city, name: San Francisco}`; RTM → `{level: county, name: Bay Area region}`.
- Multi-seat: `board-of-education` and `college-board` get `seats: 3`.
- Court of Appeal: one `retention` contest for the 11 justices, title "1st District Court of Appeal (11 justices)".

**Step 3:** Write the 6 guide files (description, type, homepage, `previousElectionLink` = their June 2026 page).

**Step 4:** Hand-enter the 6 endorsement files from the drafts table. These are the **golden fixtures** Task 10 compares extraction against. `status: pending` for any guide with no page; Chronicle `TBD` contests are simply omitted.

**Step 5:** `npm run validate` → `data OK`. Fix every warning by correcting the YAML.

**Step 6:** `git add -A && git commit -m "data: SF Nov 2026 ballot and 6 seed guides"`

---

### Task 7: Guide registry (all ~38 + discovery of more)

**Files:** `data/guides/*.yml`

**Step 1:** Create a guide file for each organization below (the list sfendorsements.com tracks, which are public organization names). For each: description (one neutral sentence, written by us), type, homepage, `previousElectionLink`.

Chronicle, Examiner, SF Dems, SF Bay Guardian, Pissed Off Voters, Abundance Network, YIMBY Action, Green Party, SF Berniecrats, SF Tenants Union, SF Rising Action, Sierra Club, Housing Action Coalition, SF Labor Council, SEIU 1021, United Educators of SF, SF League of Conservation Voters, SF Women's Political Committee, Blueprint SF, SPUR, LWV SF, SF Bicycle Coalition, SF Republican Party, District 11 Dem Club, Potrero Hill Dem Club, Harvey Milk LGBTQ Dem Club, United Democratic Club, Edwin M. Lee Asian Pacific Dem Club, Alice B. Toklas LGBTQ Dem Club, Bernal Heights Dem Club, Chinese American Dem Club, Eastern Neighborhoods Dem Club, Noe Valley Dem Club, Westside Family Dem Club, SF Young Democrats, Home Sharers Dem Club, SF Young Republicans, GrowSF.

**Step 2:** Search for more (web search: "San Francisco November 2026 endorsements", "slate card San Francisco 2026", neighborhood and identity-based clubs, Bay Area Reporter, Mission Local, SF Standard). Add any organization that publishes an SF slate. Record what was searched in the commit message.

**Step 3:** `npm run validate` → `data OK`. **Step 4:** `git add -A && git commit -m "data: guide registry (N guides)"`

---

### Task 8: Page fetcher

**Files:**
- Create: `src/pipeline/fetch.ts`
- Test: `tests/fetch.test.ts`

**Step 1: Failing test** (pure function only; network is not unit-tested)

```ts
import { describe, expect, it } from "vitest";
import { htmlToText } from "@/pipeline/fetch";

describe("htmlToText", () => {
  it("drops scripts, styles and nav, keeps body text", () => {
    const html = `<html><head><style>.x{}</style></head><body><nav>Menu</nav>
      <h2>Prop B</h2><p>Vote <b>No</b>. A public bank is risky.</p><script>alert(1)</script></body></html>`;
    expect(htmlToText(html)).toBe("Prop B\nVote No. A public bank is risky.");
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/pipeline/fetch.ts
import * as cheerio from "cheerio";

export type Fetched = { kind: "text"; text: string } | { kind: "pdf"; base64: string; text: string };

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, svg, iframe").remove();
  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article").each((_, el) => { $(el).append("\n"); });
  return $("body").text().split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

const UA = "Mozilla/5.0 (compatible; BayBallotBot/0.1; +https://bayballot.com)";

export async function fetchSource(url: string, opts: { browser?: boolean } = {}): Promise<Fetched> {
  if (opts.browser) {
    const { chromium } = await import("@playwright/test");
    const b = await chromium.launch();
    try {
      const page = await b.newPage({ userAgent: UA });
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      return { kind: "text", text: htmlToText(await page.content()) };
    } finally { await b.close(); }
  }
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { kind: "pdf", base64: buf.toString("base64"), text: "" }; // text filled after extraction, see Task 10
  }
  return { kind: "text", text: htmlToText(await res.text()) };
}
```

**Step 4:** Run → PASS. If the expected string differs only in whitespace, fix the implementation, not the test.

**Step 5:** `git add -A && git commit -m "feat: source fetcher"`

---

### Task 9: Verbatim quote check

**Files:**
- Create: `src/pipeline/quotes.ts`
- Test: `tests/quotes.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { verifyQuotes } from "@/pipeline/quotes";

const page = "Prop B — We oppose it. “A public bank would cost the city hundreds of millions,” and the risks are real.";

describe("verifyQuotes", () => {
  it("keeps quotes found verbatim, ignoring curly quotes, dashes and whitespace", () => {
    expect(verifyQuotes(["A public bank would cost the city hundreds of millions"], page).kept).toHaveLength(1);
  });
  it("drops paraphrases", () => {
    const r = verifyQuotes(["A public bank costs hundreds of millions"], page);
    expect(r.kept).toEqual([]);
    expect(r.dropped).toHaveLength(1);
  });
  it("drops fragments under 20 characters", () => {
    expect(verifyQuotes(["We oppose it."], page).kept).toEqual([]);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/pipeline/quotes.ts
const norm = (s: string) =>
  s.normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function verifyQuotes(quotes: string[], pageText: string): { kept: string[]; dropped: string[] } {
  const hay = norm(pageText);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const q of quotes) {
    const n = norm(q).replace(/^["']|["']$/g, "");
    (n.length >= 20 && hay.includes(n) ? kept : dropped).push(q);
  }
  return { kept, dropped };
}
```

**Step 4:** Run → PASS. **Step 5:** `git add -A && git commit -m "feat: verbatim quote verification"`

---

### Task 10: Claude extraction

**Files:**
- Create: `src/pipeline/extract.ts`
- Test: `tests/extract.test.ts` (pure mapping only)

**API facts (verified against the claude-api skill, 2026-10-05):**
- `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })`, read `response.parsed_output` (null if parsing failed).
- Model `claude-sonnet-5-5`. Do **not** pass `budget_tokens` or `thinking: {type: "disabled"}` (both 400). Leave thinking at its default.
- Put the ballot in the `system` block with `cache_control: { type: "ephemeral" }` so the ~38 guide calls reuse it. Check `usage.cache_read_input_tokens > 0` on the second call.
- Always check `stop_reason`: `refusal` or `max_tokens` → throw; the guide gets hand-entered.
- PDF input: `{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }` placed before the text block.

**Step 1: Failing test** for `toEntries`, which turns model output into validated YAML entries.

```ts
import { describe, expect, it } from "vitest";
import { toEntries } from "@/pipeline/extract";
import type { Contest } from "@/lib/schema";

const contests = [
  { id: "prop-b", kind: "measure", candidates: [], seats: 1 },
  { id: "assessor", kind: "candidate", candidates: ["Joaquín Torres"], seats: 1 },
] as unknown as Contest[];
const page = "On Prop B we say no. A public bank would cost the city hundreds of millions of dollars. Assessor: Joaquin Torres.";

describe("toEntries", () => {
  it("maps picks, normalizes names, keeps only verbatim quotes, drops unknown contests", () => {
    const r = toEntries({
      hasReasoning: true,
      picks: [
        { contestId: "prop-b", vote: "N", candidates: [], ranked: false, quotes: ["A public bank would cost the city hundreds of millions of dollars", "Banks are bad and expensive overall"] },
        { contestId: "assessor", vote: null, candidates: ["Joaquin Torres"], ranked: false, quotes: [] },
        { contestId: "prop-zz", vote: "Y", candidates: [], ranked: false, quotes: [] },
      ],
    }, contests, page);
    expect(r.picks["prop-b"]).toEqual({ pick: "N", ranked: false, quotes: ["A public bank would cost the city hundreds of millions of dollars"] });
    expect(r.picks["assessor"].pick).toEqual(["Joaquín Torres"]);
    expect(r.notes).toContain("dropped unverified quote on prop-b");
    expect(r.notes).toContain("unknown contest prop-zz");
    expect(r.notes).toContain("assessor: 'Joaquin Torres' -> 'Joaquín Torres'");
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/pipeline/extract.ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Ballot, Contest, Entry } from "@/lib/schema";
import { matchName } from "@/lib/names";
import { verifyQuotes } from "./quotes";
import type { Fetched } from "./fetch";

export const ExtractOutput = z.object({
  hasReasoning: z.boolean().describe("true if the guide explains its picks anywhere, false if it only lists them"),
  picks: z.array(z.object({
    contestId: z.string(),
    vote: z.enum(["Y", "N"]).nullable().describe("for measures and retention votes; null for candidate races"),
    candidates: z.array(z.string()).describe("endorsed candidate names, in rank order if ranked; empty for measures"),
    ranked: z.boolean(),
    quotes: z.array(z.string()).describe("up to 3 sentences copied EXACTLY from the page that explain this pick; empty if none"),
  })),
});
export type ExtractOutput = z.infer<typeof ExtractOutput>;

const MODEL = "claude-sonnet-5-5";

export function systemPrompt(ballot: Ballot): string {
  const contests = ballot.contests.map((c) => ({ id: c.id, title: c.title, kind: c.kind, candidates: c.candidates, seats: c.seats }));
  return [
    `You extract voter-guide endorsements for the ${ballot.title} (${ballot.date}).`,
    "The user message is one organization's endorsement page. Return one entry per contest the organization takes a position on. Skip contests it does not mention or says it has no position on.",
    "Use contestId values from the ballot below exactly. Use candidate names exactly as written in the ballot.",
    "For ranked endorsements (\"#1 X, #2 Y\"), set ranked true and list candidates in rank order. For dual endorsements without ranking, list both with ranked false.",
    "Quotes must be copied character-for-character from the page. Never paraphrase, summarize or combine sentences. If the page gives no reasons for a pick, return an empty quotes array.",
    "",
    "BALLOT:",
    JSON.stringify(contests, null, 1),
  ].join("\n");
}

export function toEntries(out: ExtractOutput, contests: Contest[], pageText: string) {
  const byId = new Map(contests.map((c) => [c.id, c]));
  const picks: Record<string, Entry> = {};
  const notes: string[] = [];
  for (const p of out.picks) {
    const c = byId.get(p.contestId);
    if (!c) { notes.push(`unknown contest ${p.contestId}`); continue; }
    const { kept, dropped } = verifyQuotes(p.quotes.slice(0, 3), pageText);
    dropped.forEach(() => notes.push(`dropped unverified quote on ${c.id}`));
    if (c.kind === "candidate") {
      const names: string[] = [];
      for (const raw of p.candidates) {
        const m = matchName(raw, c.candidates);
        if (!m) { notes.push(`${c.id}: unknown candidate '${raw}'`); continue; }
        if (m.fuzzy) notes.push(`${c.id}: '${raw}' -> '${m.name}'`);
        names.push(m.name);
      }
      if (names.length) picks[c.id] = { pick: names, ranked: p.ranked, quotes: kept };
    } else if (p.vote) {
      picks[c.id] = { pick: p.vote, ranked: false, quotes: kept };
    }
  }
  return { picks, notes };
}

export async function extract(client: Anthropic, ballot: Ballot, src: Fetched) {
  const content: Anthropic.ContentBlockParam[] = src.kind === "pdf"
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: src.base64 } },
       { type: "text", text: "Extract this organization's endorsements." }]
    : [{ type: "text", text: src.text }];

  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: systemPrompt(ballot), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ExtractOutput) },
  });
  if (res.stop_reason === "refusal") throw new Error(`refused: ${res.stop_details?.category ?? "unknown"}`);
  if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens; split the page or raise the limit");
  if (!res.parsed_output) throw new Error("model output did not match the schema");
  return { output: res.parsed_output, usage: res.usage };
}
```

PDFs: quote verification needs page text. For PDF sources, run `pdftotext` (poppler, `brew install poppler`) on the downloaded file and pass that text to `toEntries`; if unavailable, all PDF quotes are dropped (safe default). Note this in the CLI output.

If `tsc` reports a type error on `messages.parse` or a content-block type, fix the type name from the compiler message; don't guess from memory.

**Step 4:** `npm test` → PASS. **Step 5:** `git add -A && git commit -m "feat: Claude extraction with verified quotes"`

---

### Task 11: CLI (`npm run bb`)

**Files:**
- Create: `src/pipeline/diff.ts`, `scripts/bb.ts`
- Test: `tests/diff.test.ts`

**Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { diffPicks } from "@/pipeline/diff";

describe("diffPicks", () => {
  it("lists added, changed and removed picks", () => {
    const before = { "prop-a": { pick: "Y", ranked: false, quotes: [] }, "prop-b": { pick: "N", ranked: false, quotes: [] } } as const;
    const after = { "prop-a": { pick: "N", ranked: false, quotes: [] }, "prop-c": { pick: "Y", ranked: false, quotes: [] } } as const;
    expect(diffPicks(before as never, after as never)).toEqual(["~ prop-a: Y -> N", "+ prop-c: Y", "- prop-b: N"]);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/pipeline/diff.ts
import type { Entry } from "@/lib/schema";
const show = (e: Entry) => (Array.isArray(e.pick) ? e.pick.join(" / ") + (e.ranked ? " (ranked)" : "") : e.pick);

export function diffPicks(before: Record<string, Entry>, after: Record<string, Entry>): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(after)) {
    const b = before[id];
    if (!b) out.push(`+ ${id}: ${show(e)}`);
    else if (show(b) !== show(e)) out.push(`~ ${id}: ${show(b)} -> ${show(e)}`);
  }
  for (const [id, e] of Object.entries(before)) if (!after[id]) out.push(`- ${id}: ${show(e)}`);
  return out;
}
```

```ts
// scripts/bb.ts
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { stringify } from "yaml";
import { loadElection } from "../src/lib/data";
import { fetchSource } from "../src/pipeline/fetch";
import { extract, toEntries } from "../src/pipeline/extract";
import { diffPicks } from "../src/pipeline/diff";
import type { EndorsementFile } from "../src/lib/schema";

const ROOT = path.join(process.cwd(), "data");
const ELECTION = process.env.BB_ELECTION ?? "2026-11";
const [cmd, ...args] = process.argv.slice(2);
const flag = (f: string) => args.includes(f);

async function extractOne(client: Anthropic, guideId: string) {
  const data = loadElection(ROOT, ELECTION);
  const file = path.join(ROOT, ELECTION, "endorsements", `${guideId}.yml`);
  const prev = data.endorsements[guideId];
  if (!prev?.source) { console.log(`${guideId}: no source URL yet — run 'discover' or set 'source' by hand`); return; }
  const src = await fetchSource(prev.source, { browser: flag("--browser") });
  let pageText = src.text;
  if (src.kind === "pdf") {
    const tmp = path.join("/tmp", `${guideId}.pdf`);
    fs.writeFileSync(tmp, Buffer.from(src.base64, "base64"));
    try { pageText = execFileSync("pdftotext", ["-layout", tmp, "-"]).toString(); }
    catch { console.warn(`${guideId}: pdftotext missing; all quotes will be dropped`); }
  }
  const { output, usage } = await extract(client, data.ballot, src);
  const { picks, notes } = toEntries(output, data.ballot.contests, pageText);
  const next: EndorsementFile = {
    ...prev, status: Object.keys(picks).length ? "published" : "pending",
    fetchedAt: new Date().toISOString().slice(0, 10), hasReasoning: output.hasReasoning, picks,
  };
  fs.writeFileSync(file, stringify(next, { lineWidth: 0 }));
  console.log(`\n${guideId}  (cache read ${usage.cache_read_input_tokens ?? 0} tok)`);
  diffPicks(prev.picks, picks).forEach((l) => console.log("  " + l));
  notes.forEach((n) => console.log("  ! " + n));
}

async function main() {
  const client = new Anthropic();
  if (cmd === "extract") {
    const data = loadElection(ROOT, ELECTION);
    const ids = flag("--all") ? Object.keys(data.endorsements) : args.filter((a) => !a.startsWith("--"));
    for (const id of ids) {
      try { await extractOne(client, id); } catch (e) { console.error(`${id}: FAILED — ${(e as Error).message}`); }
    }
    console.log("\nReview with: git diff data/");
  } else if (cmd === "discover") {
    const data = loadElection(ROOT, ELECTION);
    for (const g of data.guides) {
      const e = data.endorsements[g.id];
      if (e?.source) continue;
      console.log(`${g.id}: no ${ELECTION} source. Start from ${g.previousElectionLink ?? g.homepage}`);
      if (!e) {
        const stub: EndorsementFile = { guide: g.id, election: ELECTION, status: "pending", fetchedAt: new Date().toISOString().slice(0, 10), hasReasoning: false, picks: {} };
        fs.writeFileSync(path.join(ROOT, ELECTION, "endorsements", `${g.id}.yml`), stringify(stub));
      }
    }
  } else {
    console.log("usage: npm run bb -- extract <guide...> | --all [--browser]\n       npm run bb -- discover");
  }
}
main();
```

`discover` v1 lists guides missing a source URL and creates `pending` stubs; finding each URL is done by Claude Code (web search) or by hand, and written into `source:`. Automating the search is a later improvement.

**Added 2026-10-05 (from Task 6 findings):**
- **Multi-page guides.** SPUR puts its reasoning on one page per measure, linked from the summary page. Add an optional `extraSources: [url]` to `EndorsementFile` (schema + test first). `extract` fetches the main source plus each extra source and concatenates their text (separated by `\n\n--- <url> ---\n\n`) for both the model input and quote verification. Each quote keeps its own link: add optional `quoteSources: string[]` parallel to `quotes` in `Entry`, set from whichever fetched page contained the quote. Test `toEntries` with two pages.
- **Multi-page guides, schema status.** `extraSources` already exists in `EndorsementFile` (added in Task 7, commit f221e83). Only `quoteSources` remains to add.
- **Image-only positions.** LWV California shows Support/Oppose as icons, so text extraction can't read them. Mark such guides `manual: true` in the endorsement file (schema + test first); `extract --all` skips them and prints "skipped (manual)".
- **Browser fetch hint.** `fetchWith: browser` (already in the schema) makes `extract` use the Playwright path for that guide without the `--browser` flag (Sierra Club, SF Labor Council).
- **Only this election.** Several pages also list earlier elections (CADC lists Mar/Apr 2026; Milk Club lists June 2026 and Nov 2024). Add to the system prompt: "The page may list endorsements for several elections. Extract only endorsements for the <title> on <date>; ignore every other election." Add a `toEntries`-independent unit test for `systemPrompt` that asserts this sentence is present with the right date.
- **Archive snapshots.** Generic URLs get overwritten after Nov 3. After a successful extract, request `https://web.archive.org/save/<source>` (and each extra source) and store the returned snapshot URL as `archived:` in the endorsement file (optional `HttpUrl`, schema + test first). Failure to archive is a warning, not an error. The site links to `archived` when present, else `source`.

**Step 4:** `npm test` → PASS.

**Step 5: Live check against a golden fixture.** Copy `data/2026-11/endorsements/growsf.yml` to `/tmp/growsf.golden.yml`, then:

```bash
npm run bb -- extract growsf
diff <(npx tsx -e "import {parse} from 'yaml';import fs from 'fs';console.log(JSON.stringify(Object.fromEntries(Object.entries(parse(fs.readFileSync('/tmp/growsf.golden.yml','utf8')).picks).map(([k,v]:any)=>[k,v.pick])),null,1))") \
     <(npx tsx -e "import {parse} from 'yaml';import fs from 'fs';console.log(JSON.stringify(Object.fromEntries(Object.entries(parse(fs.readFileSync('data/2026-11/endorsements/growsf.yml','utf8')).picks).map(([k,v]:any)=>[k,v.pick])),null,1))")
```
Expected: no differences in picks (quotes will be new). Repeat for `spur` and `league-pissed-off-voters`. Any mismatch: decide whether the golden fixture or the extraction is wrong by reading the page; fix the prompt if extraction is wrong.

**Step 6:** `git add -A && git commit -m "feat: bb CLI (extract, discover)"`

---

### Task 12: Extract every guide (with Sean)

**Step 1:** `npm run bb -- discover`. For each guide listed, find its Nov 2026 page and set `source:` in its endorsement file. Also check, by hand or browser, guides the Task 7 search couldn't reach: Bay Area Reporter and SF Bay View (both behind Cloudflare). Check the SF Democratic Party's other chartered clubs (sfdems.org/clubs) for Nov 2026 slates: Brownie Mary, District 2, District 3, Fénix, Filipino American, Harriet Tubman, Portola, Raoul Wallenberg, Richmond District, SF Working Families, South Beach D6. Add a guide file plus a stub for each one that publishes a slate.

**Step 2:** `npm run bb -- extract --all`. Re-run failures with `--browser`. Guides that publish only images or social posts: hand-enter.

**Step 3:** `npm run validate` until `data OK`.

**Step 4:** **Sean reviews `git diff data/`** and commits. Do not commit extraction output without his review.

---

# Phase 2 — Site (target: Fri 2026-10-16)

### Task 13: Ballot state helpers

**Files:**
- Create: `src/lib/filters.ts`
- Test: `tests/filters.test.ts`

Filter state, serialized to the URL as `?off=pov,sf-dems&offtypes=club&why=1&sup=8&ad=17`.

**Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { activeEntries, fromQuery, toQuery, visibleContest } from "@/lib/filters";
import type { Contest, EndorsementFile, Guide } from "@/lib/schema";

const guides = [
  { id: "a", type: "advocacy" }, { id: "b", type: "club" }, { id: "c", type: "newspaper" },
] as Guide[];
const ends = {
  a: { status: "published", hasReasoning: true, picks: { x: { pick: "Y", ranked: false, quotes: [] } } },
  b: { status: "published", hasReasoning: false, picks: { x: { pick: "N", ranked: false, quotes: [] } } },
  c: { status: "pending", hasReasoning: true, picks: {} },
} as unknown as Record<string, EndorsementFile>;

describe("filters", () => {
  it("round-trips through the query string", () => {
    const f = { off: ["b"], offTypes: ["union"], whyOnly: true, districts: { Supervisor: "8" } };
    expect(fromQuery(toQuery(f))).toEqual(f);
  });
  it("excludes pending, off, off-type and list-only guides", () => {
    const base = { off: [], offTypes: [], whyOnly: false, districts: {} };
    expect(activeEntries("x", guides, ends, base).map((r) => r.guide.id)).toEqual(["a", "b"]);
    expect(activeEntries("x", guides, ends, { ...base, whyOnly: true }).map((r) => r.guide.id)).toEqual(["a"]);
    expect(activeEntries("x", guides, ends, { ...base, offTypes: ["advocacy"] }).map((r) => r.guide.id)).toEqual(["b"]);
  });
  it("hides district contests that don't match the chosen district", () => {
    const c = { jurisdiction: { level: "district", name: "Supervisor", district: "2" } } as Contest;
    expect(visibleContest(c, { districts: {} })).toBe(true);
    expect(visibleContest(c, { districts: { Supervisor: "8" } })).toBe(false);
  });
});
```

**Step 2:** Run → FAIL.

**Step 3: Implement**

```ts
// src/lib/filters.ts
import type { Contest, EndorsementFile, Entry, Guide } from "./schema";

export type Filters = { off: string[]; offTypes: string[]; whyOnly: boolean; districts: Record<string, string> };
export const EMPTY: Filters = { off: [], offTypes: [], whyOnly: false, districts: {} };
const DISTRICT_PARAMS: Record<string, string> = { sup: "Supervisor", ad: "Assembly", cd: "Congress", bart: "BART" };

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.off.length) p.set("off", f.off.join(","));
  if (f.offTypes.length) p.set("offtypes", f.offTypes.join(","));
  if (f.whyOnly) p.set("why", "1");
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) if (f.districts[name]) p.set(param, f.districts[name]);
  return p.toString();
}

export function fromQuery(q: string): Filters {
  const p = new URLSearchParams(q);
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : []);
  const districts: Record<string, string> = {};
  for (const [param, name] of Object.entries(DISTRICT_PARAMS)) if (p.get(param)) districts[name] = p.get(param)!;
  return { off: list("off"), offTypes: list("offtypes"), whyOnly: p.get("why") === "1", districts };
}

export function activeEntries(contestId: string, guides: Guide[], ends: Record<string, EndorsementFile>, f: Filters) {
  return guides.flatMap((guide) => {
    const e = ends[guide.id];
    const entry = e?.status === "published" ? e.picks[contestId] : undefined;
    if (!entry || f.off.includes(guide.id) || f.offTypes.includes(guide.type) || (f.whyOnly && !e.hasReasoning)) return [];
    return [{ guide, entry, file: e } as { guide: Guide; entry: Entry; file: EndorsementFile }];
  });
}

export function pendingGuides(guides: Guide[], ends: Record<string, EndorsementFile>) {
  return guides.filter((g) => !ends[g.id] || ends[g.id].status === "pending");
}

export function visibleContest(c: Contest, f: Pick<Filters, "districts">): boolean {
  if (c.jurisdiction.level !== "district") return true;
  const chosen = f.districts[c.jurisdiction.name];
  return !chosen || chosen === c.jurisdiction.district;
}
```

**Step 4:** Run → PASS. **Step 5:** `git add -A && git commit -m "feat: filter state and URL serialization"`

---

### Task 13b: Display model (TDD)

**Why:** Tasks 14–15 are UI. All display logic lives here as pure, unit-tested functions so the components only render. Added 2026-10-05.

**Files:**
- Create: `src/lib/display.ts`
- Test: `tests/display.test.ts`

**Functions and expected outputs** (write each test first, see it fail, implement):

| Function | Input | Output |
|---|---|---|
| `headline(tally)` | measure Y 5 / N 1 | `{ tone: "yes", label: "Yes 83%", detail: "5 of 6", ranked: false }` |
| | measure N 2 / Y 1 | `{ tone: "no", label: "No 67%", detail: "2 of 3", ranked: false }` |
| | measure 3–3 | `{ tone: "split", label: "Split", detail: "3 Yes · 3 No", ranked: false }` |
| | candidate leader A 3 of 4, leaderRanked | `{ tone: "candidate", label: "A", detail: "75% (3 of 4)", ranked: true }` |
| | candidate tie A, B | `{ tone: "split", label: "Split", detail: "A, B", ranked: false }` |
| | total 0 | `{ tone: "none", label: "No picks yet", detail: "", ranked: false }` |
| `runnersUp(tally)` | counts A 3, B 1, C 1 | `"B 1 · C 1"`; `""` for measures, splits and single-candidate tallies |
| `groupByPick(contest, rows)` | measure rows | `[{ key: "Y", label: "Yes", rows }, { key: "N", label: "No", rows }]`, empty groups omitted, Yes first |
| | candidate rows | one group per candidate in `tally.counts` order; a dual-endorsing guide appears in both groups; a ranked guide appears only under its #1 |
| `rankedDetails(rows)` | rows with ranked entries | `[{ guideName, order: ["Gary McCoy", "Michael T. Nguyen"] }]`; `[]` when none |
| `pendingNote(guides)` | 0 / 1 / 3 guides | `null` / `"1 guide hasn't published yet"` / `"3 guides haven't published yet"` |

`rows` is the output type of `activeEntries` (Task 13). Commit `feat: display model`.

---

### Task 14: Pages and data plumbing

**Files:**
- Create: `src/lib/site-data.ts`, `src/app/[election]/page.tsx`, `src/app/[election]/[contest]/page.tsx`, `src/app/guides/[guide]/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Step 1:** `src/lib/site-data.ts`

```ts
import path from "node:path";
import { listElections, loadElection } from "./data";

export const DATA_ROOT = path.join(process.cwd(), "data");
export const elections = () => listElections(DATA_ROOT);
export const latestElection = () => elections().at(-1)!;
export const election = (id: string) => loadElection(DATA_ROOT, id);
```

**Step 2:** `src/app/page.tsx` renders the latest election:

```tsx
import { redirect } from "next/navigation";
import { latestElection } from "@/lib/site-data";
export default function Home() { redirect(`/${latestElection()}`); }
```

**Step 3:** `src/app/[election]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { election, elections } from "@/lib/site-data";
import { BallotView } from "@/components/BallotView";

export const dynamicParams = false;
export function generateStaticParams() { return elections().map((e) => ({ election: e })); }

export default async function ElectionPage({ params }: { params: Promise<{ election: string }> }) {
  const { election: id } = await params;
  if (!elections().includes(id)) notFound();
  const d = election(id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{d.ballot.title}</h1>
      <p className="text-sm text-neutral-500">{d.ballot.date} · {d.guides.length} guides</p>
      <Suspense><BallotView data={d} /></Suspense>
    </main>
  );
}
```

Check the installed Next.js version's docs (`node_modules/next/dist/docs` or nextjs.org) for whether `params` is a Promise in this version before writing; the code above assumes Next 15+.

**Step 4:** Contest page (`/2026-11/prop-b`) renders one `ContestRow` expanded, with `generateStaticParams` over all contest IDs and `generateMetadata` setting the title (e.g. "Prop B — Public Bank · Bay Ballot"). Guide page (`/guides/growsf`) lists the guide's description, type, homepage link, source link, `fetchedAt`, and every pick in ballot order.

**Step 5:** `npm run build` → succeeds, prints the static routes. **Step 6:** commit `feat: pages`.

---

### Task 15: BallotView, GuidePanel, ContestRow

**Files:**
- Create: `src/components/BallotView.tsx`, `src/components/GuidePanel.tsx`, `src/components/ContestRow.tsx`

Behavior spec (port the look from `mockups/index.html` view A):

**BallotView** (`"use client"`):
- Props: `data: ElectionData`.
- State: `Filters`, initialized from `useSearchParams()`; if the URL has no params, from `localStorage["bb-filters"]` (wrap reads/writes in try/catch).
- On change: `router.replace("?" + toQuery(f), { scroll: false })` and write localStorage.
- Renders `GuidePanel`, then contests grouped by `section`, filtered by `visibleContest`, each as a `ContestRow` with `entries = activeEntries(...)` and `pending = pendingGuides(...)`.

**GuidePanel:**
- Type toggles (Newspapers, Parties, Democratic clubs, Unions, Advocacy, Civic) flip `offTypes`.
- A "Guides" disclosure listing every guide as a chip; click flips it in `off`. Chips for list-only guides (`hasReasoning: false`) show a small "list only" tag.
- Checkbox: "Only guides that explain their picks" (`whyOnly`).
- District selects: Supervisor (2, 4, 6, 8, 10), Assembly (17, 19), Congress (11, 15). Default "All".
- A "Reset" link sets `EMPTY`.

**ContestRow:**
- Collapsed: title; measure `description` under it; right side shows the headline from `tally()`:
  - measure: `Yes 83%` pill + `5 of 6` (or `Split 3–3`); a thin Yes/No bar.
  - candidate: leader pill + `75% (3 of 4)`; append `*` when `leaderRanked`; runners-up as a muted line ("Connie Chan 1").
  - total 0: `No picks yet`.
- `*` is a `<button>` with `title="Includes ranked endorsements"` that toggles a small popover listing each ranked guide's full order ("Pissed Off Voters: #1 Gary McCoy, #2 Michael Nguyen"). Must work on tap.
- Expanded (click the row; `aria-expanded`): guides grouped by pick (Yes group, No group; for candidates, one group per candidate in leader order). Each guide: name (links to `/guides/<id>`), quotes as bullets in quotation marks, a "source" link to `file.source`. List-only guides show "No reasons published".
- Footer line if `pending.length`: "N guides haven't published yet" with names in a `title`.
- Measures link to `contest.link` ("Official text").

**Rule:** components contain no display logic. Every string and grouping comes from `src/lib/display.ts` (Task 13b) or `src/lib/filters.ts` (Task 13). If a component needs new logic, add a tested function there first.

**Step 1:** Build the three components. **Step 2:** `npm run dev`, open `http://localhost:3000/2026-11` at 390px width and desktop; click through: toggles recalc, `*` popover opens on tap, URL updates, reload restores state. **Step 3:** commit `feat: ballot list UI`.

---

### Task 16: Footer, corrections, metadata

**Files:** `src/app/layout.tsx`, `src/components/Footer.tsx`

- Footer: "Bay Ballot is independent and not affiliated with any guide listed. Every quote links to its source. Picks as of <latest fetchedAt>." + "Report a mistake" `mailto:` link using `process.env.NEXT_PUBLIC_CORRECTIONS_EMAIL` (ask Sean which address).
- Per guide on the guide page and in expanded rows: "as of <fetchedAt>".
- Site metadata: title "Bay Ballot — every SF voter guide in one list", description, Open Graph image (plain text card is fine).
- Commit `feat: footer, corrections link, metadata`.

---

### Task 17: End-to-end test

**Files:** `playwright.config.ts`, `e2e/ballot.spec.ts`

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  webServer: { command: "npm run build && npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "phone", use: { ...devices["iPhone 13"] } }],
});
```

```ts
// e2e/ballot.spec.ts
import { expect, test } from "@playwright/test";

test("ballot loads, expands, filters and persists", async ({ page }) => {
  await page.goto("/2026-11");
  const row = page.getByRole("button", { name: /Prop C/ });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByText(/source/i).first()).toBeVisible();

  await page.getByLabel("Only guides that explain their picks").check();
  await expect(page).toHaveURL(/why=1/);
  await page.reload();
  await expect(page.getByLabel("Only guides that explain their picks")).toBeChecked();
});
```

Run `npm run e2e` → PASS. Commit `test: e2e smoke test`.

---

### Task 18: CI and deploy (with Sean)

**Step 1:** `.github/workflows/ci.yml`

```yaml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run validate
      - run: npm test
      - run: npm run build
```

**Step 2 (ask Sean first — creates things outside the repo):** create the GitHub repo (`gh repo create bay-ballot --private --source . --push`), import it in Vercel, set Vercel's "Ignored Build Step" to fail when `npm run validate` fails (or rely on CI + branch protection), add the domain `bayballot.com` in Vercel and point DNS per Vercel's instructions.

**Step 3:** Verify production: `curl -sI https://bayballot.com/2026-11 | head -1` → `HTTP/2 200`; run the e2e test against production with `baseURL` overridden.

---

### Task 19: Daily refresh runbook

**Files:** `docs/runbook.md`

Document the daily loop through 2026-11-03:

```
npm run bb -- discover          # any guide still missing a source?
npm run bb -- extract --all     # re-fetch everything
npm run validate
git diff data/                  # Sean reviews every change
git commit -am "data: refresh YYYY-MM-DD" && git push   # Vercel deploys
```

Include: how to hand-enter a guide, how to mark a guide pending, what each `!` note from the CLI means, and the cost check (cache reads should be > 0 after the first guide).

Commit `docs: refresh runbook`.

---

## Out of scope for launch (fast-follows)

- Trust / Neutral / Avoid per guide (mockup view C; `lean` field already reserved).
- Address / ZIP lookup and the district map.
- Other Bay Area counties (contests already carry `jurisdiction`).
- Automated `discover` via web search.
