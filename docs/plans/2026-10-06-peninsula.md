# Peninsula Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Turn Bay Ballot from one SF list into a Bay Area list with a page per area, then add San Mateo County, Palo Alto and Mountain View, as approved in `docs/plans/2026-10-06-peninsula-design.md`.

**Architecture:** A new `data/areas.yml` names each area (`sf`, later `san-mateo`, `palo-alto`, `mountain-view`) and its jurisdictions. Contest jurisdictions gain a `within` list for districts and regions, so every contest's area membership is computed rather than tagged by hand; guides gain `areas`. Pure functions in `src/lib/areas.ts` do membership, the State → County → City grouping, and place names. `/2026-11` renders every contest and counts every guide; `/2026-11/<area>` (served by the existing `[contest]` segment, because Next allows one dynamic segment per level) renders the area's contests and counts only its guides. The extraction pipeline gets a per-guide ballot that holds only the contests in the guide's areas.

**Tech Stack:** Next.js 16 (App Router, static params), TypeScript, Tailwind, `zod` 4, `yaml` 2, Vitest, Playwright, the `npm run bb` pipeline (`@anthropic-ai/sdk`).

> **Decision (Sean, 2026-10-06):** local candidate races (city, school, special district) go on the ballot only when at least one guide takes a position on them. Measures and county offices are always included. The daily refresh adds a race when a guide first covers it. Discovery output: `docs/investigations/2026-10-06-peninsula-guide-discovery.md`.

---

## Read first

- **Design:** `docs/plans/2026-10-06-peninsula-design.md`. Follow it exactly. This plan only adds the decisions the design leaves open (next section).
- **House style:** `docs/plans/2026-10-05-bay-ballot.md` (domain primer: contest, guide, pick, pending, ranked).
- **AGENTS.md:** this is Next.js 16. Before touching a route file, read the matching guide under `node_modules/next/dist/docs/` (dynamic segments, `generateStaticParams`, `generateMetadata`, metadata image files).
- **Open PRs that land first.** Task 1 waits for them.
  - #17 `seo/contest-titles` adds `src/lib/seo-copy.ts`. Contest titles and answer sentences there hard-code "SF" and "San Francisco voter guides". Task 7 makes them area-aware. #17 also removes `shareDescription` from `src/lib/share.ts`, and the contest page then uses `contestTitle`, `contestDescription` and `answerSentence`.
  - #18 `feat/changelog` adds `data/changelog/<YYYY-MM-DD>-<slug>.yml`, one file per entry, with `date`, `type` (`new`|`data`|`fix`), `title`, and optional `details` and `pr`. Every PR that changes what visitors see adds one. `npm run validate` checks them, and a date in the future fails.
  - #19 `feat/keyboard` makes BallotView navigate `all` (the flat contest list) with arrow keys. Task 8 keeps `all` in rendered order.
- **Address filter (separate plan, branch `feat/address-filter`, `docs/plans/2026-10-06-address-filter.md`).** Do not implement any of it here. Stay compatible with it:
  - Its district code starts with a county id (`sf.s8.a17…`). The `sf` area id is the same string, on purpose. When it adds San Mateo and Santa Clara, its county ids should be `san-mateo` and `santa-clara`. `countySlug()` (Task 18) produces those, and the address's city picks `palo-alto` or `mountain-view` inside Santa Clara.
  - Its `districtKind()` reads only `jurisdiction.level`, `name` and `district`. The new `within` field and the `region` level don't change what it sees. RTM becomes `level: region`, and its `onBallot` already keeps every non-district contest.
  - It stores `?d=` and localStorage `bb-districts`. The saved-SF-state redirect (Task 11) reads `bb-districts`. The county filter (Task 19) adds `offc` to `useBallotFilters`'s `keep` list, and the address plan adds `d` to the same list. Whichever lands second merges the two lists.
  - "The address filter takes precedence" in the county group is the address plan's job. When it lands, it should show only the address's county as checked.
- **Guide discovery output:** the discovery output is in `docs/investigations/2026-10-06-peninsula-guide-discovery.md`. Tasks 21 and 30 take their guide list from it. Don't hardcode guides from memory or from the older `docs/investigations/2026-10-06-bay-area-guide-discovery.md`; use that one only as a cross-check.

## Decisions this plan makes (the design was silent)

1. **Where a district is.** `Jurisdiction` gains `within: [{ level: county|city, name }]`, which is required for `level: district` and for the new `level: region` (RTM). A contest is in an area when it is statewide, or when its own county or city, or any `within` place, is one of the area's jurisdictions.
2. **State districts go under California.** Contests with district name `Congress`, `State Senate`, `Assembly` or `Board of Equalization` (and `Court of Appeal` from Phase 3) are listed in the California group, even when they lie in a single county. Otherwise `us-rep-11` would sit under San Francisco while `us-rep-15` sat under California. A local district (Supervisor, BART, City Council, a school district) must be `within` exactly one place.
3. **SF is one city and county.** In `areas.yml`, `sf` has `kind: city`. A city area whose city and county share a name is "consolidated": its city contests sit in the county group, and that group is headed "San Francisco", not "San Francisco County". San Mateo the city is not consolidated, because the `san-mateo` area has `kind: county`.
4. **The ballot title becomes "Bay Area General Election".** It feeds the extraction prompt and the guide page heading. The intro heading becomes `${place} ballot` ("Bay Area ballot", "San Francisco ballot").
5. **Local contest titles name their place** ("Menlo Park Measure P", "San Mateo County Board of Supervisors, District 5"). Existing SF titles stay as they are.
6. **The redirect happens at most once.** On `/2026-11` with no query string, a visitor with no `bb-area` marker and either saved filters or saved `sf.` districts is sent to `/2026-11/sf`. Every list page then writes `bb-area`, so the redirect never fires again and the area picker's "Bay Area" link always works.
7. **The county filter is separate from `Filters`.** It lives in `?offc=` and localStorage `bb-counties`, with its own "All counties" reset, the same way the address plan keeps `d` separate. "Reset filters" stays guide-only. The filter changes which contests are shown, never what is counted.

## Conventions

- Unit tests: `npx vitest run tests/<file>.test.ts`. All: `npm test`. Types: `npx tsc --noEmit`. Lint: `npm run lint`. Data: `npm run validate` must print `data OK`. E2E: `npm run e2e`, which builds first and takes a few minutes.
- Commit after every task with the exact command shown. Use conventional messages with no trailers and no session links.
- Before each phase's ship task, run the full gate: `npm test && npx tsc --noEmit && npm run lint && npm run validate && npm run build && npm run e2e`.

---

# Phase 1: Areas and routes, SF only

Shippable on its own. `/2026-11` becomes the Bay Area list, which shows the same content while SF is the only area. `/2026-11/sf` exists, and old links keep working.

### Task 1: Rebase onto origin/main after #17–#19 merge

**Files:** none

**Step 1: Confirm the three PRs merged**

Run: `gh pr view 17 --json state -q .state; gh pr view 18 --json state -q .state; gh pr view 19 --json state -q .state`
Expected: `MERGED` three times. If any is not merged, stop and ask Sean. Later tasks assume their code.

**Step 2: Rebase**

```bash
cd bay-ballot  # the feat/peninsula worktree
git fetch origin
git rebase origin/main
```
Expected: the design, discovery and plan doc commits replay cleanly. They touch only `docs/`.

**Step 3: Baseline is green**

Run: `npm ci && npm test && npx tsc --noEmit && npm run lint && npm run validate`
Expected: all pass, and `data OK`. Confirm `src/lib/seo-copy.ts`, `src/lib/changelog.ts` and `src/lib/keyboard.ts` exist.

No commit. The rebase rewrites the branch, and it has not been pushed.

---

### Task 2: Guides name their areas

**Files:**
- Modify: `src/lib/schema.ts` (`Guide`)
- Modify: `data/guides/*.yml` (all 44), `tests/fixtures/data/guides/growsf.yml`
- Test: `tests/schema.test.ts`, plus fixture fixes in `tests/data.test.ts`, `tests/refresh.test.ts`

**Step 1: Write the failing test**

In `tests/schema.test.ts`, add `areas: [sf]` as the last line of the YAML in "parses a guide", and add this test inside `describe("schemas")`:

```ts
  it("requires a guide to name at least one area", () => {
    const base = { id: "g", name: "G", description: "", type: "club", homepage: "https://g.org/" };
    expect(Guide.safeParse(base).success).toBe(false);
    expect(Guide.safeParse({ ...base, areas: [] }).success).toBe(false);
    expect(Guide.parse({ ...base, areas: ["sf", "san-mateo"] }).areas).toEqual(["sf", "san-mateo"]);
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL. The first `safeParse` succeeds, so the assertion expecting `false` fails.

**Step 3: Write minimal implementation**

In `src/lib/schema.ts`, add one field to `Guide` after `lean`:

```ts
  areas: z.array(Slug).min(1),
```

Add the field to every guide file, and to the fixture:

```bash
for f in data/guides/*.yml tests/fixtures/data/guides/growsf.yml; do
  [ -n "$(tail -c1 "$f")" ] && echo >> "$f"
  echo "areas: [sf]" >> "$f"
done
```

Fix the test fixtures that build guides:
- `tests/data.test.ts`: in `base()`, the guide literal becomes `{ id: "g", name: "G", description: "", type: "civic", homepage: "https://g.org/", areas: ["sf"] }`. In the `guide` helper inside `describe("loadElection failures")`, append `areas: [sf]\n` to the YAML string.
- `tests/refresh.test.ts`: in `setup()`, the guide YAML string gets `areas: [sf]\n` appended after `homepage: https://${g}.org/\n`.

**Step 4: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npm run validate`
Expected: all PASS, and `data OK`. If `tsc` flags another guide literal, add `areas: ["sf"]` to it.

**Step 5: Commit**

```bash
git add src/lib/schema.ts data/guides tests/schema.test.ts tests/data.test.ts tests/refresh.test.ts tests/fixtures/data/guides/growsf.yml
git commit -m "feat(data): guides name the areas they cover"
```

---

### Task 3: Area schema and contest membership

**Files:**
- Modify: `src/lib/schema.ts` (`Place`, `Jurisdiction`, `Area`, `AreasFile`)
- Create: `src/lib/areas.ts`, `tests/fixtures/areas.ts` (shared area and contest fixtures; later tasks import them)
- Test: `tests/areas.test.ts`, `tests/schema.test.ts`

**Step 1: Write the failing tests**

Append to `tests/schema.test.ts` inside `describe("schemas")` (also add `Area` to the import from `@/lib/schema`):

```ts
  it("parses an area, a region and a district within a place", () => {
    const a = Area.parse(parse(`
id: san-mateo
name: San Mateo County
kind: county
jurisdictions:
  - { level: state, name: California }
  - { level: county, name: San Mateo }
`));
    expect(a.jurisdictions).toHaveLength(2);
    const c = (jurisdiction: unknown) => Contest.safeParse({ id: "x", section: "S", title: "X", kind: "measure", jurisdiction });
    expect(c({ level: "region", name: "Bay Area", within: [{ level: "county", name: "San Francisco" }] }).success).toBe(true);
    expect(c({ level: "district", name: "Supervisor", district: "8", within: [{ level: "county", name: "San Francisco" }] }).success).toBe(true);
    expect(c({ level: "district", name: "Supervisor", district: "8", within: [{ level: "state", name: "California" }] }).success).toBe(false);
  });
```

Create `tests/fixtures/areas.ts` (not a test file; Vitest only collects `*.test.ts`):

```ts
import type { Area, Contest } from "@/lib/schema";

const state = { level: "state" as const, name: "California" };
const county = (name: string) => ({ level: "county" as const, name });
const city = (name: string) => ({ level: "city" as const, name });

export const SF: Area = { id: "sf", name: "San Francisco", shortName: "SF", kind: "city", jurisdictions: [state, county("San Francisco"), city("San Francisco")] };
export const SM: Area = {
  id: "san-mateo", name: "San Mateo County", kind: "county",
  jurisdictions: [state, county("San Mateo"), city("Menlo Park"), city("Redwood City"), city("San Mateo")],
};
export const PA: Area = { id: "palo-alto", name: "Palo Alto", kind: "city", jurisdictions: [state, county("Santa Clara"), city("Palo Alto")] };

export const c = (id: string, jurisdiction: Contest["jurisdiction"]) =>
  ({ id, section: "S", title: id, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction }) as Contest;
export const prop1 = c("prop-1", state);
export const propB = c("prop-b", city("San Francisco"));
export const sup8 = c("supervisor-8", { level: "district", name: "Supervisor", district: "8", within: [county("San Francisco")] });
export const rep15 = c("us-rep-15", { level: "district", name: "Congress", district: "15", within: [county("San Francisco"), county("San Mateo")] });
export const rtm = c("rtm", { level: "region", name: "Bay Area", within: [county("San Francisco"), county("San Mateo"), county("Santa Clara")] });
export const smL = c("san-mateo-county-measure-l", county("San Mateo"));
export const mpP = c("menlo-park-measure-p", city("Menlo Park"));
export const rc2 = c("redwood-city-council-2", { level: "district", name: "City Council", district: "2", within: [city("Redwood City")] });
export const smX = c("san-mateo-measure-x", city("San Mateo"));
export const sccA = c("santa-clara-county-measure-a", county("Santa Clara"));
```

Create `tests/areas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { areaGuides, areaLinks, areasOf, BAY_AREA, contestArea, inArea, placeName } from "@/lib/areas";
import type { Area } from "@/lib/schema";
import { c, mpP, PA, prop1, propB, rc2, rep15, rtm, sccA, SF, SM, sup8 } from "./fixtures/areas";

const areas = [SF, SM, PA];
const ids = (as: Area[]) => as.map((a) => a.id);

describe("areasOf", () => {
  it("puts statewide contests in every area", () => {
    expect(ids(areasOf(prop1, areas))).toEqual(["sf", "san-mateo", "palo-alto"]);
  });
  it("matches county, city, district and region contests by place", () => {
    expect(ids(areasOf(propB, areas))).toEqual(["sf"]);
    expect(ids(areasOf(sup8, areas))).toEqual(["sf"]);
    expect(ids(areasOf(rep15, areas))).toEqual(["sf", "san-mateo"]);
    expect(ids(areasOf(rtm, areas))).toEqual(["sf", "san-mateo", "palo-alto"]);
    expect(ids(areasOf(mpP, areas))).toEqual(["san-mateo"]);
    expect(ids(areasOf(rc2, areas))).toEqual(["san-mateo"]);
    expect(ids(areasOf(sccA, areas))).toEqual(["palo-alto"]);
  });
  it("puts a contest in no area when no area lists its place", () => {
    expect(areasOf(c("x", { level: "city", name: "Atlantis" }), areas)).toEqual([]);
    expect(areasOf(c("y", { level: "district", name: "Supervisor", district: "1" }), areas)).toEqual([]);
    expect(inArea(c("z", { level: "county", name: "San Francisco" }), SM)).toBe(false);
  });
});

describe("contestArea", () => {
  it("is the one area a contest is in, or null when it is in several", () => {
    expect(contestArea(propB, areas)?.id).toBe("sf");
    expect(contestArea(prop1, areas)).toBeNull();
    expect(contestArea(prop1, [SF])?.id).toBe("sf");
  });
});

describe("areaGuides", () => {
  it("keeps the guides that cover the area", () => {
    const gs = [{ id: "a", areas: ["sf"] }, { id: "b", areas: ["san-mateo"] }, { id: "c", areas: ["sf", "san-mateo"] }];
    expect(areaGuides(gs, SM).map((g) => g.id)).toEqual(["b", "c"]);
  });
});

describe("placeName", () => {
  it("uses the area's name and short name, or the Bay Area", () => {
    expect(placeName(SF)).toEqual({ name: "San Francisco", short: "SF" });
    expect(placeName(SM)).toEqual({ name: "San Mateo County", short: "San Mateo County" });
    expect(placeName(null)).toEqual(BAY_AREA);
  });
});

describe("areaLinks", () => {
  it("lists the Bay Area then each area, marking the current one", () => {
    expect(areaLinks("2026-11", [SF, SM], "sf")).toEqual([
      { href: "/2026-11", label: "Bay Area", current: false },
      { href: "/2026-11/sf", label: "San Francisco", current: true },
      { href: "/2026-11/san-mateo", label: "San Mateo County", current: false },
    ]);
    expect(areaLinks("2026-11", [SF], null)[0].current).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/areas.test.ts tests/schema.test.ts`
Expected: FAIL. `areas.test.ts` can't resolve `@/lib/areas`, and `schema.test.ts` can't import `Area`.

**Step 3: Write minimal implementation**

In `src/lib/schema.ts`, replace `Jurisdiction` with the following, and add `Area` and `AreasFile` after it:

```ts
export const Place = z.object({ level: z.enum(["county", "city"]), name: NonEmpty });
export type Place = z.infer<typeof Place>;

export const Jurisdiction = z.object({
  level: z.enum(["state", "region", "county", "city", "district"]),
  name: z.string(),
  district: z.string().optional(),
  within: z.array(Place).min(1).optional(),
});

export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const Area = z.object({
  id: Slug,
  name: NonEmpty,
  shortName: NonEmpty.optional(),
  kind: z.enum(["city", "county"]),
  jurisdictions: z.array(z.object({ level: z.enum(["state", "county", "city"]), name: NonEmpty })).min(1),
});
export type Area = z.infer<typeof Area>;

export const AreasFile = z.object({ areas: z.array(Area).min(1) });
```

Create `src/lib/areas.ts`:

```ts
import type { Area, Contest, Jurisdiction, Place } from "./schema";

// Districts drawn by the state: listed under California, never under a county.
export const STATE_DISTRICTS: readonly string[] = ["Congress", "State Senate", "Assembly", "Board of Equalization"];

export type PlaceName = { name: string; short: string };
export const BAY_AREA: PlaceName = { name: "Bay Area", short: "Bay Area" };

type AreaLike = Pick<Area, "jurisdictions">;

function places(j: Jurisdiction): Place[] | "everywhere" {
  if (j.level === "state") return "everywhere";
  if (j.level === "county" || j.level === "city") return [{ level: j.level, name: j.name }];
  return j.within ?? [];
}

export function inArea(c: Pick<Contest, "jurisdiction">, area: AreaLike): boolean {
  const p = places(c.jurisdiction);
  return p === "everywhere" || p.some((x) => area.jurisdictions.some((j) => j.level === x.level && j.name === x.name));
}

export function areasOf<A extends AreaLike>(c: Pick<Contest, "jurisdiction">, areas: A[]): A[] {
  return areas.filter((a) => inArea(c, a));
}

export function contestArea<A extends AreaLike>(c: Pick<Contest, "jurisdiction">, areas: A[]): A | null {
  const found = areasOf(c, areas);
  return found.length === 1 ? found[0] : null;
}

export function areaGuides<G extends { areas: string[] }>(guides: G[], area: Pick<Area, "id">): G[] {
  return guides.filter((g) => g.areas.includes(area.id));
}

export function placeName(area: Pick<Area, "name" | "shortName"> | null): PlaceName {
  return area ? { name: area.name, short: area.shortName ?? area.name } : BAY_AREA;
}

export type AreaLink = { href: string; label: string; current: boolean };

export function areaLinks(election: string, areas: Pick<Area, "id" | "name">[], current: string | null): AreaLink[] {
  return [
    { href: `/${election}`, label: BAY_AREA.name, current: current === null },
    ...areas.map((a) => ({ href: `/${election}/${a.id}`, label: a.name, current: current === a.id })),
  ];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/areas.test.ts tests/schema.test.ts && npx tsc --noEmit`
Expected: PASS, with no type errors. `display.ts` doesn't switch on `level`, so the new `region` value needs no other change.

**Step 5: Commit**

```bash
git add src/lib/schema.ts src/lib/areas.ts tests/areas.test.ts tests/fixtures/areas.ts tests/schema.test.ts
git commit -m "feat(areas): area schema and contest membership"
```

---

### Task 4: Load `data/areas.yml` and validate areas

**Files:**
- Modify: `src/lib/data.ts`
- Create: `data/areas.yml`, `tests/fixtures/data/areas.yml`
- Modify: `data/2026-11/ballot.yml` (title, `within`, RTM `region`)
- Test: `tests/data.test.ts`, plus fixtures in `tests/refresh.test.ts`, `tests/extract.test.ts`, `tests/site-data.test.ts`

**Step 1: Write the failing tests**

In `tests/data.test.ts`:
- Add `import { SF, SM } from "./fixtures/areas";`.
- In `base()`, add `areas: [SF],` after `endorsements: {},`.
- In "loads an election", add `expect(d.areas.map((a) => a.id)).toEqual(["sf"]);`.
- In "flags duplicate contests, duplicate candidates, district without district", the expected list becomes:

```ts
    expect(r.errors).toEqual([
      "board: duplicate candidate 'A One'",
      "duplicate contest id 'board'",
      "board: district jurisdiction requires a district",
      "board: district jurisdiction requires within",
      "board: in no area (check its jurisdiction and data/areas.yml)",
    ]);
```
- Add these tests inside `describe("data")`:

```ts
  it("requires every contest to be in an area, and districts to say where they are", () => {
    const d = base();
    const m = d.ballot.contests[0];
    d.ballot.contests.push({ ...m, id: "far", jurisdiction: { level: "city", name: "Atlantis" } });
    d.ballot.contests.push({ ...m, id: "dist", jurisdiction: { level: "district", name: "Supervisor", district: "1" } });
    d.ballot.contests.push({
      ...m, id: "wide",
      jurisdiction: { level: "district", name: "Water Board", district: "1", within: [{ level: "county", name: "San Francisco" }, { level: "city", name: "San Francisco" }] },
    });
    expect(validateElection(d).errors).toEqual([
      "dist: district jurisdiction requires within",
      "wide: a local district must be within one place",
      "far: in no area (check its jurisdiction and data/areas.yml)",
      "dist: in no area (check its jurisdiction and data/areas.yml)",
    ]);
  });
  it("fails when an area id collides with a contest id", () => {
    const d = base();
    d.ballot.contests.push({ ...d.ballot.contests[0], id: "sf" });
    expect(validateElection(d).errors).toEqual(["area 'sf' collides with contest 'sf': both would be /2026-11/sf"]);
  });
  it("checks guide areas and that each pick is in one of them", () => {
    const d = base();
    d.areas.push(SM);
    d.ballot.contests.push({ ...d.ballot.contests[0], id: "mp-p", jurisdiction: { level: "city", name: "Menlo Park" } });
    d.guides.push({ ...d.guides[0], id: "x", areas: ["nowhere"] });
    const r = validateElection(withFile(d, { "mp-p": e("Y"), "prop-b": e("N") }));
    expect(r.errors).toEqual(["x: unknown area 'nowhere'", "g/mp-p: contest is outside the guide's areas (sf)"]);
  });
```
- In `describe("loadElection failures")`, add an `areas` constant next to `ballot`, add it to the `ok` map in "throws on non-.yml entries…", and add a test:

```ts
  const areas = fs.readFileSync(path.join(root, "areas.yml"), "utf8");
```
```ts
    const ok = { "2026-11/ballot.yml": ballot, "areas.yml": areas, "guides/.gitkeep": "", "guides/.DS_Store": "" };
```
```ts
  it("throws with the path when areas.yml is missing or has a duplicate id", () => {
    expect(() => loadElection(tmp({ "2026-11/ballot.yml": ballot }), "2026-11")).toThrow(/areas\.yml/);
    const dup = `areas:\n${areas.split("areas:\n")[1]}${areas.split("areas:\n")[1]}`;
    expect(() => loadElection(tmp({ "2026-11/ballot.yml": ballot, "areas.yml": dup }), "2026-11")).toThrow(/duplicate area id 'sf'/);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data.test.ts`
Expected: FAIL. `tests/fixtures/data/areas.yml` doesn't exist (ENOENT when the file is read at module load), and once it does, `d.areas` is undefined.

**Step 3: Write minimal implementation**

Create `data/areas.yml` and copy it to `tests/fixtures/data/areas.yml`:

```yaml
# An area gets a page at /<election>/<id>. Its jurisdictions decide which contests are on it
# (src/lib/areas.ts). The id must never equal a contest id; `npm run validate` checks.
areas:
  - id: sf
    name: San Francisco
    shortName: SF
    kind: city
    jurisdictions:
      - { level: state, name: California }
      - { level: county, name: San Francisco }
      - { level: city, name: San Francisco }
```

```bash
cp data/areas.yml tests/fixtures/data/areas.yml
```

In `src/lib/data.ts`:
- Imports: `import { AreasFile, Ballot, EndorsementFile, Guide, type Area } from "./schema";` and `import { areasOf, STATE_DISTRICTS } from "./areas";`.
- `ElectionData` gains `areas: Area[];`.
- At the end of `loadElection`, replace `return { ballot, guides, endorsements };` with:

```ts
  const areasFile = path.join(root, "areas.yml");
  const { areas } = readParsed(areasFile, AreasFile);
  const dup = areas.find((a, i) => areas.findIndex((b) => b.id === a.id) !== i);
  if (dup) throw new Error(`${areasFile}: duplicate area id '${dup.id}'`);
  return { ballot, guides, endorsements, areas };
```
- In `validateElection`, directly after the existing `district jurisdiction requires a district` check inside the contest loop:

```ts
    const j = c.jurisdiction;
    if ((j.level === "district" || j.level === "region") && !j.within) errors.push(`${c.id}: ${j.level} jurisdiction requires within`);
    if (j.level === "district" && !STATE_DISTRICTS.includes(j.name) && (j.within?.length ?? 0) > 1) {
      errors.push(`${c.id}: a local district must be within one place`);
    }
```
- After the contest loop, before `const guideIds`:

```ts
  for (const a of d.areas) {
    if (contests.has(a.id)) errors.push(`area '${a.id}' collides with contest '${a.id}': both would be /${d.ballot.election}/${a.id}`);
  }
  for (const c of d.ballot.contests) {
    if (areasOf(c, d.areas).length === 0) errors.push(`${c.id}: in no area (check its jurisdiction and data/areas.yml)`);
  }
  const areaIds = new Set(d.areas.map((a) => a.id));
  for (const g of d.guides) {
    for (const a of g.areas) if (!areaIds.has(a)) errors.push(`${g.id}: unknown area '${a}'`);
  }
```
- In the picks loop, directly after `const where = \`${id}/${cid}\`;`:

```ts
      const guide = d.guides.find((g) => g.id === id);
      if (guide && !areasOf(c, d.areas).some((a) => guide.areas.includes(a.id))) {
        errors.push(`${where}: contest is outside the guide's areas (${guide.areas.join(", ")})`);
      }
```

Migrate `data/2026-11/ballot.yml`:

```bash
perl -pi -e 's/^title: San Francisco General Election$/title: Bay Area General Election/' data/2026-11/ballot.yml
perl -pi -e 's/(jurisdiction: \{ level: district, name: [^,]+, district: "\d+")( \})/$1, within: [{ level: county, name: San Francisco }]$2/' data/2026-11/ballot.yml
perl -pi -e 's/jurisdiction: \{ level: county, name: Bay Area region \}/jurisdiction: { level: region, name: Bay Area, within: [{ level: county, name: San Francisco }] }/' data/2026-11/ballot.yml
grep -c "within:" data/2026-11/ballot.yml
```
Expected count: `12` (2 Congress, 2 Assembly, 1 BOE, 1 BART, 5 Supervisor, and RTM). Every `level: district` line must carry `within`. Check with `grep "level: district" data/2026-11/ballot.yml | grep -vc within`, which should print `0`.

Fix the other fixtures that build a data root or name the ballot title:
- `tests/refresh.test.ts`: in `setup()`, after copying the ballot, add `fs.copyFileSync(path.join(__dirname, "..", "data", "areas.yml"), path.join(root, "areas.yml"));`.
- `tests/extract.test.ts:16`: "San Francisco General Election" becomes "Bay Area General Election".
- `tests/site-data.test.ts`: the `ElectionData` literal in "passes only published guides…" gains `areas: []`.
- If #18 added `tests/refresh-changelog.test.ts` with its own temp root, copy `areas.yml` the same way.

**Step 4: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npm run validate`
Expected: all PASS, and `data OK`. If a recount in step 3 found a district line without `within`, `validate` names it.

**Step 5: Commit**

```bash
git add src/lib/data.ts data/areas.yml data/2026-11/ballot.yml tests/fixtures/data/areas.yml tests/data.test.ts tests/refresh.test.ts tests/extract.test.ts tests/site-data.test.ts
git commit -m "feat(areas): load areas.yml; validate membership, guide areas and slug collisions"
```

---

### Task 5: Group contests State → County → City

**Files:**
- Modify: `src/lib/areas.ts`
- Test: `tests/areas.test.ts`

**Step 1: Write the failing test**

Append to `tests/areas.test.ts` (add `placeGroups` to the `@/lib/areas` import, and `smL`, `smX` to the fixtures import):

```ts
describe("placeGroups", () => {
  const all = [mpP, propB, prop1, smL, rc2, sup8, rep15, rtm, smX, sccA];
  const groups = placeGroups(all, areas);
  it("puts California first, then each county in areas.yml order with its cities after it", () => {
    expect(groups.map((g) => [g.heading, g.sections.flatMap((s) => s.contests.map((x) => x.id))])).toEqual([
      ["California", ["prop-1", "us-rep-15", "rtm"]],
      ["San Francisco", ["prop-b", "supervisor-8"]],
      ["San Mateo County", ["san-mateo-county-measure-l"]],
      ["Menlo Park", ["menlo-park-measure-p"]],
      ["Redwood City", ["redwood-city-council-2"]],
      ["San Mateo", ["san-mateo-measure-x"]],
      ["Santa Clara County", ["santa-clara-county-measure-a"]],
    ]);
  });
  it("records each group's county for the county filter", () => {
    expect(groups.map((g) => g.county)).toEqual([null, "San Francisco", "San Mateo", "San Mateo", "San Mateo", "San Mateo", "Santa Clara"]);
  });
  it("keeps sections in first-appearance order inside a group", () => {
    const a = { ...prop1, id: "a", section: "State" };
    const b = { ...prop1, id: "b", section: "State propositions" };
    expect(placeGroups([b, a], [SF])[0].sections.map((s) => s.name)).toEqual(["State propositions", "State"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/areas.test.ts`
Expected: FAIL with "placeGroups is not a function" (or an export error).

**Step 3: Write minimal implementation**

Append to `src/lib/areas.ts`, and add `import { sections, type Section } from "./display";` at the top:

```ts
export type PlaceGroup = { key: string; heading: string; county: string | null; sections: Section[] };

const countyOf = (a: AreaLike) => a.jurisdictions.find((j) => j.level === "county")?.name ?? null;

// A city area whose city is also its county (SF): city contests sit under the county.
function consolidated(county: string, areas: Area[]): boolean {
  return areas.some((a) => a.kind === "city" && countyOf(a) === county && a.jurisdictions.some((j) => j.level === "city" && j.name === county));
}

function cityCounty(name: string, areas: Area[]): string | null {
  const a = areas.find((x) => x.jurisdictions.some((j) => j.level === "city" && j.name === name));
  return a ? countyOf(a) : null;
}

type Slot = { key: string; county: string | null; city: string | null };
const STATE_SLOT: Slot = { key: "state", county: null, city: null };

function slotOf(c: Contest, areas: Area[]): Slot {
  const j = c.jurisdiction;
  if (j.level === "state" || j.level === "region") return STATE_SLOT;
  if (j.level === "district" && STATE_DISTRICTS.includes(j.name)) return STATE_SLOT;
  const p = j.level === "district" ? j.within?.[0] : { level: j.level, name: j.name };
  if (!p) return STATE_SLOT;
  if (p.level === "county") return { key: `county:${p.name}`, county: p.name, city: null };
  const county = cityCounty(p.name, areas);
  if (county === p.name && consolidated(county, areas)) return { key: `county:${county}`, county, city: null };
  return { key: `city:${p.name}`, county, city: p.name };
}

export function placeGroups(contests: Contest[], areas: Area[]): PlaceGroup[] {
  const slots = new Map<string, { slot: Slot; contests: Contest[] }>();
  for (const c of contests) {
    const slot = slotOf(c, areas);
    const s = slots.get(slot.key) ?? { slot, contests: [] };
    s.contests.push(c);
    slots.set(slot.key, s);
  }
  const counties = [...new Set(areas.map(countyOf).filter((x): x is string => x !== null))];
  const rank = (s: Slot) => (s.county === null ? -1 : counties.indexOf(s.county));
  const ordered = [...slots.values()].sort(
    (a, b) =>
      rank(a.slot) - rank(b.slot) ||
      Number(a.slot.city !== null) - Number(b.slot.city !== null) ||
      (a.slot.city ?? "").localeCompare(b.slot.city ?? ""),
  );
  return ordered.map(({ slot, contests: cs }) => ({
    key: slot.key,
    heading: slot.city ?? (slot.county === null ? "California" : consolidated(slot.county, areas) ? slot.county : `${slot.county} County`),
    county: slot.county,
    sections: sections(cs),
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/areas.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/areas.ts tests/areas.test.ts
git commit -m "feat(areas): group contests by place, State then County then City"
```

---

### Task 6: Per-area view props and intro

**Files:**
- Modify: `src/lib/site-data.ts` (`ballotViewProps`), `src/lib/display.ts` (`electionIntro`)
- Test: `tests/site-data.test.ts`, `tests/display-pages.test.ts`

**Step 1: Write the failing tests**

In `tests/site-data.test.ts`, the existing `ballotViewProps` expectation gains `groups: [],` after `ballot: d.ballot,`. Add the following, importing `activeEntries` and `EMPTY` from `@/lib/filters`, the `Contest` and `Entry` types, and `SF`, `SM` from `./fixtures/areas`:

```ts
describe("ballotViewProps with an area", () => {
  const juris = (level: "state" | "city", name: string) => ({ level, name });
  const contest = (id: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title: id, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const y = { pick: "Y", ranked: false, quotes: [] } as Entry;
  const guide = (id: string, areas: string[]) => ({ id, name: id.toUpperCase(), type: "club", description: "", homepage: `https://${id}.org`, areas });
  const d = {
    ballot: {
      election: "2026-11", title: "T", date: "2026-11-03",
      contests: [contest("prop-1", juris("state", "California")), contest("prop-b", juris("city", "San Francisco")), contest("mp-p", juris("city", "Menlo Park"))],
    },
    areas: [SF, SM],
    guides: [guide("s", ["sf"]), guide("m", ["san-mateo"]), guide("p", ["sf"])],
    endorsements: {
      s: { ...file(), guide: "s", picks: { "prop-1": y, "prop-b": y } },
      m: { ...file(), guide: "m", picks: { "prop-1": y, "mp-p": y } },
      p: { ...file(), guide: "p", status: "pending" },
    },
  } as ElectionData;

  it("keeps the area's contests and only its guides", () => {
    const v = ballotViewProps(d, { area: SF });
    expect(v.ballot.contests.map((c) => c.id)).toEqual(["prop-1", "prop-b"]);
    expect(v.guides.map((g) => g.id)).toEqual(["s"]);
    expect(Object.keys(v.files)).toEqual(["s"]);
    expect(v.pending).toBe("1 guide hasn't published yet.");
    expect(v.groups.map((g) => g.heading)).toEqual(["California", "San Francisco"]);
  });
  it("counts a statewide contest with every guide on the Bay Area list and only the area's guides on an area page", () => {
    const counted = (v: ReturnType<typeof ballotViewProps>) => activeEntries("prop-1", v.guides, v.files, EMPTY).length;
    expect(counted(ballotViewProps(d))).toBe(2);
    expect(counted(ballotViewProps(d, { area: SM }))).toBe(1);
    expect(counted(ballotViewProps(d, { area: SF }))).toBe(1);
  });
});
```

In `tests/display-pages.test.ts`, `describe("electionIntro")` becomes:

```ts
describe("electionIntro", () => {
  const withJ = (id: string, level: string, name: string) => ({ id, jurisdiction: { level, name } }) as Contest;
  const ballot = { date: "2026-11-03", contests: [withJ("gov", "state", "California"), withJ("prop-a", "city", "San Francisco")] } as Ballot;
  const pick = { pick: "Y", ranked: false, quotes: [] } as Entry;
  it("titles the place's ballot and counts guides, contests and picks", () => {
    const files = { a: { hasReasoning: true, picks: { gov: pick, "prop-a": pick } }, b: { hasReasoning: false, picks: { gov: pick } } };
    expect(electionIntro(ballot, files, { place: "San Francisco" })).toEqual({ title: "San Francisco ballot", line: "November 3, 2026 · 2 guides · 2 contests · 3 endorsements" });
  });
  it("ignores picks for contests not on the ballot, and singularizes", () => {
    const files = { a: { hasReasoning: true, picks: { gov: pick, stale: pick } } };
    expect(electionIntro({ ...ballot, contests: [ballot.contests[0]] }, files, { place: "Bay Area" }).line).toBe("November 3, 2026 · 1 guide · 1 contest · 1 endorsement");
  });
  it("titles the Bay Area list", () => {
    expect(electionIntro(ballot, {}, { place: "Bay Area" }).title).toBe("Bay Area ballot");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/site-data.test.ts tests/display-pages.test.ts`
Expected: FAIL. `groups` is missing, the area option is ignored (all three contests come back), and `electionIntro` returns "San Francisco ballot" for "Bay Area".

**Step 3: Write minimal implementation**

`src/lib/site-data.ts`: add the imports `import { areaGuides, inArea, placeGroups } from "./areas";` and `import type { Area } from "./schema";`, then replace `ballotViewProps`:

```ts
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
```

`src/lib/display.ts`: replace `electionIntro`:

```ts
export function electionIntro(
  ballot: Pick<Ballot, "date" | "contests">,
  files: Record<string, Pick<EndorsementFile, "picks">>,
  { place }: { place: string },
): { title: string; line: string } {
  const ids = new Set(ballot.contests.map((c) => c.id));
  const guides = Object.values(files);
  const picks = guides.reduce((n, f) => n + Object.keys(f.picks).filter((id) => ids.has(id)).length, 0);
  return {
    title: `${place} ballot`,
    line: [formatDate(ballot.date), counted(guides.length, "guide"), counted(ballot.contests.length, "contest"), counted(picks, "endorsement")].join(" · "),
  };
}
```

`src/app/[election]/page.tsx` still calls the old signature. Task 8 replaces that call, so for now pass `{ place: "San Francisco" }` to keep `tsc` green.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/site-data.test.ts tests/display-pages.test.ts && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/site-data.ts src/lib/display.ts "src/app/[election]/page.tsx" tests/site-data.test.ts tests/display-pages.test.ts
git commit -m "feat(areas): per-area contests, guides and counting in view props"
```

---

### Task 7: Area-aware search titles and answer sentences

**Files:**
- Modify: `src/lib/seo-copy.ts` (from #17)
- Test: `tests/seo-copy.test.ts` (from #17)

**Step 1: Update the existing tests, then write the failing tests**

Thread an SF place through every existing call:

```bash
perl -0pi -e 's/\b(contestTitle|answerSentence|contestDescription|officeName)(\(((?:[^()]++|(?2))*)\))/"$1(" . $3 . ", SF)"/ge' tests/seo-copy.test.ts
grep -c ", SF)" tests/seo-copy.test.ts
```
Expected: about 51 (22 + 19 + 8 + 1 + 1; recount if it differs). Check the diff: only call sites changed, and the import line did not.

Add to the imports: `import { BAY_AREA, type PlaceName } from "@/lib/areas";`, add `areaDescription, areaTitle` to the `@/lib/seo-copy` import, and add `const SF: PlaceName = { name: "San Francisco", short: "SF" };` after the imports. Then append:

```ts
describe("area-aware copy", () => {
  const SM: PlaceName = { name: "San Mateo County", short: "San Mateo County" };
  const mpP = contest({ id: "menlo-park-measure-p", title: "Menlo Park Measure P", jurisdiction: { level: "city", name: "Menlo Park" } });
  const prop1Rows = () => [...many(12, "Y"), ...many(3, "N")];

  it("names a local measure by its own title, an SF prop as SF and a statewide prop as CA", () => {
    expect(officeName(mpP, SM)).toBe("Menlo Park Measure P");
    expect(officeName(propB, SF)).toBe("SF Prop B");
    expect(officeName(prop1, BAY_AREA)).toBe("CA Prop 1");
  });
  it("counts the place's guides in answer sentences", () => {
    expect(answerSentence(prop1, prop1Rows(), AS_OF, SM)).toBe("12 of 15 San Mateo County voter guides recommend Yes on Prop 1, as of October 5, 2026.");
    expect(contestDescription(prop1, many(2, "Y"), BAY_AREA)).toBe("2 of 2 Bay Area voter guides recommend Yes on Prop 1. See every guide's endorsement and reasons.");
  });
  it("titles a local measure page with its place", () => {
    expect(contestTitle(mpP, many(3, "Y"), NOV, SM)).toBe("Menlo Park Measure P endorsements (Nov 2026): 3 of 3 guides say Yes");
  });
  it("titles area pages and the Bay Area list", () => {
    expect(areaTitle(SM, NOV)).toBe("San Mateo County endorsements (Nov 2026)");
    expect(areaTitle(BAY_AREA, NOV)).toBe("Bay Area endorsements (Nov 2026)");
  });
  it("describes an area by its most-endorsed contest", () => {
    const rowsFor = (id: string) => (id === "prop-1" ? prop1Rows() : many(1, "Y"));
    expect(areaDescription(SM, [mpP, prop1], rowsFor)).toBe("12 of 15 San Mateo County voter guides recommend Yes on Prop 1. See every contest side by side.");
    expect(areaDescription(SM, [], () => [])).toBe("What San Mateo County voter guides recommend. See every contest side by side.");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/seo-copy.test.ts`
Expected: FAIL. `areaTitle` and `areaDescription` are not exported, and the San Mateo sentence still says "San Francisco voter guides".

**Step 3: Write minimal implementation**

In `src/lib/seo-copy.ts`:
- Delete `PAGE_WHO` and `SHORT_WHO`. Add `import type { PlaceName } from "./areas";`, `import { mostPositions } from "./share";` and `import type { Contest } from "./schema";` if it isn't imported already.
- `officeName(c: Contest, place: PlaceName)`: the measure line becomes `return \`${c.jurisdiction.level === "state" ? "CA" : place.short} ${label}\`;`.
- `measureObject(c: Contest, place: PlaceName)`: pass `place` to its `officeName` call.
- `contestTitle(c, rows, ballotDate, place: PlaceName)`:
  - Every `officeName(c)` becomes `officeName(c, place)`.
  - The multi-seat head becomes `` [`${place.short} ${officeName(c, place)} endorsements (${when})`, `${officeName(c, place)} endorsements (${when})`] ``.
  - The single-seat head becomes `` [`${officeName(c, place)} endorsements (${place.short}, ${when})`, `${officeName(c, place)} endorsements (${when})`] ``.
- `answer`: change the signature to `function answer(c: Contest, rows: Row[], level: 0 | 1 | 2, place: PlaceName, { short = false }: { short?: boolean } = {}): string` and make its first line `const WHO = \`${short ? place.short : place.name} voter guides\`;`. Every `measureObject(c)` inside becomes `measureObject(c, place)`. The rest of the body is unchanged.
- `answerSentence(c, rows, asOf, place: PlaceName)` calls `answer(c, rows, 0, place)`.
- `contestDescription(c, rows, place: PlaceName)` calls `answer(c, rows, level, place, { short: true })` in both places.
- Append:

```ts
const SEE_ALL = "See every contest side by side.";

export function areaTitle(place: PlaceName, ballotDate: string): string {
  return clip(`${place.name} endorsements (${monthYear(ballotDate)})`, MAX_TITLE);
}

export function areaDescription(place: PlaceName, contests: Contest[], rowsFor: (id: string) => Row[]): string {
  const c = mostPositions(contests, rowsFor);
  const rows = c ? rowsFor(c.id) : [];
  if (!c || rows.length === 0) return `What ${place.name} voter guides recommend. ${SEE_ALL}`;
  for (const short of [false, true]) {
    const d = `${answer(c, rows, 1, place, { short })}. ${SEE_ALL}`;
    if (d.length <= MAX_DESCRIPTION) return d;
  }
  return `${clip(answer(c, rows, 2, place, { short: true }), MAX_DESCRIPTION - SEE_ALL.length - 2)}. ${SEE_ALL}`;
}
```

The callers in `src/app/[election]/[contest]/page.tsx` are fixed in Task 8. To keep this commit compiling, pass `placeName(contestArea(d.contest, d.areas))` there now. Import both from `@/lib/areas`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/seo-copy.test.ts && npx tsc --noEmit`
Expected: PASS. The existing SF expectations are unchanged.

**Step 5: Commit**

```bash
git add src/lib/seo-copy.ts tests/seo-copy.test.ts "src/app/[election]/[contest]/page.tsx"
git commit -m "feat(seo): titles and answer sentences name the area and count its guides"
```

---

### Task 8: Bay Area list, area pages and the area picker

**Files:**
- Create: `src/app/[election]/list-page.tsx`, `src/components/AreaPicker.tsx`
- Modify: `src/app/[election]/page.tsx`, `src/app/[election]/[contest]/page.tsx`, `src/components/BallotView.tsx`, `src/components/SectionHeading.tsx`
- Test: covered by `tests/areas.test.ts` (`areaLinks`, `placeGroups`) and by the e2e tests in Task 12. This task is wiring.

Read first: `node_modules/next/dist/docs/` on dynamic segments, `generateStaticParams` and `generateMetadata`. Next allows only one dynamic segment name per level, so `/2026-11/sf` is served by `[contest]`.

**Step 1: Write the failing check**

Run: `npm run build 2>&1 | tail -5; find .next/server/app -path '*2026-11/sf.*' | wc -l`
Expected: `0`. No `/2026-11/sf` page is generated.

**Step 2: Write minimal implementation**

`src/components/SectionHeading.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return (
    <Tag className={cn("px-1 text-foreground", Tag === "h2" ? "pt-8 pb-1 text-base font-semibold" : "pt-4 pb-2 text-sm font-semibold text-muted-foreground")}>
      {children}
    </Tag>
  );
}
```

`src/components/AreaPicker.tsx`:

```tsx
import Link from "next/link";
import type { AreaLink } from "@/lib/areas";
import { cn } from "@/lib/utils";

export function AreaPicker({ links }: { links: AreaLink[] }) {
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full px-3 ring-1 ring-foreground/15",
            l.current ? "bg-foreground font-medium text-background" : "hover:bg-muted",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

`src/components/BallotView.tsx`:
- Props: remove `ballot: Ballot`. Add `area: string | null`, `links: AreaLink[]` and `groups: PlaceGroup[]`, as type imports from `@/lib/areas`. Remove the now-unused `sections` import and the `Ballot` type import.
- Replace

```ts
  const visible = sections(ballot.contests);
  const all = visible.flatMap((s) => s.contests);
```
with

```ts
  const all = groups.flatMap((g) => g.sections.flatMap((s) => s.contests));
```
- Directly after `<p className="text-sm text-muted-foreground">{intro.line}</p>`, add `<AreaPicker links={links} />`.
- Replace the `{visible.map((s) => ( <section key={s.name} aria-label={s.name}> … </section> ))}` block with the following. The `<ul>` and its `ContestRow` children are unchanged; only the wrapper changes:

```tsx
        {groups.map((g) => (
          <section key={g.key} aria-label={g.heading}>
            <SectionHeading>{g.heading}</SectionHeading>
            {g.sections.map((s) => (
              <section key={s.name} aria-label={`${g.heading}: ${s.name}`}>
                <SectionHeading as="h3">{s.name}</SectionHeading>
                {/* the existing <ul className="divide-y …"> with its ContestRow items, unchanged */}
              </section>
            ))}
          </section>
        ))}
```
- In `ContestRow`, the two `<h3` / `</h3>` tags become `<h4` / `</h4>`.

`src/app/[election]/list-page.tsx`:

```tsx
import type { Metadata } from "next";
import { BallotView } from "@/components/BallotView";
import { areaLinks, placeName } from "@/lib/areas";
import type { ElectionData } from "@/lib/data";
import { electionIntro } from "@/lib/display";
import { activeEntries, EMPTY } from "@/lib/filters";
import type { Area } from "@/lib/schema";
import { areaDescription, areaTitle } from "@/lib/seo-copy";
import { ballotViewProps } from "@/lib/site-data";

export function listMetadata(d: ElectionData, electionId: string, area: Area | null): Metadata {
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const place = placeName(area);
  return {
    title: { absolute: areaTitle(place, ballot.date) },
    alternates: { canonical: area ? `/${electionId}/${area.id}` : `/${electionId}` },
    description: areaDescription(place, ballot.contests, (id) => activeEntries(id, guides, files, EMPTY)),
  };
}

export function ListPage({ d, electionId, area }: { d: ElectionData; electionId: string; area: Area | null }) {
  const { ballot, ...view } = ballotViewProps(d, { area });
  return (
    <BallotView
      election={electionId}
      area={area?.id ?? null}
      links={areaLinks(electionId, d.areas, area?.id ?? null)}
      intro={electionIntro(ballot, view.files, { place: placeName(area).name })}
      {...view}
    />
  );
}
```

`src/app/[election]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { election, elections } from "@/lib/site-data";
import { ListPage, listMetadata } from "./list-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function generateMetadata({ params }: PageProps<"/[election]">): Promise<Metadata> {
  const id = (await params).election;
  const d = election(id);
  return d ? listMetadata(d, id, null) : {};
}

export default async function ElectionPage({ params }: PageProps<"/[election]">) {
  const id = (await params).election;
  const d = election(id);
  if (!d) notFound();
  return <ListPage d={d} electionId={id} area={null} />;
}
```

`src/app/[election]/[contest]/page.tsx` (full file; it keeps #17's metadata and answer sentence):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestDetail } from "@/components/ContestDetail";
import { FRAME, READING } from "@/components/frame";
import { Card } from "@/components/ui/card";
import { contestArea, placeName } from "@/lib/areas";
import { candidateSlots } from "@/lib/bar";
import type { ElectionData } from "@/lib/data";
import { dataAsOf } from "@/lib/display";
import { activeEntries, EMPTY } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { answerSentence, contestDescription, contestTitle } from "@/lib/seo-copy";
import { ballotViewProps, election, elections } from "@/lib/site-data";
import { ListPage, listMetadata } from "../list-page";

export const dynamicParams = false;

// Area pages share this segment with contests (one dynamic segment per level); validate rejects a collision.
export function generateStaticParams() {
  return elections().flatMap((id) => {
    const d = election(id);
    const slugs = [...(d?.areas ?? []).map((a) => a.id), ...(d?.ballot.contests ?? []).map((c) => c.id)];
    return slugs.map((contest) => ({ election: id, contest }));
  });
}

async function load(params: PageProps<"/[election]/[contest]">["params"]) {
  const p = await params;
  const d = election(p.election);
  if (!d) return null;
  const area = d.areas.find((a) => a.id === p.contest);
  if (area) return { kind: "area" as const, d, area, electionId: p.election };
  const contest = d.ballot.contests.find((c) => c.id === p.contest);
  return contest ? { kind: "contest" as const, d, contest, electionId: p.election } : null;
}

function contestView(d: ElectionData, contest: Contest) {
  const { guides, files, pending } = ballotViewProps(d);
  const area = contestArea(contest, d.areas);
  return { rows: activeEntries(contest.id, guides, files, EMPTY), pending, area, place: placeName(area) };
}

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const x = await load(params);
  if (!x) return {};
  if (x.kind === "area") return listMetadata(x.d, x.electionId, x.area);
  const { rows, place } = contestView(x.d, x.contest);
  return {
    // The search title already names the site's subject; the " · Bay Ballot" suffix would cut it off.
    title: { absolute: contestTitle(x.contest, rows, x.d.ballot.date, place) },
    alternates: { canonical: `/${x.electionId}/${x.contest.id}` },
    description: contestDescription(x.contest, rows, place),
  };
}

export default async function ContestPage({ params }: PageProps<"/[election]/[contest]">) {
  const x = await load(params);
  if (!x) notFound();
  if (x.kind === "area") return <ListPage d={x.d} electionId={x.electionId} area={x.area} />;
  const { d, contest, electionId } = x;
  const { rows, pending, area, place } = contestView(d, contest);
  return (
    <div className={`${FRAME} ${READING} pt-4 pb-10`}>
      <p className="text-sm">
        <Link href={area ? `/${electionId}/${area.id}` : `/${electionId}`} className="inline-block py-2.5 -my-2.5 text-muted-foreground underline underline-offset-2">
          {place.name} ballot
        </Link>
      </p>
      <Card className="mt-3 gap-0 p-6 shadow-xs">
        <ContestDetail
          election={electionId}
          contest={contest}
          rows={rows}
          pending={pending}
          heading="h1"
          slots={candidateSlots(contest, rows.map((r) => r.entry))}
          pageLink={false}
          shortNames={false}
          answer={answerSentence(contest, rows, dataAsOf(d.endorsements), place)}
        />
      </Card>
    </div>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -5 && find .next/server/app -path '*2026-11/sf.*'`
Expected: no type or lint errors, the build succeeds, and the prerendered `sf` files are listed. Then `npx next start -p 3300` and open `/2026-11` and `/2026-11/sf`: "Bay Area ballot" and "San Francisco ballot", the groups "California" and "San Francisco", and the picker. Stop the server.

**Step 4: Commit**

```bash
git add "src/app/[election]" src/components/AreaPicker.tsx src/components/BallotView.tsx src/components/SectionHeading.tsx
git commit -m "feat(areas): Bay Area list grouped by place, /2026-11/sf, and an area picker"
```

---

### Task 9: Share images name the place

**Files:**
- Modify: `src/lib/share.ts`, `src/components/share/data.ts`, `src/app/[election]/[contest]/opengraph-image.tsx`
- Test: `tests/share.test.ts`

**Step 1: Write the failing test**

Append to `tests/share.test.ts` (and import `shareLabel`):

```ts
describe("shareLabel", () => {
  it("dates the card and names its place", () => {
    expect(shareLabel("2026-11-03", "San Francisco")).toBe("Nov 3, 2026 · San Francisco");
    expect(shareLabel("2026-11-03T08:00:00Z", "Bay Area")).toBe("Nov 3, 2026 · Bay Area");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/share.test.ts`
Expected: FAIL, because `shareLabel` is not exported.

**Step 3: Write minimal implementation**

In `src/lib/share.ts`, append:

```ts
export function shareLabel(iso: string, place: string): string {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} · ${place}`;
}
```

In `src/components/share/data.ts`:
- Delete `electionLabel`.
- Import `shareLabel` from `@/lib/share` and `contestArea`, `placeName` from `@/lib/areas`.
- In `contestShare`, `right` becomes `shareLabel(d.ballot.date, placeName(contestArea(contest, d.areas)).name)`.
- Add:

```ts
export function areaShare(electionId: string, areaId: string) {
  const d = election(electionId);
  const area = d?.areas.find((a) => a.id === areaId);
  if (!d || !area) return null;
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const rowsFor = (cid: string) => activeEntries(cid, guides, files, EMPTY);
  const contest = mostPositions(ballot.contests, rowsFor);
  return contest ? { card: shareCard(contest, rowsFor(contest.id)), right: shareLabel(d.ballot.date, area.name) } : null;
}
```

In `src/app/[election]/[contest]/opengraph-image.tsx`:
- `const share = contestShare(election, contest) ?? areaShare(election, contest);`
- Import `areaShare`.
- `alt` becomes `"How Bay Area voter guides split, side by side"`.

`twitter-image.tsx` re-exports these and needs no change.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/share.test.ts && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/share.ts src/components/share/data.ts "src/app/[election]/[contest]/opengraph-image.tsx" tests/share.test.ts
git commit -m "feat(share): share images name the contest's place; area pages get a card"
```

---

### Task 10: Sitemap lists area pages

**Files:**
- Modify: `src/lib/seo.ts` (`sitemapEntries`), `src/app/sitemap.ts`
- Test: `tests/seo.test.ts`

**Step 1: Write the failing test**

In `tests/seo.test.ts`, the `elections` input becomes `[{ id: "2026-11", areas: ["sf"], contests: ["prop-b", "us-rep-11"] }]`, and the expected list gets `"https://bayballot.com/2026-11/sf",` right after `"https://bayballot.com/2026-11",`. #18 added a changelog URL to this list; keep it where #18 put it.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seo.test.ts`
Expected: FAIL. The `/2026-11/sf` URL is missing, and `tsc` would also flag the unknown `areas` key.

**Step 3: Write minimal implementation**

In `src/lib/seo.ts`, the `elections` param type becomes `{ id: string; areas: string[]; contests: string[] }[]`, and the first path line becomes:

```ts
    ...elections.flatMap((e) => [`/${e.id}`, ...e.areas.map((a) => `/${e.id}/${a}`), ...e.contests.map((c) => `/${e.id}/${c}`)]),
```

In `src/app/sitemap.ts`:

```ts
  const all = elections().map((id) => {
    const d = election(id);
    return { id, areas: d?.areas.map((a) => a.id) ?? [], contests: d?.ballot.contests.map((c) => c.id) ?? [] };
  });
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/seo.test.ts && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/seo.ts src/app/sitemap.ts tests/seo.test.ts
git commit -m "feat(seo): sitemap lists each area page"
```

---

### Task 11: Saved SF state lands on /2026-11/sf

**Files:**
- Create: `src/lib/home-redirect.ts`, `src/components/useHomeRedirect.ts`
- Modify: `src/components/useBallotFilters.ts` (export the storage key), `src/components/BallotView.tsx`
- Test: `tests/home-redirect.test.ts`

**Step 1: Write the failing test**

`tests/home-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { homeRedirect } from "@/lib/home-redirect";

const base = { query: "", storedFilters: null, storedDistricts: null, seen: null };

describe("homeRedirect", () => {
  it("sends a returning visitor with saved filters to the SF page", () => {
    expect(homeRedirect({ ...base, storedFilters: "off=sf-gop" })).toBe("sf");
    expect(homeRedirect({ ...base, storedFilters: "why=1" })).toBe("sf");
  });
  it("sends a visitor with saved SF districts to the SF page", () => {
    expect(homeRedirect({ ...base, storedDistricts: "sf.s8.a17.c11.b8.e2" })).toBe("sf");
  });
  it("leaves a new visitor, a reset filter and a shared link on the Bay Area list", () => {
    expect(homeRedirect(base)).toBeNull();
    expect(homeRedirect({ ...base, storedFilters: "" })).toBeNull();
    expect(homeRedirect({ ...base, storedFilters: "why=1", query: "?c=prop-b" })).toBeNull();
  });
  it("redirects at most once", () => {
    expect(homeRedirect({ ...base, storedFilters: "why=1", seen: "bay-area" })).toBeNull();
    expect(homeRedirect({ ...base, storedDistricts: "sf.s8", seen: "sf" })).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/home-redirect.test.ts`
Expected: FAIL, because the module is not found.

**Step 3: Write minimal implementation**

`src/lib/home-redirect.ts`:

```ts
export const SEEN_KEY = "bb-area";
// Same key as the address filter's DISTRICTS_KEY.
export const DISTRICTS_KEY = "bb-districts";

export function homeRedirect({
  query,
  storedFilters,
  storedDistricts,
  seen,
}: {
  query: string;
  storedFilters: string | null;
  storedDistricts: string | null;
  seen: string | null;
}): string | null {
  if (seen !== null || query.replace(/^\?/, "") !== "") return null;
  if (storedDistricts?.startsWith("sf.") || (storedFilters ?? "") !== "") return "sf";
  return null;
}
```

In `src/components/useBallotFilters.ts`, rename `const STORAGE_KEY = "bb-filters";` to `export const FILTERS_KEY = "bb-filters";` and update its two uses.

`src/components/useHomeRedirect.ts`:

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DISTRICTS_KEY, homeRedirect, SEEN_KEY } from "@/lib/home-redirect";
import { FILTERS_KEY } from "./useBallotFilters";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useHomeRedirect({ election, area }: { election: string; area: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const target =
      area === null
        ? homeRedirect({ query: window.location.search, storedFilters: read(FILTERS_KEY), storedDistricts: read(DISTRICTS_KEY), seen: read(SEEN_KEY) })
        : null;
    try {
      window.localStorage.setItem(SEEN_KEY, area ?? "bay-area");
    } catch {
    }
    if (target) router.replace(`/${election}/${target}`);
  }, [election, area, router]);
}
```

In `BallotView`, call `useHomeRedirect({ election, area });` right after `useBallotFilters`.

If the address plan merged first and exports its own `DISTRICTS_KEY`, import that instead of redefining it here.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/home-redirect.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/home-redirect.ts src/components/useHomeRedirect.ts src/components/useBallotFilters.ts src/components/BallotView.tsx tests/home-redirect.test.ts
git commit -m "feat(areas): a visitor with saved SF filters or districts lands on /2026-11/sf once"
```

---

### Task 12: E2E for the Bay Area list and the SF page

**Files:**
- Modify: `e2e/helpers.ts`, `e2e/ballot.spec.ts`
- Create: `e2e/areas.spec.ts`

**Step 1: Write the failing tests**

In `e2e/helpers.ts`, `openBallot` expects `name: "Bay Area ballot"`. In `e2e/ballot.spec.ts`, the canonical-URL test's path list gains `` `${BALLOT}/sf` ``.

`e2e/areas.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, openBallot } from "./helpers";

test("the Bay Area list groups contests by place and the picker opens an area", async ({ page }) => {
  await openBallot(page);
  await expect(page).toHaveTitle("Bay Area endorsements (Nov 2026)");
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toBeVisible();
  await expect(contestRow(page, "Proposition B")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Area" });
  await expect(nav.getByRole("link", { name: "Bay Area" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "San Francisco" }).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
  await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
});

test("the SF page has its own title, canonical URL and contests", async ({ page }) => {
  await page.goto(`${BALLOT}/sf`);
  await expect(page).toHaveTitle("San Francisco endorsements (Nov 2026)");
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bayballot.com${BALLOT}/sf`);
  await expect(page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "San Francisco" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/November 3, 2026 · \d+ guides · \d+ contests · \d+ endorsements/)).toBeVisible();
  await expect(contestRow(page, "Proposition B")).toBeVisible();
});

test("old contest links still work and link back to their area", async ({ page }) => {
  for (const id of ["prop-b", "supervisor-8", "governor"]) {
    const res = await page.goto(`${BALLOT}/${id}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto(`${BALLOT}/prop-b`);
  await expect(page.getByRole("link", { name: "San Francisco ballot" })).toHaveAttribute("href", `${BALLOT}/sf`);
});

test("a returning visitor with saved filters lands on the SF page once", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("bb-filters", "why=1"));
  await page.goto(BALLOT);
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
  await page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "Bay Area" }).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
});
```

**Step 2: Run the new tests**

Run: `npm run e2e -- e2e/areas.spec.ts`
Expected: PASS. These tests pin down behavior from Tasks 8–11. To see them fail, check out the Task 7 commit and run them: there is no "Area" navigation, no `/sf` route and no redirect. If one fails now, fix the implementation, not the test.

**Step 3: Run the full suite**

Run: `npm run e2e`
Expected: all pass on both the phone and desktop projects, including #17's search-title test, #18's changelog test and #19's keyboard tests. `us-rep-11` → `us-rep-15` is still the first ArrowDown step, because both sit at the top of the California group.

**Step 4: Commit**

```bash
git add e2e/helpers.ts e2e/ballot.spec.ts e2e/areas.spec.ts
git commit -m "test(e2e): Bay Area list, SF page, picker, old links and the saved-state redirect"
```

---

### Task 13: Changelog entry and contributor docs

**Files:**
- Create: `data/changelog/<YYYY-MM-DD>-bay-area-list.yml`
- Modify: `CONTRIBUTING.md`

**Step 1: Write the entry**

```bash
cat > "data/changelog/$(date +%F)-bay-area-list.yml" <<EOF
date: $(date +%F)
type: new
title: The ballot is now a Bay Area list, and San Francisco has its own page
details: /2026-11 groups every contest by place. /2026-11/sf shows San Francisco's contests and counts only San Francisco guides. Old contest links still work.
EOF
```

**Step 2: Docs**

In `CONTRIBUTING.md` → "Data layout", add after the guides bullet:

```markdown
- `data/areas.yml`: the areas with their own page (`/2026-11/sf`), each with the jurisdictions it covers.
```

Change the guides bullet to `` - `data/guides/<guide>.yml`: one file per voter guide (name, type, homepage, and `areas`, the area ids it covers). ``

**Step 3: Verify**

Run: `npm run validate`
Expected: `data OK`. The changelog entry parses, and its date is today.

**Step 4: Commit**

```bash
git add data/changelog CONTRIBUTING.md
git commit -m "docs: changelog entry and contributor notes for areas"
```

---

### Task 14: Ship Phase 1

**Files:** none

**Step 1: Full gate**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run validate && npm run build && npm run e2e`
Expected: all green.

**Step 2: Pre-push checklist**

```bash
git fetch origin
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
git log origin/main..HEAD --format=%B | grep -inE '^[[:space:]]*Claude-Session:|https?://claude\.ai/code'
```
Expected:
- The log shows the 3 docs commits plus Tasks 2–13 (about 15 commits).
- The stat shows `src/`, `tests/`, `e2e/`, `data/areas.yml`, `data/guides/*`, `data/2026-11/ballot.yml`, `data/changelog/*`, `CONTRIBUTING.md` and `docs/`.
- The grep prints nothing.

**Step 3: Push and open the PR**

```bash
git push -u origin feat/peninsula
gh pr create --base main --title "feat: Bay Area list and area pages (SF first)" --body "$(cat <<'EOF'
Phase 1 of the Peninsula expansion (docs/plans/2026-10-06-peninsula-design.md).

- /2026-11 is now the Bay Area list: every contest, grouped State, County, City, with an area picker. While SF is the only area it shows the same contests and guides as before.
- /2026-11/sf lists SF contests and counts SF guides only.
- data/areas.yml, guide `areas`, and `within` on district contests. Validation fails on a contest in no area, a pick outside its guide's areas, or an area id that equals a contest id.
- Search titles and answer sentences name the area. The sitemap lists area pages. Share images name the place.
- A returning visitor with saved filters lands on /2026-11/sf once.

Old /2026-11/<contest> links are unchanged.
EOF
)"
```

**Step 4: Verify GitHub agrees, and fill in the changelog PR number**

```bash
gh pr view <n> --json commits,additions,deletions | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Commits: {len(d[\"commits\"])}, +{d[\"additions\"]}/-{d[\"deletions\"]}')"
```
Expected: the same commit count as step 2. Then add `pr: <n>` to the changelog file and run:

```bash
git add data/changelog && git commit -m "chore: changelog PR number" && git push
```

**Step 5: Finalize**

Run `/finalize-pr-solo` on the PR and fix what it raises.

**Step 6: Stop**

Report the PR URL to Sean and wait for his go-ahead to merge. Do not merge.

---

# Phase 2: San Mateo County

Start only after Phase 1 is merged.

### Task 15: Branch for Phase 2

**Files:** none

```bash
cd bay-ballot  # the feat/peninsula worktree
git fetch origin
git switch -c feat/peninsula-san-mateo origin/main
npm ci && npm test && npm run validate
```
Expected: green, and `data OK`. `data/areas.yml` lists only `sf`.

---

### Task 16: The pipeline sees only the guide's areas

**Files:**
- Create: `src/pipeline/scope.ts`
- Modify: `src/pipeline/refresh.ts` (`refreshGuide`, `seedPages`), `scripts/bb.ts` (`verifyAndWrite`), `src/pipeline/extract.ts` (one comment)
- Test: `tests/scope.test.ts`, `tests/refresh.test.ts`

**Step 1: Write the failing tests**

`tests/scope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { guideBallot } from "@/pipeline/scope";
import type { Ballot } from "@/lib/schema";
import { mpP, prop1, propB, rep15, SF, SM } from "./fixtures/areas";

const ballot = { election: "2026-11", title: "Bay Area General Election", date: "2026-11-03", contests: [prop1, propB, mpP, rep15] } as Ballot;
const ids = (areas: string[]) => guideBallot(ballot, { areas }, [SF, SM]).contests.map((c) => c.id);

describe("guideBallot", () => {
  it("keeps statewide contests and the contests in the guide's areas", () => {
    expect(ids(["sf"])).toEqual(["prop-1", "prop-b", "us-rep-15"]);
    expect(ids(["san-mateo"])).toEqual(["prop-1", "menlo-park-measure-p", "us-rep-15"]);
    expect(ids(["sf", "san-mateo"])).toEqual(["prop-1", "prop-b", "menlo-park-measure-p", "us-rep-15"]);
  });
});
```

Append to `describe("runRefresh")` in `tests/refresh.test.ts`:

```ts
  it("offers the model only the contests in the guide's areas", async () => {
    const root = setup(["alpha"], { stored: false });
    fs.appendFileSync(
      path.join(root, "areas.yml"),
      "  - id: san-mateo\n    name: San Mateo County\n    kind: county\n    jurisdictions:\n      - { level: state, name: California }\n      - { level: county, name: San Mateo }\n      - { level: city, name: Menlo Park }\n",
    );
    fs.appendFileSync(
      path.join(root, ELECTION, "ballot.yml"),
      "  - id: menlo-park-measure-p\n    section: Local measures\n    title: Menlo Park Measure P\n    kind: measure\n    jurisdiction: { level: city, name: Menlo Park }\n",
    );
    const { client, stream } = fakeClient();
    await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "October 6, 2026") })), { root, election: ELECTION });
    const systems = stream.mock.calls.map((c) => (c[0] as unknown as { system: { text: string }[] }).system[0].text);
    expect(systems).toHaveLength(2);
    for (const s of systems) {
      expect(s).toContain("prop-b");
      expect(s).not.toContain("menlo-park-measure-p");
    }
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scope.test.ts tests/refresh.test.ts`
Expected: FAIL. `scope.ts` is not found, and both system prompts contain `menlo-park-measure-p`.

**Step 3: Write minimal implementation**

`src/pipeline/scope.ts`:

```ts
import { inArea } from "@/lib/areas";
import type { Area, Ballot, Guide } from "@/lib/schema";

export function guideBallot(ballot: Ballot, guide: Pick<Guide, "areas">, areas: Area[]): Ballot {
  const mine = areas.filter((a) => guide.areas.includes(a.id));
  return { ...ballot, contests: ballot.contests.filter((c) => mine.some((a) => inArea(c, a))) };
}
```

In `src/pipeline/refresh.ts` → `refreshGuide`:
- After `const prev = data.endorsements[id];`, add `const ballot = guideBallot(data.ballot, guide, data.areas);`.
- Replace every `data.ballot` in the function with `ballot`: `storedText`, `pageGate`, `extract`, `toEntries(output, ballot.contests, …)` and `verify`.

In `seedPages`: inside the loop, add `const guide = data.guides.find((g) => g.id === id);` and `const ballot = guide ? guideBallot(data.ballot, guide, data.areas) : data.ballot;`, and pass `{ ballot }` to `storedText`.

In `scripts/bb.ts` → `verifyAndWrite`: `verify(client, guideBallot(data.ballot, guide, data.areas), guide, file, sources)`.

In `src/pipeline/extract.ts`, the comment above `systemPrompt` becomes `/** No clock or per-guide text: the prompt must stay byte-identical across guides with the same areas to hit the cache. */`.

**Step 4: Run tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pipeline/scope.ts src/pipeline/refresh.ts src/pipeline/extract.ts scripts/bb.ts tests/scope.test.ts tests/refresh.test.ts
git commit -m "feat(pipeline): extract and verify each guide against its areas' contests only"
```

---

### Task 17: Placement markers that tell cities apart

Measure letters repeat across cities (two cities can each have a Measure P), and local district numbers repeat across counties. A marker that only says "Measure P" can't tell which city a heading belongs to. Contest ids are area-prefixed already. This task makes the markers that place quotes and gate re-extraction need the place name when a sibling contest shares the letter or district.

**Files:**
- Modify: `src/pipeline/placement.ts`, `src/pipeline/pagestore.ts:88`
- Test: `tests/placement.test.ts`

**Step 1: Write the failing tests**

Append to `tests/placement.test.ts`:

```ts
describe("markers across places", () => {
  const measure = (id: string, title: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const race = (id: string, title: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title, kind: "candidate", candidates: ["Ann Lee", "Bo Diaz"], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const mpP = measure("menlo-park-measure-p", "Menlo Park Measure P", { level: "city", name: "Menlo Park" });
  const scP = measure("san-carlos-measure-p", "San Carlos Measure P", { level: "city", name: "San Carlos" });
  const hmbQ = measure("half-moon-bay-measure-q", "Half Moon Bay Measure Q", { level: "city", name: "Half Moon Bay" });
  const sfP = measure("prop-p", "Proposition P", { level: "city", name: "San Francisco" });
  const school = measure("sequoia-uhsd-measure-x", "Sequoia Union High School District Measure X", {
    level: "district", name: "Sequoia Union High School District", district: "at-large", within: [{ level: "county", name: "San Mateo" }],
  });
  const rc2 = race("redwood-city-council-2", "Redwood City Council, District 2", {
    level: "district", name: "City Council", district: "2", within: [{ level: "city", name: "Redwood City" }],
  });
  const smSup5 = race("san-mateo-county-supervisor-5", "San Mateo County Board of Supervisors, District 5", {
    level: "district", name: "Supervisor", district: "5", within: [{ level: "county", name: "San Mateo" }],
  });
  const sfSup5 = race("supervisor-5", "Board of Supervisors, District 5", {
    level: "district", name: "Supervisor", district: "5", within: [{ level: "county", name: "San Francisco" }],
  });
  const marks = (c: Contest, siblings: Contest[], text: string) => contestMarkers(c, siblings).some((re) => re.test(text));

  it("finds a local measure by its letter when no sibling shares it", () => {
    for (const t of ["Measure Q — Yes", "Yes on Q", "Half Moon Bay Measure Q"]) expect(marks(hmbQ, [hmbQ, mpP], t)).toBe(true);
    expect(marks(school, [school], "Measure X: Yes")).toBe(true);
  });
  it("needs the place when two measures share a letter", () => {
    const sibs = [mpP, scP];
    expect(marks(mpP, sibs, "Measure P")).toBe(false);
    expect(marks(mpP, sibs, "Menlo Park Measure P: Yes")).toBe(true);
    expect(marks(mpP, sibs, "Measure P (Menlo Park)")).toBe(true);
    expect(marks(mpP, sibs, "San Carlos Measure P")).toBe(false);
  });
  it("keeps an SF proposition's bare marker when a measure shares its letter", () => {
    expect(marks(sfP, [sfP, mpP], "Prop P")).toBe(true);
    expect(marks(sfP, [sfP, mpP], "Measure P")).toBe(false);
    expect(marks(mpP, [sfP, mpP], "Menlo Park Measure P")).toBe(true);
  });
  it("finds council districts, and qualifies a district number shared across counties", () => {
    expect(marks(rc2, [rc2], "City Council District 2")).toBe(true);
    expect(marks(rc2, [rc2], "Council, District 2")).toBe(true);
    expect(marks(smSup5, [smSup5, sfSup5], "District 5")).toBe(false);
    expect(marks(smSup5, [smSup5, sfSup5], "San Mateo County Supervisor, District 5")).toBe(true);
    expect(marks(smSup5, [smSup5], "Supervisor, District 5")).toBe(true);
  });
  it("places a quote under the right city's Measure P", () => {
    const page: Page = {
      url: "https://g.org/e", kind: "html",
      text: ["Menlo Park Measure P: Yes", "Menlo Park needs the homes this measure allows.", "", "San Carlos Measure P: No", "San Carlos voters should keep the current height limits."].join("\n"),
    };
    const q = { text: "San Carlos voters should keep the current height limits.", source: "https://g.org/e" };
    expect(misplacedUnder(q, "menlo-park-measure-p", [page], [mpP, scP])).toBe("san-carlos-measure-p");
    expect(misplacedUnder(q, "san-carlos-measure-p", [page], [mpP, scP])).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/placement.test.ts`
Expected: FAIL. `contestMarkers` ignores its second argument, so "Measure P" matches both cities. The school measure gets no marker, and "City Council District 2" isn't recognized.

**Step 3: Write minimal implementation**

In `src/pipeline/placement.ts`:

```ts
const MEASURE_TITLE = /^(?:(.+?)\s+)?(Proposition|Measure)\s+(\w+)$/;
const measureLetter = (c: Contest) => (c.kind === "measure" && c.id !== "rtm" ? (c.title.match(MEASURE_TITLE)?.[3] ?? null) : null);
const sameDistrict = (a: Contest, b: Contest) =>
  a.id !== b.id && a.jurisdiction.name === b.jurisdiction.name && a.jurisdiction.district === b.jurisdiction.district;
const nearPlace = (place: string, body: string) => [`${ciWords(place)}[^\\n]{0,40}?${body}`, `${body}[^\\n]{0,40}?${ciWords(place)}`];

function measurePatterns(c: Contest, siblings: Contest[]): string[] {
  const m = c.title.match(MEASURE_TITLE);
  if (!m) return [];
  const [, place, word, id] = m;
  const letter = escapeRegExp(id);
  const yesNo = `(?:${ci("yes")}|${ci("no")})\\s+${ci("on")}`;
  if (!siblings.some((s) => s.id !== c.id && measureLetter(s) === id)) return [`(?:${PROP_WORD}|${yesNo})\\s*${letter}`];
  // An unprefixed "Proposition" is SF's own: SF guides never name their city.
  if (word === "Proposition" && !place) return [`(?:${ci("proposition")}|${ci("prop")}\\.?)\\s*${letter}`];
  const bare = `(?:${ci("measure")}|${yesNo})\\s*${letter}`;
  return place ? nearPlace(place, bare) : [bare];
}
```

In `districtPatterns`, add two cases before `default`:

```ts
    case "City Council":
      return [`(?:${ci("city")}\\s+)?${ci("council")}(?:${ci("member")})?,?\\s*${d}`];
    case "State Senate":
      return [`(?:${ci("state")}\\s+)?${ci("senate")},?\\s*${d}`, `SD-?\\s*${n}`];
```

Change `contestMarkers` to take siblings. Its measure branch and district branch become:

```ts
export function contestMarkers(c: Contest, siblings: Contest[] = []): RegExp[] {
  const out: string[] = [];
  if (c.kind === "measure") {
    if (c.id === "rtm") out.push("RTM", `${ci("regional")}\\s+(?:${ci("transit")}\\s+)?${ci("measure")}`);
    else out.push(...measurePatterns(c, siblings));
  } else {
    const dp = c.jurisdiction.district ? districtPatterns(c) : [];
    const place = c.jurisdiction.within?.length === 1 ? c.jurisdiction.within[0].name : null;
    const qualify = place !== null && siblings.some((s) => sameDistrict(s, c));
    if (dp.length) out.push(...(qualify ? dp.flatMap((p) => nearPlace(place, p)) : dp));
    else out.push(asHeading(ciWords(c.title)));
    // …the existing lt-governor, assessor, court-of-appeal, retention and namePatterns lines, unchanged
  }
  return out.map((p) => bounded(p.replace(/\\s/g, "[^\\S\\n]")));
}
```

Pass siblings at every call site:
- `placement.ts` `headingMarkers`: `contestMarkers(c, contests)`.
- `misplacedUnder`: `contestMarkers(own, contests)`.
- `src/pipeline/pagestore.ts:88`: `ballot.contests.flatMap((c) => contestMarkers(c, ballot.contests))`. Use the arrow form; `flatMap(contestMarkers)` would pass the index as `siblings`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/placement.test.ts tests/pagestore.test.ts tests/extract.test.ts tests/refresh.test.ts && npx tsc --noEmit`
Expected: PASS. The existing SF placement tests are unchanged, because no SF letter or district is shared.

**Step 5: Commit**

```bash
git add src/pipeline/placement.ts src/pipeline/pagestore.ts tests/placement.test.ts
git commit -m "feat(pipeline): place quotes by city when measure letters or district numbers repeat"
```

---

### Task 18: County filter, pure functions

**Files:**
- Create: `src/lib/counties.ts`
- Test: `tests/counties.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { countyOptions, countySlug, parseCounties, showCountyFilter, toCountiesParam, toggleCounty, visibleGroups } from "@/lib/counties";
import { placeGroups } from "@/lib/areas";
import { mpP, PA, prop1, propB, sccA, SF, SM, smL } from "./fixtures/areas";

const groups = placeGroups([prop1, propB, smL, mpP, sccA], [SF, SM, PA]);
const options = countyOptions(groups);

describe("county filter", () => {
  it("slugs county names", () => {
    expect(countySlug("San Mateo")).toBe("san-mateo");
    expect(countySlug("San Francisco")).toBe("san-francisco");
  });
  it("offers each county with local contests, in list order", () => {
    expect(options).toEqual([
      { id: "san-francisco", name: "San Francisco" },
      { id: "san-mateo", name: "San Mateo" },
      { id: "santa-clara", name: "Santa Clara" },
    ]);
    expect(showCountyFilter(options)).toBe(true);
    expect(showCountyFilter(countyOptions(placeGroups([prop1, propB], [SF])))).toBe(false);
  });
  it("parses the URL value, dropping unknown counties", () => {
    expect(parseCounties("santa-clara,nowhere,san-mateo", options)).toEqual(["san-mateo", "santa-clara"]);
    expect(parseCounties(null, options)).toEqual([]);
    expect(toCountiesParam(["santa-clara", "san-mateo"])).toBe("san-mateo,santa-clara");
  });
  it("toggles a county", () => {
    expect(toggleCounty([], "san-mateo")).toEqual(["san-mateo"]);
    expect(toggleCounty(["san-mateo"], "san-mateo")).toEqual([]);
  });
  it("hides a county's county and city groups and always keeps California", () => {
    expect(visibleGroups(groups, ["san-mateo"]).map((g) => g.heading)).toEqual(["California", "San Francisco", "Santa Clara County"]);
    expect(visibleGroups(groups, options.map((o) => o.id)).map((g) => g.heading)).toEqual(["California"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/counties.test.ts`
Expected: FAIL, because the module is not found.

**Step 3: Write minimal implementation**

`src/lib/counties.ts`:

```ts
import type { PlaceGroup } from "./areas";

export const COUNTIES_PARAM = "offc";
export const COUNTIES_KEY = "bb-counties";

export type CountyOption = { id: string; name: string };

export const countySlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function countyOptions(groups: PlaceGroup[]): CountyOption[] {
  const out: CountyOption[] = [];
  for (const g of groups) if (g.county !== null && !out.some((o) => o.name === g.county)) out.push({ id: countySlug(g.county), name: g.county });
  return out;
}

export const showCountyFilter = (options: CountyOption[]) => options.length > 1;

export function parseCounties(value: string | null, options: CountyOption[]): string[] {
  const known = new Set(options.map((o) => o.id));
  return [...new Set((value ?? "").split(",").map((s) => s.trim()).filter((s) => known.has(s)))].sort();
}

export const toCountiesParam = (off: string[]) => [...new Set(off)].sort().join(",");

export function toggleCounty(off: string[], id: string): string[] {
  return off.includes(id) ? off.filter((x) => x !== id) : [...off, id].sort();
}

export function visibleGroups(groups: PlaceGroup[], off: string[]): PlaceGroup[] {
  return groups.filter((g) => g.county === null || !off.includes(countySlug(g.county)));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/counties.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/counties.ts tests/counties.test.ts
git commit -m "feat(counties): county filter options, URL value and visible groups"
```

---

### Task 19: County filter in the filter column

**Files:**
- Modify: `src/components/useBallotFilters.ts`, `src/components/FilterPanel.tsx`, `src/components/BallotView.tsx`
- Test: e2e in Task 24. The logic is covered by Task 18.

**Step 1: Implementation**

In `useBallotFilters.ts`, generalize storage and add `useStoredParam`:

```ts
function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
  }
}
```
- `readStored()` / `writeStored(q)` become `readKey(FILTERS_KEY)` / `writeKey(FILTERS_KEY, q)`. In `useBallotFilters`: `useSyncExternalStore(subscribe, () => readKey(FILTERS_KEY), () => null)`.
- Append:

```ts
export function useStoredParam(name: string, storageKey: string): [string | null, (v: string) => void] {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, () => readKey(storageKey), () => null);
  const p = new URLSearchParams(query);
  const value = p.has(name) ? p.get(name) : stored;
  const set = useCallback(
    (v: string) => {
      writeKey(storageKey, v);
      const q = new URLSearchParams(window.location.search);
      if (v) q.set(name, v);
      else q.delete(name);
      replaceQuery(q.toString());
    },
    [name, storageKey],
  );
  return [value, set];
}
```

In `FilterPanel.tsx`:
- Export `type CountyControl = { options: CountyOption[]; off: string[]; onChange: (off: string[]) => void };`.
- `Props` gains `counties?: CountyControl`.
- In `FilterControls`, destructure `counties` and render `{counties ? <CountyChecklist {...counties} /> : null}` between the "Show" section and `GuideChecklist`.
- Add:

```tsx
function CountyChecklist({ options, off, onChange }: CountyControl) {
  return (
    <Section title="Counties">
      {options.map((o) => (
        <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={!off.includes(o.id)} onCheckedChange={() => onChange(toggleCounty(off, o.id))} />
          {o.name}
        </label>
      ))}
      {off.length ? (
        <Button variant="link" className="h-10 px-0 text-sm underline" onClick={() => onChange([])}>
          All counties
        </Button>
      ) : null}
    </Section>
  );
}
```

In `BallotView.tsx`:

```ts
  const { filters, setFilters } = useBallotFilters({ guides, keep: ["c", COUNTIES_PARAM] });
  const options = area === null ? countyOptions(groups) : [];
  const [offParam, setOffParam] = useStoredParam(COUNTIES_PARAM, COUNTIES_KEY);
  const offCounties = parseCounties(offParam, options);
  const listed = visibleGroups(groups, offCounties);
  const counties = showCountyFilter(options) ? { options, off: offCounties, onChange: (off: string[]) => setOffParam(toCountiesParam(off)) } : undefined;
```
- `all` is computed from `listed` instead of `groups`, and the render maps `listed`.
- `filterProps` gains `counties`.
- If the address filter has merged, its `keep` entry `d` stays in the list.

**Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: green. Until San Mateo data exists, `showCountyFilter` is false and nothing new renders. Task 24 covers the behavior.

**Step 3: Commit**

```bash
git add src/components/useBallotFilters.ts src/components/FilterPanel.tsx src/components/BallotView.tsx
git commit -m "feat(counties): Counties group in the filter column on the Bay Area list"
```

---

### Task 20: San Mateo County area and contests

**Files:**
- Modify: `data/areas.yml`, `data/2026-11/ballot.yml`
- Create: `data/2026-11/sources/SMC-Candidate-Roster-<MMDD>.pdf` (and the measure list, saved as PDF or text)
- Test: `npm run validate`, `tests/placement.test.ts` (real data still loads)

**Step 1: Write the failing check**

Add the area to `data/areas.yml`:

```yaml
  - id: san-mateo
    name: San Mateo County
    kind: county
    jurisdictions:
      - { level: state, name: California }
      - { level: county, name: San Mateo }
      - { level: city, name: Atherton }
      - { level: city, name: Belmont }
      - { level: city, name: Brisbane }
      - { level: city, name: Burlingame }
      - { level: city, name: Colma }
      - { level: city, name: Daly City }
      - { level: city, name: East Palo Alto }
      - { level: city, name: Foster City }
      - { level: city, name: Half Moon Bay }
      - { level: city, name: Hillsborough }
      - { level: city, name: Menlo Park }
      - { level: city, name: Millbrae }
      - { level: city, name: Pacifica }
      - { level: city, name: Portola Valley }
      - { level: city, name: Redwood City }
      - { level: city, name: San Bruno }
      - { level: city, name: San Carlos }
      - { level: city, name: San Mateo }
      - { level: city, name: South San Francisco }
      - { level: city, name: Woodside }
```

Run: `npm run validate`
Expected: `data OK`. An area with no local contests is valid, so the real check is the contest count below.

Then run `curl -s https://smcacre.gov/elections/november-3-2026-statewide-general-election -o /tmp/smc.html && grep -oE 'candidateroster[0-9]+\.pdf' /tmp/smc.html | sort -u` to find the newest roster. The Sept 3 file is `52_candidateroster0903.pdf`; use a later one if listed.

**Step 2: Gather the sources**

```bash
curl -sL "https://smcacre.gov/system/files/2026-09/52_candidateroster0903.pdf" -o data/2026-11/sources/SMC-Candidate-Roster-0903.pdf
pdftotext -layout data/2026-11/sources/SMC-Candidate-Roster-0903.pdf /tmp/smc-roster.txt
```
Save the registrar's list of local measures (letter, jurisdiction, ballot question) from the election page as `data/2026-11/sources/SMC-Measures-Nov2026.pdf` (print to PDF). For state and federal districts that include San Mateo County, read `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`. Cross-check the finished list against https://www.kqed.org/voterguide/sanmateo.

**Step 3: Add the contests**

Append to `data/2026-11/ballot.yml` under `# ---------- San Mateo County ----------`, one entry per roster contest and per measure. Rules:
- **ids** are area-prefixed slugs: `san-mateo-county-measure-l`, `san-mateo-county-supervisor-5`, `<city-slug>-council[-<district>]`, `<city-slug>-mayor`, `<city-slug>-measure-<letter>`, `<school-or-special-district-slug>-measure-<letter>` and `<…>-trustee[-area-<n>]`.
- **titles name their place:** "San Mateo County Measure L", "Menlo Park Measure P", "Redwood City Council, District 2", "Belmont Mayor", "Sequoia Union High School District Measure X".
- **sections:** `Local candidates`, `Local measures`, `School and special districts`.
- **jurisdiction:**
  - county measures and countywide offices: `{ level: county, name: San Mateo }`
  - city contests: `{ level: city, name: <City> }`
  - supervisor and council districts: `{ level: district, name: Supervisor | City Council, district: "<n>", within: [{ level: <county|city>, name: <place> }] }`
  - school or special districts: `{ level: district, name: <District name>, district: "at-large" | "<area n>", within: [<the one city it lies in, else the county>] }`
- **candidates:** exact roster names in Title Case, with `seats` for multi-seat races. San Mateo County does not use ranked-choice voting, so leave `rankedChoice` at its default.
- **measures:** `description` is the registrar's short title, and `link` is the registrar's measure page.
- **shared contests:**
  - Add `{ level: county, name: San Mateo }` to the `within` of `us-rep-15`, `board-of-equalization-2` and `rtm`, if the certified list puts San Mateo in them.
  - Add each other Congress, State Senate and Assembly district that includes San Mateo as `us-rep-<n>`, `state-senate-<n>` or `assembly-<n>`, with `within` listing every one of our counties it touches.

Example entries:

```yaml
  # ---------- San Mateo County ----------
  - id: san-mateo-county-measure-l
    section: Local measures
    title: San Mateo County Measure L
    kind: measure
    description: "<registrar's short title>"
    link: https://smcacre.gov/elections/november-3-2026-statewide-general-election
    jurisdiction: { level: county, name: San Mateo }
  - id: san-mateo-county-supervisor-5
    section: Local candidates
    title: San Mateo County Board of Supervisors, District 5
    kind: candidate
    candidates: [<exact roster names>]
    jurisdiction: { level: district, name: Supervisor, district: "5", within: [{ level: county, name: San Mateo }] }
  - id: menlo-park-measure-p
    section: Local measures
    title: Menlo Park Measure P
    kind: measure
    description: "<registrar's short title>"
    jurisdiction: { level: city, name: Menlo Park }
```

Open question for Sean before this step: include every school and special-district candidate race from the roster (the design says "from registrar lists"), or only those at least one guide endorses in? Default: include all of them.

**Step 4: Verify**

Run: `npm run validate && npm test && npm run build`
Expected: `data OK`, green tests, and a build that generates `/2026-11/san-mateo`. Validation catches a typo in a place name ("in no area") and an id that collides with an area. Run `grep -c "^  - id:" data/2026-11/ballot.yml` before and after, and confirm the new count matches the registrar roster plus measures plus new state districts.

**Step 5: Commit**

```bash
git add data/areas.yml data/2026-11/ballot.yml data/2026-11/sources
git commit -m "data: San Mateo County area and Nov 2026 contests from the registrar"
```

---

### Task 21: San Mateo guides from discovery

**Files:**
- Create: `data/guides/<id>.yml` per new guide, `data/2026-11/endorsements/<id>.yml` (stubs)
- Modify: existing `data/guides/*.yml` whose guide also covers San Mateo

**Step 1: Read the discovery output**

Read `docs/investigations/2026-10-06-peninsula-guide-discovery.md`. If it is missing, stop and ask.

Build a working list of guides that have published Nov 2026 picks in at least one San Mateo County contest, or statewide picks and an explicit San Mateo audience. Record each guide's id, type, homepage, source URL(s), whether the pages need a browser, whether it explains its picks, and its areas. Skip guides marked unverified or not yet published, and list them in the PR body as follow-ups.

**Step 2: Existing guides that now cover San Mateo**

For each existing guide the discovery output lists with San Mateo picks (for example a multi-county union or advocacy page), change `areas: [sf]` to `areas: [sf, san-mateo]`. For `lwv-ca`, which has statewide picks only and a statewide audience, set `areas: [sf, san-mateo]`. Leave SF-audience guides (e.g. `sf-chronicle`) at `[sf]` unless the discovery output shows San Mateo picks; ask Sean if that's unclear. An area widened this way needs `--force-extract` in Task 22, because its pages haven't changed.

**Step 3: New guide files**

For each new guide, create `data/guides/<id>.yml`:

```yaml
id: <short-slug, e.g. smc-dems, peninsula-for-everyone>
name: <official name>
shortName: <optional, ≤ 20 chars>
description: <one sentence on who they are>
type: <newspaper|party|club|union|advocacy|civic>
homepage: <https://…/>
areas: [san-mateo]
```
The id must not equal an area or contest id; validate checks.

**Step 4: Stubs and sources**

Run: `npm run bb -- discover`
Expected: a `created data/2026-11/endorsements/<id>.yml` line for each new guide. In each stub:
- set `source:` (and `extraSources:` for multi-page guides)
- set `fetchWith: browser` for JS-rendered or bot-blocked pages
- set `allowForeignSources: true` only when the picks live on another host (a PDF on Squarespace, for example)

Guides whose picks are Word documents or images (the discovery found the San Mateo Labor Council publishes Word docs and a flyer) get `manual: true`, and their picks are entered by hand in Task 22. See `docs/runbook.md` → "Manual guides".

**Step 5: Verify**

Run: `npm run bb -- check && npm run validate`
Expected: `check OK`, with no host problems, and `data OK`. The new guides are `pending`, so they're listed under "no source" only if a source is missing.

**Step 6: Commit**

```bash
git add data/guides data/2026-11/endorsements
git commit -m "data: San Mateo County guides from the discovery pass"
```

---

### Task 22: Extract, verify and review San Mateo guides (with Sean)

**Files:** `data/2026-11/endorsements/*.yml`, `data/2026-11/pages/*`, possibly `data/2026-11/ballot.yml` (aliases)

**Step 1: Extract**

Run: `npm run bb -- extract <new ids…>`. Then run `npm run bb -- extract --force-extract <widened ids…>`.
Expected: each guide prints its picks diff and the verify results, since extract verifies by default. Each guide's prompt lists only its areas' contests (Task 16). Any `PICK DROPPED — unknown candidate` names a spelling the ballot lacks: add it to that contest's `aliases` in `ballot.yml` and re-run that guide.

**Step 2: Resolve holds**

For every `!! HELD` line, follow `docs/runbook.md`:
- fix the input (aliases, `extraSources`), or
- mark the guide `manual: true` and enter the pick by hand with its quote and `source`.

Then run `npm run bb -- verify <id>` again.

**Step 3: Review**

Run: `npm run bb -- review`, then walk through `review.html` with Sean. Expected: every flagged guide is either fixed or accepted by Sean.

**Step 4: Verify**

Run: `npm run bb -- check && npm run validate && npm test`
Expected: `check OK`, `data OK`, green. No "contest is outside the guide's areas" errors.

**Step 5: Commit**

```bash
git add data/2026-11
git commit -m "data: extract and verify San Mateo County guides"
```

---

### Task 23: Site copy says Bay Area

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/about/page.tsx`, `src/app/opengraph-image.tsx`

**Step 1: Write the failing check**

Run: `grep -rn "every SF voter guide\|every San Francisco voter guide\|San Francisco's voter guides" src`
Expected: 4 hits (layout title and description, about page, root OG alt and text).

**Step 2: Edit**

- `layout.tsx`: title `"Bay Ballot — every Bay Area voter guide in one place"`; description `"What Bay Area voter guides recommend for each contest, side by side, with quotes that link to their source."`
- `about/page.tsx`: "every San Francisco voter guide's endorsements" becomes "every San Francisco and San Mateo County voter guide's endorsements".
- `opengraph-image.tsx`: alt `"Bay Ballot: every Bay Area voter guide in one place, November 3, 2026"`; text `"Every Bay Area voter guide in one place · November 3, 2026"`.

**Step 3: Verify**

Run the grep again. Expected: no hits. `SiteFooter`'s "Built and maintained in San Francisco" stays. Then run `npm run build`; it succeeds.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/about/page.tsx src/app/opengraph-image.tsx
git commit -m "copy: the site covers the Bay Area, not just SF"
```

---

### Task 24: E2E for San Mateo, per-area counting and the county filter

**Files:**
- Modify: `e2e/areas.spec.ts`

**Step 1: Write the tests**

Append (import `isPhone` from `./helpers`):

```ts
const guideCount = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path);
  const line = await page.getByText(/November 3, 2026 · \d+ guides? ·/).textContent();
  return Number(line!.match(/· (\d+) guides? ·/)![1]);
};

test("each area page counts only its own guides", async ({ page }) => {
  const all = await guideCount(page, BALLOT);
  const sf = await guideCount(page, `${BALLOT}/sf`);
  const sm = await guideCount(page, `${BALLOT}/san-mateo`);
  expect(sf).toBeLessThan(all);
  expect(sm).toBeLessThan(all);
  expect(sf + sm).toBeGreaterThanOrEqual(all);
});

test("the San Mateo page shows state and San Mateo contests only", async ({ page }) => {
  await page.goto(`${BALLOT}/san-mateo`);
  await expect(page).toHaveTitle("San Mateo County endorsements (Nov 2026)");
  await expect(page.getByRole("heading", { level: 1, name: "San Mateo County ballot" })).toBeVisible();
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toHaveCount(0);
  await expect(contestRow(page, "Proposition B")).toHaveCount(0);
});

test("the Bay Area list shows both counties", async ({ page }) => {
  await openBallot(page);
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
});

test("the Counties filter hides a county's contests, keeps statewide ones, and persists", async ({ page }, info) => {
  await openBallot(page);
  const open = async () => {
    if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
    return isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  };
  let panel = await open();
  await panel.getByRole("group", { name: "Counties" }).getByRole("checkbox", { name: "San Mateo", exact: true }).click();
  await expect(page).toHaveURL(/[?&]offc=san-mateo/);
  if (isPhone(info)) await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await page.goto(BALLOT);
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  panel = await open();
  await panel.getByRole("button", { name: "All counties" }).click();
  if (isPhone(info)) await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
});

test("area pages have no Counties filter", async ({ page }, info) => {
  test.skip(isPhone(info), "the sidebar is the same component on phone");
  await page.goto(`${BALLOT}/san-mateo`);
  await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("group", { name: "Counties" })).toHaveCount(0);
});
```

The redirect test from Task 12 stores `bb-filters` on `/about` first, and this test file's storage starts empty, so the county test isn't redirected.

**Step 2: Run**

Run: `npm run e2e`
Expected: all pass on phone and desktop.

**Step 3: Commit**

```bash
git add e2e/areas.spec.ts
git commit -m "test(e2e): San Mateo page, per-area counting and the county filter"
```

---

### Task 25: Changelog entry for San Mateo

**Step 1: Write the entry**

```bash
cat > "data/changelog/$(date +%F)-san-mateo-county.yml" <<EOF
date: $(date +%F)
type: new
title: San Mateo County is on Bay Ballot, with its own page at /2026-11/san-mateo
details: <N> San Mateo County guides and <M> local contests. A Counties filter on the Bay Area list hides a county's local contests.
EOF
```
Fill in N and M from `npm run bb -- check` and `grep -c` on the San Mateo block.

**Step 2: Verify and commit**

Run: `npm run validate`. Expected: `data OK`.

```bash
git add data/changelog && git commit -m "docs: changelog entry for San Mateo County"
```

---

### Task 26: Ship Phase 2

Same steps as Task 14, with branch `feat/peninsula-san-mateo` and title `feat: San Mateo County`.
- In step 2, expect only Tasks 16–25 commits on top of `origin/main`.
- The PR body lists the new guides, the guides whose areas widened, any guides skipped as unpublished, and the contest counts.
- Fill in the changelog `pr:`, run `/finalize-pr-solo`, then stop and wait for Sean's go-ahead to merge.

---

# Phase 3: Palo Alto and Mountain View

Start only after Phase 2 is merged.

### Task 27: Branch for Phase 3

```bash
git fetch origin
git switch -c feat/peninsula-santa-clara origin/main
npm ci && npm test && npm run validate
```
Expected: green.

---

### Task 28: The Court of Appeal is a district

The 1st District Court of Appeal covers SF and San Mateo; Santa Clara is in the 6th. `court-of-appeal-1` is `level: state` today, which would put it on the Palo Alto page.

**Files:**
- Modify: `src/lib/areas.ts` (`STATE_DISTRICTS`), `src/pipeline/placement.ts`, `data/2026-11/ballot.yml`
- Test: `tests/placement.test.ts`, `tests/areas.test.ts`

**Step 1: Write the failing tests**

Append to `tests/areas.test.ts`:

```ts
it("lists a Court of Appeal district under California", () => {
  const coa = c("court-of-appeal-6", { level: "district", name: "Court of Appeal", district: "6", within: [{ level: "county", name: "Santa Clara" }] });
  expect(placeGroups([coa], [PA])[0].heading).toBe("California");
});
```

Append to `tests/placement.test.ts` (inside `describe("markers across places")`):

```ts
  it("tells Court of Appeal districts apart, and keeps the bare name when only one is on the ballot", () => {
    const coa = (n: string, county: string) =>
      ({ id: `court-of-appeal-${n}`, section: "Judicial", title: `${n === "1" ? "1st" : "6th"} District Court of Appeal`, kind: "retention", candidates: [], seats: 1, rankedChoice: false,
         jurisdiction: { level: "district", name: "Court of Appeal", district: n, within: [{ level: "county", name: county }] } }) as Contest;
    const one = coa("1", "San Francisco");
    const six = coa("6", "Santa Clara");
    expect(marks(one, [one], "Court of Appeal: retain all")).toBe(true);
    expect(marks(one, [one, six], "Court of Appeal")).toBe(false);
    expect(marks(one, [one, six], "First District Court of Appeal")).toBe(true);
    expect(marks(six, [one, six], "6th District Court of Appeal")).toBe(true);
    expect(marks(six, [one, six], "Court of Appeal, Sixth District")).toBe(true);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/areas.test.ts tests/placement.test.ts`
Expected: FAIL. "Court of Appeal" is not a state district, and there is no district pattern for it.

**Step 3: Write minimal implementation**

- `src/lib/areas.ts`: add `"Court of Appeal"` to `STATE_DISTRICTS`.
- `src/pipeline/placement.ts`: add `const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth"];` and a case in `districtPatterns`:

```ts
    case "Court of Appeal": {
      const nth = `(?:${n}(?:st|nd|rd|th)|${ci(ORDINALS[Number(n)] ?? n)})`;
      return [`${nth}\\s+${ciWords("district court of appeal")}`, `${ciWords("court of appeal")},?\\s*${nth}\\s+${ci("district")}`];
    }
```
- In `contestMarkers`, replace the `if (c.id === "court-of-appeal-1") out.push(ciWords("court of appeal"));` line with:

```ts
    if (c.jurisdiction.name === "Court of Appeal" && !siblings.some((s) => s.id !== c.id && s.jurisdiction.name === "Court of Appeal")) {
      out.push(ciWords("court of appeal"));
    }
```
- `data/2026-11/ballot.yml`: `court-of-appeal-1`'s jurisdiction becomes `{ level: district, name: Court of Appeal, district: "1", within: [{ level: county, name: San Francisco }, { level: county, name: San Mateo }] }`. Task 29 adds `court-of-appeal-6` with `within: [{ level: county, name: Santa Clara }]` once the Santa Clara retention list is known.

**Step 4: Run tests to verify they pass**

Run: `npm test && npm run validate`
Expected: PASS, and `data OK`. The existing "court of appeal" SF placement test still passes, because its siblings have no second court.

**Step 5: Commit**

```bash
git add src/lib/areas.ts src/pipeline/placement.ts data/2026-11/ballot.yml tests/areas.test.ts tests/placement.test.ts
git commit -m "feat(areas): Court of Appeal is a district, so each area gets its own"
```

---

### Task 29: Palo Alto and Mountain View areas and contests

**Files:**
- Modify: `data/areas.yml`, `data/2026-11/ballot.yml`
- Create: sources in `data/2026-11/sources/`

**Step 1: Areas**

Append to `data/areas.yml`:

```yaml
  - id: palo-alto
    name: Palo Alto
    kind: city
    jurisdictions:
      - { level: state, name: California }
      - { level: county, name: Santa Clara }
      - { level: city, name: Palo Alto }
  - id: mountain-view
    name: Mountain View
    kind: city
    jurisdictions:
      - { level: state, name: California }
      - { level: county, name: Santa Clara }
      - { level: city, name: Mountain View }
```

**Step 2: Sources**

`vote.santaclaracounty.gov` blocks automated fetches. Ask Sean to download the registrar's candidate list and measure list for Nov 3, 2026 (or the sample ballots for a Palo Alto and a Mountain View precinct) into `data/2026-11/sources/`. Supplement with the City of Palo Alto and City of Mountain View clerk election pages. Cross-check against https://www.kqed.org/voterguide/santaclara.

**Step 3: Contests (only what Palo Alto and Mountain View voters see)**

Add them under `# ---------- Santa Clara County (Palo Alto, Mountain View) ----------`, following the same rules as Task 20:
- Countywide measures and offices on both cities' ballots: `{ level: county, name: Santa Clara }`. These show on both area pages.
- Palo Alto and Mountain View council, measures (e.g. Palo Alto J, Mountain View E/F per the earlier investigation; confirm against the registrar) and mayor: `{ level: city, name: Palo Alto | Mountain View }`.
- Supervisor and school or special districts seen by both cities: `within: [{ level: county, name: Santa Clara }]`. Seen by one city only: `within: [{ level: city, name: <that city> }]`.
- `court-of-appeal-6` (retention), with the justices from the SoS certified list.
- Widen `rtm` and any shared state district (`us-rep-16`, `assembly-23`, `state-senate-13` if present) with `{ level: county, name: Santa Clara }`.
- ids: `santa-clara-county-measure-<x>`, `palo-alto-council`, `palo-alto-measure-<x>`, `mountain-view-council`, `mountain-view-measure-<x>`, `<district-slug>-…`.

**Step 4: Verify**

Run: `npm run validate && npm test && npm run build`
Expected: `data OK`, green, and `/2026-11/palo-alto` and `/2026-11/mountain-view` are generated. The Bay Area list shows "Santa Clara County", then "Mountain View" and "Palo Alto", after San Mateo.

**Step 5: Commit**

```bash
git add data/areas.yml data/2026-11/ballot.yml data/2026-11/sources
git commit -m "data: Palo Alto and Mountain View areas and their Santa Clara County contests"
```

---

### Task 30: Palo Alto and Mountain View guides from discovery

Same steps as Task 21, using the discovery output's Santa Clara section. Typical areas:
- `[palo-alto, mountain-view]` for countywide and Peninsula-wide guides
- `[palo-alto]` or `[mountain-view]` for city papers and clubs
- `[san-mateo, palo-alto, mountain-view]` for guides like Sierra Club Loma Prieta, Greenbelt Alliance or YIMBY chapter pages that cover both counties

Widen existing guides (e.g. `lwv-ca` to all four areas) as in Task 21 step 2.

Run: `npm run bb -- discover && npm run bb -- check && npm run validate`
Expected: `check OK` and `data OK`.

```bash
git add data/guides data/2026-11/endorsements
git commit -m "data: Palo Alto and Mountain View guides from the discovery pass"
```

---

### Task 31: Extract, verify and review (with Sean)

Same steps as Task 22, for the new and widened guide ids. Run `--force-extract` for guides whose areas widened but whose pages didn't change.

```bash
git add data/2026-11
git commit -m "data: extract and verify Palo Alto and Mountain View guides"
```

---

### Task 32: Copy and e2e for Palo Alto and Mountain View

**Files:**
- Modify: `src/app/about/page.tsx`, `e2e/areas.spec.ts`

**Step 1: Write the failing e2e test**

```ts
test("Palo Alto and Mountain View pages share Santa Clara County contests and keep their own", async ({ page }) => {
  for (const [slug, name, other] of [["palo-alto", "Palo Alto", "Mountain View"], ["mountain-view", "Mountain View", "Palo Alto"]] as const) {
    await page.goto(`${BALLOT}/${slug}`);
    await expect(page).toHaveTitle(`${name} endorsements (Nov 2026)`);
    await expect(page.getByRole("region", { name: "Santa Clara County", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: other, exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  }
});

test("the Counties filter lists all three counties", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop sidebar");
  await openBallot(page);
  const group = page.getByRole("complementary", { name: "Filters" }).getByRole("group", { name: "Counties" });
  for (const c of ["San Francisco", "San Mateo", "Santa Clara"]) await expect(group.getByRole("checkbox", { name: c, exact: true })).toBeChecked();
});
```

**Step 2: Run**

Run: `npm run e2e -- e2e/areas.spec.ts`
Expected: PASS once Tasks 29–31 are in. If it is run before them, it fails because there is no `/palo-alto` route.

**Step 3: Copy**

In the about page, "every San Francisco and San Mateo County voter guide's endorsements" becomes "every San Francisco, San Mateo County, Palo Alto and Mountain View voter guide's endorsements".

**Step 4: Verify and commit**

Run: `npm run build && npm run e2e`. Expected: green.

```bash
git add src/app/about/page.tsx e2e/areas.spec.ts
git commit -m "test(e2e): Palo Alto and Mountain View pages; about page names them"
```

---

### Task 33: Changelog entry for Palo Alto and Mountain View

```bash
cat > "data/changelog/$(date +%F)-palo-alto-mountain-view.yml" <<EOF
date: $(date +%F)
type: new
title: Palo Alto and Mountain View are on Bay Ballot, each with its own page
details: <N> guides and the Santa Clara County contests Palo Alto and Mountain View voters see.
EOF
npm run validate
git add data/changelog && git commit -m "docs: changelog entry for Palo Alto and Mountain View"
```
Expected: `data OK`.

---

### Task 34: Ship Phase 3

Same steps as Task 14, with branch `feat/peninsula-santa-clara` and title `feat: Palo Alto and Mountain View`.
- In step 2, expect only Tasks 28–33 commits.
- Fill in the changelog `pr:`, run `/finalize-pr-solo`, then stop and wait for Sean's go-ahead to merge.
