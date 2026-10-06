# Address Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** A visitor enters an SF address or ZIP and sees only the contests on their ballot; the address never leaves their browser, and only a short district code is remembered.

**Architecture:** A `bb districts` build command joins DataSF's base addresses to DataSF's precinct polygons (point-in-polygon at build time), runs the design's cross-checks, and writes a static index to `public/districts/sf/` (precinct → districts, ZIP → precincts, street names, and one house-number-range file per street), which is committed. In the browser, a pure lookup module parses the input, fetches only `zips.json`, `streets.json`, `precincts.json` and the one street file it needs, and returns a district set. The set is stored as `?d=sf.s8.a17.c11.b8.e2` in the URL and in localStorage, and `onBallot()` filters contests by `Contest.jurisdiction`.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, Base UI (`@base-ui/react` 1.8 `Autocomplete`) with the repo's shadcn wrappers, Vitest, Playwright, `tsx` CLI (`npm run bb`). New dev dependencies: `shapefile` + `@types/shapefile` (reads the Prop 50 shapefile). Point-in-polygon is a tested ray-casting implementation in this repo; no geo library.

**Design doc:** `docs/plans/2026-10-06-address-filter-design.md` (approved). **Data sources:** `docs/investigations/2026-10-06-sf-address-district-data.md`.

---

## Read first

- **Districted contests.** 11 of 52 contests have `jurisdiction.level: district`. `jurisdiction.name` is one of `Supervisor`, `Assembly`, `Congress`, `BART`, `Board of Equalization`, and `jurisdiction.district` is a string number (`"8"`). Every other contest (state, county, city) is on every SF ballot.
- **District code.** `sf.s<sup>.a<assembly>.c<congress>.b<bart>.e<boe>`, always in that order, county prefix first. The design's example (`sf.s8.a17.c11.b8`) omits BOE; this plan includes `e2` so the code fully describes a precinct and generalizes to counties that span two BOE districts. The visible summary still omits BOE, as in the design ("Supervisor 8 · Assembly 17 · Congress 11 · BART 8").
- **Verified source facts (2026-10-06).** Re-verify them in Task 11 before generating.
  - Addresses: Socrata JSON API `https://data.sf.gov/resource/3mea-di5p.json`, 224,394 rows. Fields used: `address_number` (string int), `address_number_suffix` (`A`, `B`, `½`, … ignored), `street_full_street_name` (`UTAH ST`, `03RD ST`, `04TH TI ST`, `BROADWAY`, `AVENUE B`), `zip_code` (27 values), `longitude`, `latitude` (WGS84 strings), `supervisor` (`"6"`).
  - Precincts: `https://data.sf.gov/api/geospatial/d6x4-hefw?method=export&format=GeoJSON`, 514 features, MultiPolygon in WGS84. Properties: `prec_2022` (id), `supe22`, `assemb22`, `cong22`, `bart22`, `boe22`.
  - Prop 50 (AB 604) congressional map: `https://statewidedatabase.org/pub/data/d25/AB604%202025-08-16.zip` (shapefile; `AB604.zip` on the same server is the block equivalency CSV, not the shapes). `.prj` is `GEOGCS["GCS_North_American_1983"…]`, i.e. lon/lat NAD83, so **no reprojection** is needed (NAD83 and WGS84 differ by about 1–2 m; the congress check is a per-precinct majority, so that can't flip it). The build refuses a projected `.prj` instead of guessing. District field: `DISTRICT` (character, `"1"`…`"52"`).
  - SF Elections voter lookup: `https://sfelections.org/tools/portal/` (title "Voter Portal", HTTP 200). The older `voterstatus.sfelections.org` host does not answer.
- **Street names normalize the same way on both sides.** The build normalizes EAS names and the browser normalizes what the visitor typed with the same `normalizeStreet()`. Any rule is safe as long as it is applied to both; the risk is two real streets collapsing into one key (e.g. EAS has both `SIXTH ST` and `06TH ST`). The build handles that: a house number that lands in two precincts under one key is stored as ambiguous and looks up as "not found".
- **Odd and even sides are separate.** Precinct lines often run down the middle of a street, so ranges are compressed per parity.
- **Privacy.** The address lives only in React state inside `AddressBox`. Never write it to the URL, localStorage, analytics, or a log. Note: the browser does request `/districts/sf/streets/<street>.json`, so the street name (never the house number) reaches our own static host's access logs. That is inherent in the approved per-street layout; see "Open questions".
- **Client code must not import zod** (repo rule, see `src/lib/filters.ts`). Everything under `src/lib/` added here is plain TypeScript.
- **Comments:** only when a comment prevents a specific wrong edit.
- **Commands:** unit tests `npx vitest run tests/<file>.test.ts`; all unit tests `npm test`; types `npx next typegen && npx tsc --noEmit`; lint `npm run lint`; e2e `npx playwright test e2e/<file>.spec.ts` (builds the app first, about 2 minutes).

## Files (target)

```
src/lib/districts.ts          district code, onBallot, summary text, initialDistricts, VOTER_PORTAL
src/lib/address.ts            normalizeStreet, streetSlug, displayStreet, parseAddress, isZip, streetIndex, suggestStreets, findStreet
src/lib/ranges.ts             compressRanges, findPrecinct
src/lib/address-lookup.ts     httpLookup (fetch + cache), resolveInput
src/pipeline/geo.ts           point-in-polygon, bbox index
src/pipeline/district-sources.ts   download cache, DataSF + Prop 50 loaders
src/pipeline/districts.ts     buildDistricts (join + checks + files), writeDistrictFiles, generateDistricts
src/components/AddressBox.tsx
src/components/useBallotFilters.ts  + useDistricts
public/districts/sf/{precincts.json,streets.json,zips.json,streets/<slug>.json}   generated, committed
tests/{districts,address,ranges,geo,district-sources,districts-build,district-data,address-lookup}.test.ts
tests/fixtures/districts.ts
e2e/address.spec.ts
```

---

### Task 1: District codes and the on-ballot predicate

**Files:**
- Create: `src/lib/districts.ts`
- Test: `tests/districts.test.ts`

**Step 1: Write the failing test**

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import {
  ballotLine, decodeDistricts, districtKind, districtSummary, encodeDistricts, initialDistricts, onBallot, splitBallot,
  type DistrictSet,
} from "@/lib/districts";
import type { Contest } from "@/lib/schema";

const s8: DistrictSet = { county: "sf", districts: { supervisor: "8", assembly: "17", congress: "11", bart: "8", boe: "2" } };
const contest = (jurisdiction: Contest["jurisdiction"]) => ({ jurisdiction });

describe("district code", () => {
  it("encodes in a fixed order with the county prefix", () => {
    expect(encodeDistricts(s8)).toBe("sf.s8.a17.c11.b8.e2");
  });
  it("round-trips", () => {
    expect(decodeDistricts(encodeDistricts(s8))).toEqual(s8);
  });
  it("drops leading zeros", () => {
    expect(decodeDistricts("sf.s08.a17.c11.b8.e2")?.districts.supervisor).toBe("8");
  });
  it.each([
    "",
    "sf",
    "la.s8.a17.c11.b8.e2",
    "sf.s8.a17.c11.b8",
    "sf.a17.s8.c11.b8.e2",
    "sf.s8.a17.c11.b8.e2.x1",
    "sf.sx.a17.c11.b8.e2",
    "sf.s8.a17.c11.b8.e2;alert(1)",
  ])("rejects %j", (code) => {
    expect(decodeDistricts(code)).toBeNull();
  });
  it("rejects null", () => {
    expect(decodeDistricts(null)).toBeNull();
  });
});

describe("onBallot", () => {
  it("keeps state, county and city contests", () => {
    expect(onBallot(contest({ level: "state", name: "California" }), s8)).toBe(true);
    expect(onBallot(contest({ level: "county", name: "Bay Area region" }), s8)).toBe(true);
    expect(onBallot(contest({ level: "city", name: "San Francisco" }), s8)).toBe(true);
  });
  it("keeps a district contest only when the visitor's district matches", () => {
    expect(onBallot(contest({ level: "district", name: "Supervisor", district: "8" }), s8)).toBe(true);
    expect(onBallot(contest({ level: "district", name: "Supervisor", district: "6" }), s8)).toBe(false);
    expect(onBallot(contest({ level: "district", name: "BART", district: "8" }), s8)).toBe(true);
    expect(onBallot(contest({ level: "district", name: "Board of Equalization", district: "2" }), s8)).toBe(true);
  });
  it("keeps everything when no districts are set", () => {
    expect(onBallot(contest({ level: "district", name: "Supervisor", district: "6" }), null)).toBe(true);
  });
  it("keeps a district contest of a kind it doesn't know", () => {
    expect(onBallot(contest({ level: "district", name: "Water Board", district: "3" }), s8)).toBe(true);
  });
});

describe("text", () => {
  it("summarizes districts without the citywide BOE district", () => {
    expect(districtSummary(s8)).toBe("Supervisor 8 · Assembly 17 · Congress 11 · BART 8");
  });
  it("counts contests shown and hidden", () => {
    expect(ballotLine({ shown: 41, hidden: 11 })).toBe("41 contests on your ballot · 11 others hidden");
    expect(ballotLine({ shown: 1, hidden: 1 })).toBe("1 contest on your ballot · 1 other hidden");
    expect(ballotLine({ shown: 52, hidden: 0 })).toBe("52 contests on your ballot");
  });
});

describe("initialDistricts", () => {
  const code = "sf.s6.a17.c11.b9.e2";
  it("prefers the URL", () => {
    expect(initialDistricts({ query: `?d=${code}`, stored: encodeDistricts(s8) })?.districts.supervisor).toBe("6");
  });
  it("treats an invalid URL code as none, without falling back to storage", () => {
    expect(initialDistricts({ query: "?d=junk", stored: encodeDistricts(s8) })).toBeNull();
  });
  it("falls back to storage when the URL has no code", () => {
    expect(initialDistricts({ query: "?c=prop-b", stored: code })?.districts.bart).toBe("9");
  });
  it("is null with neither", () => {
    expect(initialDistricts({ query: "", stored: null })).toBeNull();
  });
});

describe("the Nov 2026 ballot", () => {
  const { ballot } = loadElection(path.join(process.cwd(), "data"), "2026-11");

  it("names a known district kind for every districted contest", () => {
    const unknown = ballot.contests.filter((c) => c.jurisdiction.level === "district" && districtKind(c.jurisdiction) === null);
    expect(unknown.map((c) => c.id)).toEqual([]);
  });

  it("hides the 7 contests outside Supervisor 6, Assembly 17, Congress 11, BART 9", () => {
    const { shown, hidden } = splitBallot(ballot.contests, decodeDistricts("sf.s6.a17.c11.b9.e2"));
    expect(hidden.map((c) => c.id).sort()).toEqual([
      "assembly-19", "bart-8", "supervisor-10", "supervisor-2", "supervisor-4", "supervisor-8", "us-rep-15",
    ]);
    expect(shown).toHaveLength(45);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/districts.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/districts"`.

**Step 3: Write minimal implementation**

`src/lib/districts.ts`:

```ts
import type { Contest, Jurisdiction } from "./schema";

export const KINDS = [
  { kind: "supervisor", letter: "s", jurisdiction: "Supervisor", label: "Supervisor", summary: true },
  { kind: "assembly", letter: "a", jurisdiction: "Assembly", label: "Assembly", summary: true },
  { kind: "congress", letter: "c", jurisdiction: "Congress", label: "Congress", summary: true },
  { kind: "bart", letter: "b", jurisdiction: "BART", label: "BART", summary: true },
  { kind: "boe", letter: "e", jurisdiction: "Board of Equalization", label: "Board of Equalization", summary: false },
] as const;

export type DistrictKind = (typeof KINDS)[number]["kind"];
export type Districts = Record<DistrictKind, string>;
export type DistrictSet = { county: string; districts: Districts };

export const COUNTIES: readonly string[] = ["sf"];
export const VOTER_PORTAL = "https://sfelections.org/tools/portal/";

export function encodeDistricts({ county, districts }: DistrictSet): string {
  return [county, ...KINDS.map((k) => `${k.letter}${districts[k.kind]}`)].join(".");
}

export function decodeDistricts(code: string | null | undefined): DistrictSet | null {
  if (!code) return null;
  const [county, ...parts] = code.split(".");
  if (!COUNTIES.includes(county) || parts.length !== KINDS.length) return null;
  const districts = {} as Districts;
  for (const [i, k] of KINDS.entries()) {
    const m = /^([a-z])(\d{1,3})$/.exec(parts[i]);
    if (!m || m[1] !== k.letter) return null;
    districts[k.kind] = String(Number(m[2]));
  }
  return { county, districts };
}

const BY_JURISDICTION = new Map<string, DistrictKind>(KINDS.map((k) => [k.jurisdiction, k.kind]));

export function districtKind(j: Pick<Jurisdiction, "level" | "name">): DistrictKind | null {
  return j.level === "district" ? (BY_JURISDICTION.get(j.name) ?? null) : null;
}

export function onBallot(contest: Pick<Contest, "jurisdiction">, set: DistrictSet | null): boolean {
  if (!set) return true;
  const kind = districtKind(contest.jurisdiction);
  return kind === null || contest.jurisdiction.district === set.districts[kind];
}

export function splitBallot<C extends Pick<Contest, "jurisdiction">>(contests: C[], set: DistrictSet | null): { shown: C[]; hidden: C[] } {
  const shown: C[] = [];
  const hidden: C[] = [];
  for (const c of contests) (onBallot(c, set) ? shown : hidden).push(c);
  return { shown, hidden };
}

export function districtSummary({ districts }: DistrictSet): string {
  return KINDS.filter((k) => k.summary)
    .map((k) => `${k.label} ${districts[k.kind]}`)
    .join(" · ");
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ballotLine({ shown, hidden }: { shown: number; hidden: number }): string {
  const on = `${plural(shown, "contest")} on your ballot`;
  return hidden ? `${on} · ${hidden} ${hidden === 1 ? "other" : "others"} hidden` : on;
}

export function initialDistricts({ query, stored }: { query: string; stored: string | null }): DistrictSet | null {
  const p = new URLSearchParams(query);
  return p.has("d") ? decodeDistricts(p.get("d")) : decodeDistricts(stored);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/districts.test.ts`
Expected: PASS (all tests).

**Step 5: Commit**

```bash
git add src/lib/districts.ts tests/districts.test.ts
git commit -m "feat(districts): district code and on-ballot predicate"
```

---

### Task 2: Street normalization, slugs and display names

**Files:**
- Create: `src/lib/address.ts`
- Test: `tests/address.test.ts`

Shared by the build (EAS names) and the browser (what the visitor typed).

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { displayStreet, normalizeStreet, streetSlug } from "@/lib/address";

describe("normalizeStreet", () => {
  it.each([
    ["Mission St", "MISSION ST"],
    ["MISSION STREET", "MISSION ST"],
    ["mission st.", "MISSION ST"],
    ["3rd St", "3RD ST"],
    ["Third Street", "3RD ST"],
    ["03RD ST", "3RD ST"],
    ["3 St", "3RD ST"],
    ["Twenty-First St", "21ST ST"],
    ["21st Street", "21ST ST"],
    ["19th Ave", "19TH AVE"],
    ["Nineteenth Avenue", "19TH AVE"],
    ["19 Av", "19TH AVE"],
    ["11th St", "11TH ST"],
    ["S Van Ness Ave", "SOUTH VAN NESS AVE"],
    ["South Van Ness Avenue", "SOUTH VAN NESS AVE"],
    ["W Portal Ave", "WEST PORTAL AVE"],
    ["St Francis Blvd", "SAINT FRANCIS BLVD"],
    ["St. Francis Boulevard", "SAINT FRANCIS BLVD"],
    ["Saint Francis Blvd", "SAINT FRANCIS BLVD"],
    ["Mt Vernon Ave", "MOUNT VERNON AVE"],
    ["St. Mary's Ave", "SAINT MARYS AVE"],
    ["Mayor Edwin M. Lee Ave", "MAYOR EDWIN M LEE AVE"],
    ["Lapu-Lapu St", "LAPU LAPU ST"],
    ["Avenue B", "AVENUE B"],
    ["The Embarcadero", "THE EMBARCADERO"],
    ["Broadway", "BROADWAY"],
    ["04TH TI ST", "4TH TI ST"],
    ["Dr Carlton B Goodlett Pl", "DR CARLTON B GOODLETT PL"],
    ["Calle Ñandú", "CALLE NANDU"],
    ["  ", ""],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeStreet(input)).toBe(expected);
  });

  it("leaves the last token alone in partial mode, so a half-typed word still prefixes", () => {
    expect(normalizeStreet("Mission Stre", { partial: true })).toBe("MISSION STRE");
    expect(normalizeStreet("1", { partial: true })).toBe("1");
    expect(normalizeStreet("Thi", { partial: true })).toBe("THI");
    expect(normalizeStreet("S Van N", { partial: true })).toBe("SOUTH VAN N");
  });

  it("is idempotent on its own display names", () => {
    for (const raw of ["03RD ST", "SAINT FRANCIS BLVD", "04TH TI ST", "MRS. JACKSON WAY", "AVENUE OF THE PALMS"]) {
      const key = normalizeStreet(raw);
      expect(normalizeStreet(displayStreet(key))).toBe(key);
    }
  });
});

describe("streetSlug", () => {
  it("lowercases and dashes the key", () => {
    expect(streetSlug("3RD ST")).toBe("3rd-st");
    expect(streetSlug("SAINT FRANCIS BLVD")).toBe("saint-francis-blvd");
  });
});

describe("displayStreet", () => {
  it.each([
    ["3RD ST", "3rd St"],
    ["SAINT FRANCIS BLVD", "Saint Francis Blvd"],
    ["4TH TI ST", "4th TI St"],
    ["MRS JACKSON WAY", "Mrs Jackson Way"],
  ])("%j -> %j", (key, expected) => {
    expect(displayStreet(key)).toBe(expected);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/address.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/address"`.

**Step 3: Write minimal implementation**

`src/lib/address.ts`:

```ts
const LONG = new Map([
  ["ST", "STREET"], ["AVE", "AVENUE"], ["BLVD", "BOULEVARD"], ["DR", "DRIVE"], ["TER", "TERRACE"],
  ["CT", "COURT"], ["LN", "LANE"], ["PL", "PLACE"], ["RD", "ROAD"], ["CIR", "CIRCLE"], ["HWY", "HIGHWAY"],
  ["ALY", "ALLEY"], ["PLZ", "PLAZA"], ["STWY", "STAIRWAY"], ["XING", "CROSSING"],
]);
const SAME = ["WAY", "PARK", "LOOP", "ROW", "WALK"];
const TYPES = new Map<string, string>([
  ...[...LONG.keys(), ...SAME].map((t): [string, string] => [t, t]),
  ...[...LONG].map(([short, long]): [string, string] => [long, short]),
  ["STR", "ST"],
  ["AV", "AVE"],
]);
const FIRST = new Map([["ST", "SAINT"], ["MT", "MOUNT"], ["N", "NORTH"], ["S", "SOUTH"], ["E", "EAST"], ["W", "WEST"]]);
const UNITS = [
  "", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH",
  "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH",
];
const TENS = new Map([["TWENTY", 20], ["THIRTY", 30], ["FORTY", 40]]);
const TENTHS = new Map([["TWENTIETH", 20], ["THIRTIETH", 30], ["FORTIETH", 40]]);
const UPPER = new Set(["TI"]);

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "TH" : (["TH", "ST", "ND", "RD"][n % 10] ?? "TH")}`;
}

function tokens(raw: string): string[] {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/['’.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function ordinals(t: string[], skipLast: boolean): string[] {
  const end = skipLast ? t.length - 1 : t.length;
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    if (i >= end) {
      out.push(t[i]);
      continue;
    }
    const tens = TENS.get(t[i]);
    const unit = UNITS.indexOf(t[i + 1] ?? "");
    if (tens !== undefined && i + 1 < end && unit > 0 && unit < 10) {
      out.push(ordinal(tens + unit));
      i++;
      continue;
    }
    const word = UNITS.indexOf(t[i]);
    const tenth = TENTHS.get(t[i]);
    const num = /^0*(\d+)(ST|ND|RD|TH)?$/.exec(t[i]);
    if (word > 0) out.push(ordinal(word));
    else if (tenth !== undefined) out.push(ordinal(tenth));
    else if (num && (num[2] || i < t.length - 1)) out.push(ordinal(Number(num[1])));
    else out.push(t[i]);
  }
  return out;
}

export function normalizeStreet(raw: string, { partial = false }: { partial?: boolean } = {}): string {
  const t = tokens(raw);
  if (t.length === 0) return "";
  const last = t.length - 1;
  if (t.length >= 2) t[0] = FIRST.get(t[0]) ?? t[0];
  if (!partial && t.length >= 2) t[last] = TYPES.get(t[last]) ?? t[last];
  return ordinals(t, partial).join(" ");
}

export function streetSlug(key: string): string {
  return key.toLowerCase().replace(/ /g, "-");
}

export function displayStreet(key: string): string {
  return key
    .split(" ")
    .map((w) => (UPPER.has(w) ? w : /^\d/.test(w) ? w.toLowerCase() : w[0] + w.slice(1).toLowerCase()))
    .join(" ");
}

export function longForm(key: string): string {
  const t = key.split(" ");
  const long = t.length >= 2 ? LONG.get(t[t.length - 1]) : undefined;
  return long ? [...t.slice(0, -1), long].join(" ") : key;
}

export function baseStreet(key: string): string {
  const t = key.split(" ");
  return t.length >= 2 && TYPES.has(t[t.length - 1]) ? t.slice(0, -1).join(" ") : key;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/address.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/address.ts tests/address.test.ts
git commit -m "feat(address): street normalization shared by build and browser"
```

---

### Task 3: Address parsing (house number, suffix, unit, ZIP)

**Files:**
- Modify: `src/lib/address.ts` (append)
- Test: `tests/address.test.ts` (append)

Rules: the house number is the leading integer. A letter suffix (`123A`) or a half (`123½`, `123 1/2`) is kept in `suffix` for display and **ignored for lookup**: ranges are built from integer numbers, and EAS stores the suffix separately. A range (`123-125`) uses its first number. Units (`#4`, `Apt 4`, `Unit 4`, `Ste 4`) and a trailing city, state and ZIP are stripped; the ZIP is returned.

**Step 1: Write the failing test**

Append to `tests/address.test.ts` (and add `isZip, parseAddress` to its import):

```ts
describe("parseAddress", () => {
  it.each([
    ["128 Utah St", { number: 128, suffix: "", street: "UTAH ST", zip: null }],
    ["128 Utah Street, San Francisco, CA 94103", { number: 128, suffix: "", street: "UTAH ST", zip: "94103" }],
    ["128 utah st san francisco ca 94103-1234", { number: 128, suffix: "", street: "UTAH ST", zip: "94103" }],
    ["128 Utah St #4", { number: 128, suffix: "", street: "UTAH ST", zip: null }],
    ["128 Utah St Apt 4B", { number: 128, suffix: "", street: "UTAH ST", zip: null }],
    ["128 Utah St, Unit 2", { number: 128, suffix: "", street: "UTAH ST", zip: null }],
    ["123A Main St", { number: 123, suffix: "A", street: "MAIN ST", zip: null }],
    ["123½ Main St", { number: 123, suffix: "½", street: "MAIN ST", zip: null }],
    ["123 1/2 Main St", { number: 123, suffix: "½", street: "MAIN ST", zip: null }],
    ["123-125 Main St", { number: 123, suffix: "", street: "MAIN ST", zip: null }],
    ["100 Avenue B", { number: 100, suffix: "", street: "AVENUE B", zip: null }],
    ["1 Dr Carlton B Goodlett Pl", { number: 1, suffix: "", street: "DR CARLTON B GOODLETT PL", zip: null }],
    ["2000 Third Street", { number: 2000, suffix: "", street: "3RD ST", zip: null }],
  ])("%j", (input, expected) => {
    expect(parseAddress(input)).toEqual(expected);
  });

  it.each(["", "Utah St", "94103", "128", "#4"])("returns null for %j", (input) => {
    expect(parseAddress(input)).toBeNull();
  });
});

describe("isZip", () => {
  it("accepts exactly five digits", () => {
    expect(isZip(" 94103 ")).toBe(true);
    expect(isZip("9410")).toBe(false);
    expect(isZip("94103-1234")).toBe(false);
    expect(isZip("128 Utah St")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/address.test.ts`
Expected: FAIL with `parseAddress is not a function` (or a TypeScript import error naming `parseAddress`).

**Step 3: Write minimal implementation**

Append to `src/lib/address.ts`:

```ts
export type ParsedAddress = { number: number; suffix: string; street: string; zip: string | null };

export const isZip = (s: string) => /^\d{5}$/.test(s.trim());

export function parseAddress(input: string): ParsedAddress | null {
  let s = input.replace(/½/g, " 1/2").toUpperCase().trim();
  let zip: string | null = null;
  const z = /[\s,]+(\d{5})(?:-\d{4})?$/.exec(s);
  if (z) {
    zip = z[1];
    s = s.slice(0, z.index);
  }
  s = s.replace(/(?:[\s,]+(?:SAN FRANCISCO|SF))?(?:[\s,]+(?:CA|CALIFORNIA))?[\s,]*$/, "");
  const line = s
    .split(",")[0]
    .trim()
    .replace(/\s*(?:#\s*\S+|\b(?:APT|UNIT|STE|SUITE|RM|ROOM|FL|FLOOR)\b\.?\s*\S+)$/, "");
  const m = /^(\d+)(?:-\d+)?(?:\s*(1\/2)|([A-Z])(?=\s))?\s+(.+)$/.exec(line);
  if (!m) return null;
  const street = normalizeStreet(m[4]);
  if (!street) return null;
  return { number: Number(m[1]), suffix: m[2] ? "½" : (m[3] ?? ""), street, zip };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/address.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/address.ts tests/address.test.ts
git commit -m "feat(address): parse house number, suffix, unit and ZIP"
```

---

### Task 4: Street suggestions and street matching

**Files:**
- Modify: `src/lib/address.ts` (append)
- Test: `tests/address.test.ts` (append)

`streets.json` holds display names. `streetIndex()` pairs each with its key; `suggestStreets()` powers the autocomplete; `findStreet()` resolves what the visitor submitted, falling back to a type-less match when it is unique ("128 Utah" → Utah St; "Broadway St" → Broadway; "19th" stays ambiguous between 19th Ave and 19th St).

**Step 1: Write the failing test**

Append (and add `findStreet, streetIndex, suggestStreets` to the import):

```ts
const index = streetIndex(["10th Ave", "19th Ave", "19th St", "1st St", "3rd St", "Broadway", "Mission Bay Blvd", "Mission St", "Saint Francis Blvd", "Utah St"]);

describe("suggestStreets", () => {
  it("needs a house number and the start of a street", () => {
    expect(suggestStreets(index, "Mission")).toEqual([]);
    expect(suggestStreets(index, "128")).toEqual([]);
  });
  it("prefixes the visitor's number to matching streets, in natural order", () => {
    expect(suggestStreets(index, "128 Mis")).toEqual(["128 Mission Bay Blvd", "128 Mission St"]);
    expect(suggestStreets(index, "5 1")).toEqual(["5 1st St", "5 10th Ave", "5 19th Ave", "5 19th St"]);
  });
  it("matches spelled-out ordinals, saints, and half-typed long street types", () => {
    expect(suggestStreets(index, "5 Third")).toEqual(["5 3rd St"]);
    expect(suggestStreets(index, "5 St Fran")).toEqual(["5 Saint Francis Blvd"]);
    expect(suggestStreets(index, "5 Mission Stre")).toEqual(["5 Mission St"]);
  });
  it("keeps a suffix on the number", () => {
    expect(suggestStreets(index, "123A Uta")).toEqual(["123A Utah St"]);
  });
  it("caps the list", () => {
    expect(suggestStreets(index, "5 1", 2)).toHaveLength(2);
  });
});

describe("findStreet", () => {
  it("matches the exact key", () => {
    expect(findStreet(index, "UTAH ST")?.display).toBe("Utah St");
  });
  it("falls back to a unique street with the same name and another or no type", () => {
    expect(findStreet(index, "UTAH")?.display).toBe("Utah St");
    expect(findStreet(index, "BROADWAY ST")?.display).toBe("Broadway");
  });
  it("gives up when the name alone is ambiguous or unknown", () => {
    expect(findStreet(index, "19TH")).toBeNull();
    expect(findStreet(index, "NOWHERE ST")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/address.test.ts`
Expected: FAIL naming `streetIndex` / `suggestStreets` / `findStreet`.

**Step 3: Write minimal implementation**

Append to `src/lib/address.ts`:

```ts
export type StreetEntry = { key: string; display: string };

export function streetIndex(streets: string[]): StreetEntry[] {
  return streets.map((display) => ({ key: normalizeStreet(display), display }));
}

const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export function suggestStreets(index: StreetEntry[], input: string, limit = 8): string[] {
  const m = /^\s*(\d+(?:[A-Za-z]|\s*1\/2|½)?)\s+(\S.*)$/.exec(input);
  if (!m) return [];
  const qs = [normalizeStreet(m[2], { partial: true }), normalizeStreet(m[2])].filter(Boolean);
  return index
    .filter((s) => qs.some((q) => s.key.startsWith(q) || longForm(s.key).startsWith(q)))
    .sort((a, b) => natural(a.key, b.key))
    .slice(0, limit)
    .map((s) => `${m[1]} ${s.display}`);
}

export function findStreet(index: StreetEntry[], key: string): StreetEntry | null {
  const exact = index.find((s) => s.key === key);
  if (exact) return exact;
  const base = baseStreet(key);
  const same = index.filter((s) => baseStreet(s.key) === base);
  return same.length === 1 ? same[0] : null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/address.test.ts`
Expected: PASS. If the natural-order assertion fails, print the actual order and check `localeCompare` with `numeric: true` sorts `1ST ST` before `10TH AVE`; do not change the expected order.

**Step 5: Commit**

```bash
git add src/lib/address.ts tests/address.test.ts
git commit -m "feat(address): street suggestions and matching"
```

---

### Task 5: House-number range compression and lookup

**Files:**
- Create: `src/lib/ranges.ts`
- Test: `tests/ranges.test.ts`

A street file is `{ odd: Range[], even: Range[] }` where `Range = [lo, hi, precinct | null]`. Consecutive known numbers on one side that share a precinct collapse into one range. A number found in two precincts (two buildings, or two EAS streets that normalize to one key) becomes `null`: the lookup says "not found" rather than guess. A number between two known numbers of the same range takes that range's precinct; a number outside every range is not found.

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { compressRanges, findPrecinct } from "@/lib/ranges";

const pts = (precinct: string, ...numbers: number[]) => numbers.map((number) => ({ number, precinct }));

describe("compressRanges", () => {
  it("collapses runs per side of the street", () => {
    expect(compressRanges([...pts("A", 101, 103, 105, 100, 102), ...pts("B", 107, 109, 104)])).toEqual({
      odd: [[101, 105, "A"], [107, 109, "B"]],
      even: [[100, 102, "A"], [104, 104, "B"]],
    });
  });
  it("splits a run when the precinct changes and changes back", () => {
    expect(compressRanges([...pts("A", 1, 3), ...pts("B", 5), ...pts("A", 7)]).odd).toEqual([[1, 3, "A"], [5, 5, "B"], [7, 7, "A"]]);
  });
  it("marks a number found in two precincts as ambiguous", () => {
    expect(compressRanges([...pts("A", 1, 3), ...pts("B", 3), ...pts("A", 5)]).odd).toEqual([[1, 1, "A"], [3, 3, null], [5, 5, "A"]]);
  });
  it("is independent of input order and duplicates", () => {
    expect(compressRanges([...pts("A", 5, 1, 3, 3)]).odd).toEqual([[1, 5, "A"]]);
  });
});

describe("findPrecinct", () => {
  const file = compressRanges([...pts("A", 101, 105), ...pts("B", 111), ...pts("A", 100), ...pts("C", 100)]);
  it("finds a number inside a range, including unlisted numbers between its ends", () => {
    expect(findPrecinct(file, 101)).toBe("A");
    expect(findPrecinct(file, 103)).toBe("A");
    expect(findPrecinct(file, 111)).toBe("B");
  });
  it("returns null outside every range, between ranges, and for ambiguous numbers", () => {
    expect(findPrecinct(file, 99)).toBeNull();
    expect(findPrecinct(file, 107)).toBeNull();
    expect(findPrecinct(file, 113)).toBeNull();
    expect(findPrecinct(file, 100)).toBeNull();
  });
  it("searches long files", () => {
    const many = compressRanges(Array.from({ length: 2000 }, (_, i) => ({ number: i * 2 + 1, precinct: String(Math.floor(i / 3)) })));
    expect(findPrecinct(many, 3001)).toBe(String(Math.floor(1500 / 3)));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ranges.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/ranges"`.

**Step 3: Write minimal implementation**

`src/lib/ranges.ts`:

```ts
export type Range = [lo: number, hi: number, precinct: string | null];
export type StreetFile = { odd: Range[]; even: Range[] };
export type NumberedPoint = { number: number; precinct: string };

function side(points: NumberedPoint[]): Range[] {
  const at = new Map<number, string | null>();
  for (const p of points) {
    const seen = at.get(p.number);
    at.set(p.number, seen === undefined || seen === p.precinct ? p.precinct : null);
  }
  const out: Range[] = [];
  for (const n of [...at.keys()].sort((a, b) => a - b)) {
    const precinct = at.get(n) ?? null;
    const last = out.at(-1);
    if (last && last[2] === precinct) last[1] = n;
    else out.push([n, n, precinct]);
  }
  return out;
}

export function compressRanges(points: NumberedPoint[]): StreetFile {
  return { odd: side(points.filter((p) => p.number % 2 === 1)), even: side(points.filter((p) => p.number % 2 === 0)) };
}

export function findPrecinct(file: StreetFile, n: number): string | null {
  const ranges = n % 2 === 1 ? file.odd : file.even;
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b, precinct] = ranges[mid];
    if (n < a) hi = mid - 1;
    else if (n > b) lo = mid + 1;
    else return precinct;
  }
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ranges.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/ranges.ts tests/ranges.test.ts
git commit -m "feat(districts): house-number range compression and lookup"
```

---

### Task 6: Point-in-polygon

**Files:**
- Create: `src/pipeline/geo.ts`
- Test: `tests/geo.test.ts`

Even-odd ray casting per GeoJSON polygon: inside the outer ring and outside every hole. MultiPolygon is inside if any part is. A bbox prefilter keeps 224k addresses × 514 precincts fast.

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { inGeometry, makeIndex, type Geometry } from "@/pipeline/geo";

const ring = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const square: Geometry = { type: "Polygon", coordinates: [ring(0, 0, 10, 10)] };
const donut: Geometry = { type: "Polygon", coordinates: [ring(0, 0, 10, 10), ring(4, 4, 6, 6)] };
const two: Geometry = { type: "MultiPolygon", coordinates: [[ring(0, 0, 1, 1)], [ring(5, 5, 6, 6), ring(5.4, 5.4, 5.6, 5.6)]] };
const triangle: Geometry = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [0, 10], [0, 0]]] };

describe("inGeometry", () => {
  it("handles a simple polygon", () => {
    expect(inGeometry(5, 5, square)).toBe(true);
    expect(inGeometry(11, 5, square)).toBe(false);
    expect(inGeometry(-1, -1, square)).toBe(false);
  });
  it("excludes holes", () => {
    expect(inGeometry(2, 2, donut)).toBe(true);
    expect(inGeometry(5, 5, donut)).toBe(false);
  });
  it("handles every part of a MultiPolygon, with its holes", () => {
    expect(inGeometry(0.5, 0.5, two)).toBe(true);
    expect(inGeometry(5.2, 5.2, two)).toBe(true);
    expect(inGeometry(5.5, 5.5, two)).toBe(false);
    expect(inGeometry(3, 3, two)).toBe(false);
  });
  it("handles slanted edges", () => {
    expect(inGeometry(4, 4, triangle)).toBe(true);
    expect(inGeometry(6, 6, triangle)).toBe(false);
  });
  it("ignores ring orientation", () => {
    const reversed: Geometry = { type: "Polygon", coordinates: [ring(0, 0, 10, 10).reverse()] };
    expect(inGeometry(5, 5, reversed)).toBe(true);
  });
});

describe("makeIndex", () => {
  it("returns the value of the polygon containing the point, or null", () => {
    const locate = makeIndex([
      { geometry: { type: "Polygon", coordinates: [ring(0, 0, 1, 1)] }, value: "A" },
      { geometry: { type: "Polygon", coordinates: [ring(1, 0, 2, 1)] }, value: "B" },
      { geometry: donut, value: "C" },
    ]);
    expect(locate(0.5, 0.5)).toBe("A");
    expect(locate(1.5, 0.5)).toBe("B");
    expect(locate(5, 5)).toBeNull();
    expect(locate(8, 8)).toBe("C");
    expect(locate(50, 50)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/geo.test.ts`
Expected: FAIL with `Failed to resolve import "@/pipeline/geo"`.

**Step 3: Write minimal implementation**

`src/pipeline/geo.ts`:

```ts
export type Position = number[];
export type Geometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };

function inRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, [outer, ...holes]: Position[][]): boolean {
  return inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h));
}

export function inGeometry(x: number, y: number, g: Geometry): boolean {
  return g.type === "Polygon" ? inPolygon(x, y, g.coordinates) : g.coordinates.some((p) => inPolygon(x, y, p));
}

function bbox(g: Geometry): [number, number, number, number] {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polys) {
    for (const [x, y] of poly[0]) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return [x0, y0, x1, y1];
}

export function makeIndex<T>(items: { geometry: Geometry; value: T }[]): (x: number, y: number) => T | null {
  const boxed = items.map((it) => ({ ...it, box: bbox(it.geometry) }));
  return (x, y) => {
    for (const { box, geometry, value } of boxed) {
      if (x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inGeometry(x, y, geometry)) return value;
    }
    return null;
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/geo.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pipeline/geo.ts tests/geo.test.ts
git commit -m "feat(districts): point-in-polygon with holes and MultiPolygon"
```

---
### Task 7: Source loaders with a download cache

**Files:**
- Modify: `package.json` (devDependencies, via npm), `.gitignore`
- Create: `src/pipeline/district-sources.ts`
- Test: `tests/district-sources.test.ts`

The network is injected (`SourceDeps.fetch`), so tests never touch it. Downloads are cached under `.cache/districts/` (gitignored); `--refresh` refetches.

**Step 1: Add the dependency and the cache ignore**

```bash
npm install --save-dev shapefile@0.6.6 @types/shapefile
printf '\n# district source downloads (npm run bb -- districts)\n/.cache/\n' >> .gitignore
```

Verify the types before using them (repo rule: read the definitions, don't guess):

```bash
sed -n 1,80p node_modules/@types/shapefile/index.d.ts
```

Expected: `export function read(shp: ..., dbf?: ..., options?: Options): Promise<GeoJSON.FeatureCollection>` where the sources may be file paths. If the signature differs, adapt `loadCongress` in Step 4 to it.

**Step 2: Write the failing test**

`tests/district-sources.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addressPageUrl, assertGeographic, cached, parseAddressRows, parseCongress, parsePrecincts, type SourceDeps,
} from "@/pipeline/district-sources";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
function deps(fetch: SourceDeps["fetch"], refresh = false): SourceDeps {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-districts-"));
  dirs.push(dir);
  return { fetch, dir, refresh };
}

describe("cached", () => {
  it("downloads once, then reads the cache", async () => {
    const fetch = vi.fn(async () => new Response("hello"));
    const d = deps(fetch);
    expect((await cached("a.txt", "https://x/a", d)).toString()).toBe("hello");
    expect((await cached("a.txt", "https://x/a", d)).toString()).toBe("hello");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("refetches with refresh", async () => {
    const fetch = vi.fn(async () => new Response("v2"));
    const d = deps(fetch, true);
    fs.writeFileSync(path.join(d.dir, "a.txt"), "v1");
    expect((await cached("a.txt", "https://x/a", d)).toString()).toBe("v2");
  });
  it("throws on HTTP errors and caches nothing", async () => {
    const d = deps(async () => new Response("nope", { status: 503 }));
    await expect(cached("a.txt", "https://x/a", d)).rejects.toThrow("https://x/a -> HTTP 503");
    expect(fs.existsSync(path.join(d.dir, "a.txt"))).toBe(false);
  });
});

describe("addressPageUrl", () => {
  it("selects only the fields the build uses, in a stable order", () => {
    const u = new URL(addressPageUrl(50_000));
    expect(u.origin + u.pathname).toBe("https://data.sf.gov/resource/3mea-di5p.json");
    expect(u.searchParams.get("$select")).toBe("address_number,street_full_street_name,zip_code,longitude,latitude,supervisor");
    expect(u.searchParams.get("$order")).toBe("eas_baseid");
    expect(u.searchParams.get("$offset")).toBe("50000");
  });
});

describe("parseAddressRows", () => {
  it("parses DataSF rows and skips incomplete ones", () => {
    const rows = [
      { address_number: "128", street_full_street_name: "UTAH ST", zip_code: "94103", longitude: "-122.40691327341428", latitude: "37.76786544340293", supervisor: "6" },
      { address_number: "1", street_full_street_name: "BROADWAY", zip_code: "94133", longitude: "-122.4", latitude: "37.8" },
      { address_number: "2", street_full_street_name: "UTAH ST", zip_code: "94103", longitude: "", latitude: "37.8", supervisor: "6" },
      { address_number: "x", street_full_street_name: "UTAH ST", zip_code: "94103", longitude: "-122.4", latitude: "37.8" },
      { address_number: "3", zip_code: "94103", longitude: "-122.4", latitude: "37.8" },
    ];
    expect(parseAddressRows(rows)).toEqual({
      rows: [
        { number: 128, street: "UTAH ST", zip: "94103", lon: -122.40691327341428, lat: 37.76786544340293, supervisor: "6" },
        { number: 1, street: "BROADWAY", zip: "94133", lon: -122.4, lat: 37.8, supervisor: null },
      ],
      skipped: 3,
    });
  });
});

describe("parsePrecincts", () => {
  it("reads the id and the five district columns", () => {
    const geometry = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] };
    const fc = {
      features: [
        { properties: { prec_2022: "9129", supe22: "1", assemb22: "19", cong22: "11", bart22: "8", boe22: "2", neigh22: "Inner Richmond" }, geometry },
        { properties: { prec_2022: "9999" }, geometry: null },
      ],
    };
    expect(parsePrecincts(fc)).toEqual([
      { id: "9129", districts: { supervisor: "1", assembly: "19", congress: "11", bart: "8", boe: "2" }, geometry },
    ]);
  });
  it("fails loudly when the id column is missing", () => {
    expect(() => parsePrecincts({ features: [{ properties: { precinct: "1" }, geometry: { type: "Polygon", coordinates: [] } }] })).toThrow(/prec_2022/);
  });
});

describe("parseCongress", () => {
  it("reads DISTRICT and keeps polygon features", () => {
    const geometry = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    expect(parseCongress([{ properties: { DISTRICT: "11", ID: 1 }, geometry }, { properties: { DISTRICT: "12" }, geometry: { type: "Point", coordinates: [0, 0] } }])).toEqual([
      { district: "11", geometry },
    ]);
  });
});

describe("assertGeographic", () => {
  it("accepts lon/lat and refuses projected shapefiles", () => {
    expect(() => assertGeographic('GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983"]]')).not.toThrow();
    expect(() => assertGeographic('PROJCS["NAD_1983_StatePlane_California_III_FIPS_0403_Feet",GEOGCS[]]')).toThrow(/projected/);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run tests/district-sources.test.ts`
Expected: FAIL with `Failed to resolve import "@/pipeline/district-sources"`.

**Step 4: Write minimal implementation**

`src/pipeline/district-sources.ts`:

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { read as readShapefile } from "shapefile";
import { KINDS, type DistrictKind, type Districts } from "@/lib/districts";
import type { Geometry } from "./geo";

export type AddressRow = { number: number; street: string; zip: string; lon: number; lat: number; supervisor: string | null };
export type Precinct = { id: string; districts: Districts; geometry: Geometry };
export type CongressDistrict = { district: string; geometry: Geometry };
export type SourceDeps = { fetch: (url: string) => Promise<Response>; dir: string; refresh: boolean };
export type DistrictSources = {
  addresses(): Promise<{ rows: AddressRow[]; skipped: number }>;
  precincts(): Promise<Precinct[]>;
  congress(): Promise<CongressDistrict[]>;
};

export const ADDRESSES_URL = "https://data.sf.gov/resource/3mea-di5p.json";
export const ADDRESS_FIELDS = ["address_number", "street_full_street_name", "zip_code", "longitude", "latitude", "supervisor"];
export const PRECINCTS_URL = "https://data.sf.gov/api/geospatial/d6x4-hefw?method=export&format=GeoJSON";
export const PRECINCT_ID = "prec_2022";
export const PRECINCT_FIELDS: Record<DistrictKind, string> = { supervisor: "supe22", assembly: "assemb22", congress: "cong22", bart: "bart22", boe: "boe22" };
export const CONGRESS_URL = "https://statewidedatabase.org/pub/data/d25/AB604%202025-08-16.zip";
export const CONGRESS_FIELD = "DISTRICT";
const PAGE = 50_000;

export async function cached(name: string, url: string, deps: SourceDeps): Promise<Buffer> {
  const file = path.join(deps.dir, name);
  if (!deps.refresh && fs.existsSync(file)) return fs.readFileSync(file);
  const res = await deps.fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(deps.dir, { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}

export function addressPageUrl(offset: number): string {
  const p = new URLSearchParams({ $select: ADDRESS_FIELDS.join(","), $order: "eas_baseid", $limit: String(PAGE), $offset: String(offset) });
  return `${ADDRESSES_URL}?${p}`;
}

const num = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseAddressRows(rows: Record<string, unknown>[]): { rows: AddressRow[]; skipped: number } {
  const out: AddressRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const number = num(r.address_number);
    const lon = num(r.longitude);
    const lat = num(r.latitude);
    const street = str(r.street_full_street_name);
    const zip = str(r.zip_code);
    if (!Number.isInteger(number) || !street || !/^\d{5}$/.test(zip) || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      skipped++;
      continue;
    }
    const sup = str(r.supervisor);
    out.push({ number, street, zip, lon, lat, supervisor: sup ? String(Number(sup)) : null });
  }
  return { rows: out, skipped };
}

type FeatureLike = { properties: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } | null };
const isArea = (g: FeatureLike["geometry"]): g is Geometry => g?.type === "Polygon" || g?.type === "MultiPolygon";

export function parsePrecincts(fc: { features: FeatureLike[] }): Precinct[] {
  return fc.features.flatMap((f) => {
    if (!isArea(f.geometry)) return [];
    const p = f.properties ?? {};
    const id = str(p[PRECINCT_ID]);
    if (!id) throw new Error(`precinct feature without ${PRECINCT_ID}; properties: ${Object.keys(p).join(", ")}`);
    const districts = Object.fromEntries(KINDS.map((k) => [k.kind, String(Number(str(p[PRECINCT_FIELDS[k.kind]])))])) as Districts;
    return [{ id, districts, geometry: f.geometry }];
  });
}

export function parseCongress(features: FeatureLike[]): CongressDistrict[] {
  return features.flatMap((f) => (isArea(f.geometry) ? [{ district: String(Number(str(f.properties?.[CONGRESS_FIELD]))), geometry: f.geometry }] : []));
}

export function assertGeographic(prj: string): void {
  if (!prj.trim().startsWith("GEOGCS[")) throw new Error(`congress shapefile is projected, not lon/lat; reproject it first: ${prj.slice(0, 80)}`);
}

export function liveSources(deps: SourceDeps): DistrictSources {
  return {
    async addresses() {
      const all: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const page = JSON.parse((await cached(`addresses-${offset}.json`, addressPageUrl(offset), deps)).toString("utf8")) as Record<string, unknown>[];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      return parseAddressRows(all);
    },
    async precincts() {
      return parsePrecincts(JSON.parse((await cached("precincts.geojson", PRECINCTS_URL, deps)).toString("utf8")));
    },
    async congress() {
      await cached("congress.zip", CONGRESS_URL, deps);
      const dir = path.join(deps.dir, "congress");
      fs.rmSync(dir, { recursive: true, force: true });
      execFileSync("unzip", ["-o", "-q", path.join(deps.dir, "congress.zip"), "-d", dir]);
      const shp = fs.readdirSync(dir).find((f) => f.endsWith(".shp"));
      if (!shp) throw new Error(`no .shp in ${CONGRESS_URL}`);
      const base = path.join(dir, shp.slice(0, -4));
      assertGeographic(fs.readFileSync(`${base}.prj`, "utf8"));
      const fc = await readShapefile(`${base}.shp`, `${base}.dbf`);
      return parseCongress(fc.features as unknown as FeatureLike[]);
    },
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/district-sources.test.ts`
Expected: PASS.

Then check that `tsx` can load `shapefile` (it ships UMD + ESM; this catches an interop problem now rather than in Task 11):

Run: `npx tsx -e 'import("shapefile").then((m) => console.log(typeof m.read))'`
Expected: `function`.

**Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore src/pipeline/district-sources.ts tests/district-sources.test.ts
git commit -m "feat(districts): cached loaders for DataSF addresses, precincts and the Prop 50 map"
```

---

### Task 8: Build the district index and its checks

**Files:**
- Create: `src/pipeline/districts.ts`
- Create: `tests/fixtures/districts.ts`
- Test: `tests/districts-build.test.ts`

`buildDistricts()` is pure: it takes parsed sources and the ballot's contests and returns the files to write plus a list of errors. Checks (each an error, so nothing is written):

1. Every address with coordinates falls in a precinct.
2. Each address's Supervisor district from the precinct join equals the `supervisor` in the address file (rows without one are not compared).
3. Every precinct's districts are in the county's expected sets (SF: Supervisor 1–11, Assembly 17/19, Congress 11/15, BART 7/8/9, BOE 2).
4. Every districted contest on the ballot is reachable: some precinct that holds an address has that district.
5. Congress from the precinct file matches the Prop 50 map for every precinct that holds an address: the Prop 50 district containing most of a sample of its addresses (up to 25) must equal `cong22`. Sampling keeps the check fast; the statewide district polygons are large.
6. Every street file is at most `MAX_STREET_FILE_BYTES` (16 KB).

Output, all JSON with a trailing newline, keys sorted for stable diffs:

- `precincts.json`: `{ "<precinct>": { supervisor, assembly, congress, bart, boe } }`
- `streets.json`: display names, natural order
- `zips.json`: `{ "<zip>": ["<precinct>", …] }`
- `streets/<slug>.json`: `{ odd: Range[], even: Range[] }`

**Step 1: Write the fixture**

`tests/fixtures/districts.ts`:

```ts
import type { County } from "@/pipeline/districts";
import type { AddressRow, CongressDistrict, Precinct } from "@/pipeline/district-sources";
import type { Geometry } from "@/pipeline/geo";
import type { Contest } from "@/lib/schema";

export const square = (x0: number, y0: number, x1: number, y1: number): Geometry => ({
  type: "Polygon",
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});

export const county: County = {
  id: "sf",
  expected: { supervisor: ["1", "2"], assembly: ["17", "19"], congress: ["11", "15"], bart: ["8"], boe: ["2"] },
};

export const precincts: Precinct[] = [
  { id: "1101", districts: { supervisor: "1", assembly: "19", congress: "15", bart: "8", boe: "2" }, geometry: square(0, 0, 1, 1) },
  { id: "1102", districts: { supervisor: "2", assembly: "17", congress: "11", bart: "8", boe: "2" }, geometry: square(1, 0, 2, 1) },
];

export const congress: CongressDistrict[] = [
  { district: "15", geometry: square(0, 0, 1, 1) },
  { district: "11", geometry: square(1, 0, 2, 1) },
];

export const addr = (number: number, street: string, x: number, extra: Partial<AddressRow> = {}): AddressRow => ({
  number, street, zip: "94110", lon: x, lat: 0.5, supervisor: x < 1 ? "1" : "2", ...extra,
});

export const addresses: AddressRow[] = [
  addr(101, "MAIN ST", 0.5),
  addr(103, "MAIN ST", 0.6),
  addr(105, "MAIN ST", 1.5),
  addr(100, "MAIN ST", 0.5),
  addr(102, "MAIN ST", 0.5),
  addr(1, "03RD ST", 1.2, { zip: "94130" }),
];

export const contests: Pick<Contest, "id" | "jurisdiction">[] = [
  { id: "supervisor-2", jurisdiction: { level: "district", name: "Supervisor", district: "2" } },
  { id: "assembly-17", jurisdiction: { level: "district", name: "Assembly", district: "17" } },
  { id: "governor", jurisdiction: { level: "state", name: "California" } },
];
```

**Step 2: Write the failing test**

`tests/districts-build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDistricts, MAX_STREET_FILE_BYTES, type BuildInput } from "@/pipeline/districts";
import { addr, addresses, congress, contests, county, precincts } from "./fixtures/districts";

const input: BuildInput = { county, addresses, precincts, congress, contests };
const parse = (files: Map<string, string>, name: string) => JSON.parse(files.get(name) ?? "null");

describe("buildDistricts", () => {
  it("writes the four kinds of file from clean sources", () => {
    const r = buildDistricts(input);
    expect(r.errors).toEqual([]);
    expect(parse(r.files, "precincts.json")).toEqual({
      "1101": { supervisor: "1", assembly: "19", congress: "15", bart: "8", boe: "2" },
      "1102": { supervisor: "2", assembly: "17", congress: "11", bart: "8", boe: "2" },
    });
    expect(parse(r.files, "streets.json")).toEqual(["3rd St", "Main St"]);
    expect(parse(r.files, "zips.json")).toEqual({ "94110": ["1101", "1102"], "94130": ["1102"] });
    expect(parse(r.files, "streets/main-st.json")).toEqual({ odd: [[101, 103, "1101"], [105, 105, "1102"]], even: [[100, 102, "1101"]] });
    expect(parse(r.files, "streets/3rd-st.json")).toEqual({ odd: [[1, 1, "1102"]], even: [] });
    expect([...r.files.keys()].sort()).toEqual(["precincts.json", "streets.json", "streets/3rd-st.json", "streets/main-st.json", "zips.json"]);
    expect(r.files.get("zips.json")?.endsWith("\n")).toBe(true);
    expect(r.stats).toMatchObject({ addresses: 6, precincts: 2, streets: 2, zips: 2 });
  });

  it("fails on an address outside every precinct", () => {
    const r = buildDistricts({ ...input, addresses: [...addresses, addr(7, "MAIN ST", 5)] });
    expect(r.errors).toEqual([expect.stringMatching(/^addresses outside every precinct: 1\n {2}7 MAIN ST/)]);
  });

  it("fails when an address's own Supervisor district disagrees with its precinct", () => {
    const r = buildDistricts({ ...input, addresses: [...addresses, addr(9, "MAIN ST", 0.5, { supervisor: "2" })] });
    expect(r.errors).toEqual([expect.stringMatching(/Supervisor district disagrees with their precinct: 1\n {2}9 MAIN ST: address file says 2, precinct 1101 says 1/)]);
  });

  it("does not compare addresses that carry no Supervisor district", () => {
    expect(buildDistricts({ ...input, addresses: [...addresses, addr(9, "MAIN ST", 0.5, { supervisor: null })] }).errors).toEqual([]);
  });

  it("fails on a district the county doesn't have", () => {
    const r = buildDistricts({ ...input, county: { ...county, expected: { ...county.expected, assembly: ["17"] } } });
    expect(r.errors).toEqual([expect.stringMatching(/precincts with an unknown district: 1\n {2}1101: assembly 19/)]);
  });

  it("fails when a districted contest can't be reached from any address", () => {
    const r = buildDistricts({ ...input, contests: [...contests, { id: "supervisor-4", jurisdiction: { level: "district", name: "Supervisor", district: "4" } }] });
    expect(r.errors).toEqual([expect.stringMatching(/districted contests no address can reach: 1\n {2}supervisor-4/)]);
  });

  it("fails when the precinct file's congress district disagrees with the Prop 50 map", () => {
    const swapped = [{ ...congress[0], district: "11" }, { ...congress[1], district: "15" }];
    const r = buildDistricts({ ...input, congress: swapped });
    expect(r.errors).toEqual([expect.stringMatching(/disagrees with the Prop 50 map: 2\n {2}1101: precinct file 15, Prop 50 11/)]);
  });

  it("fails on a street file over the size limit", () => {
    const zigzag = Array.from({ length: 4000 }, (_, i) => addr(i * 2 + 1, "LONG ST", i % 2 ? 0.5 : 1.5));
    const r = buildDistricts({ ...input, addresses: [...addresses, ...zigzag] });
    expect(r.errors).toEqual([expect.stringMatching(new RegExp(`street files over ${MAX_STREET_FILE_BYTES} bytes: 1\\n {2}streets/long-st.json`))]);
  });

  it("lists at most 20 examples per error", () => {
    const outside = Array.from({ length: 25 }, (_, i) => addr(i, "MAIN ST", 9));
    const [error] = buildDistricts({ ...input, addresses: [...addresses, ...outside] }).errors;
    expect(error.split("\n")).toHaveLength(21);
    expect(error).toMatch(/^addresses outside every precinct: 25 \(first 20\)/);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run tests/districts-build.test.ts`
Expected: FAIL with `Failed to resolve import "@/pipeline/districts"`.

**Step 4: Write minimal implementation**

`src/pipeline/districts.ts`:

```ts
import { displayStreet, normalizeStreet, streetSlug } from "@/lib/address";
import { districtKind, KINDS, type DistrictKind } from "@/lib/districts";
import { compressRanges, type NumberedPoint } from "@/lib/ranges";
import type { Contest } from "@/lib/schema";
import type { AddressRow, CongressDistrict, Precinct } from "./district-sources";
import { makeIndex } from "./geo";

export type County = { id: string; expected: Record<DistrictKind, string[]> };
export type BuildInput = {
  county: County;
  addresses: AddressRow[];
  precincts: Precinct[];
  congress: CongressDistrict[];
  contests: Pick<Contest, "id" | "jurisdiction">[];
};
export type BuildStats = { addresses: number; precincts: number; streets: number; zips: number; bytes: number };
export type BuildResult = { files: Map<string, string>; errors: string[]; stats: BuildStats };

const numbers = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
export const SF: County = {
  id: "sf",
  expected: { supervisor: numbers(1, 11), assembly: ["17", "19"], congress: ["11", "15"], bart: ["7", "8", "9"], boe: ["2"] },
};
export const MAX_STREET_FILE_BYTES = 16 * 1024;
const CONGRESS_SAMPLE = 25;
const MAX_LISTED = 20;

const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const json = (v: unknown) => `${JSON.stringify(v)}\n`;
const sortedObject = <T>(entries: [string, T][]) => Object.fromEntries(entries.sort(([a], [b]) => natural(a, b)));

function listed(label: string, items: string[]): string[] {
  if (items.length === 0) return [];
  const head = `${label}: ${items.length}${items.length > MAX_LISTED ? ` (first ${MAX_LISTED})` : ""}`;
  return [[head, ...items.slice(0, MAX_LISTED).map((i) => `  ${i}`)].join("\n")];
}

export function buildDistricts({ county, addresses, precincts, congress, contests }: BuildInput): BuildResult {
  const byId = new Map(precincts.map((p) => [p.id, p]));
  const locate = makeIndex(precincts.map((p) => ({ geometry: p.geometry, value: p.id })));
  const locateCongress = makeIndex(congress.map((c) => ({ geometry: c.geometry, value: c.district })));

  const unplaced: string[] = [];
  const supervisorMismatch: string[] = [];
  const streets = new Map<string, NumberedPoint[]>();
  const zips = new Map<string, Set<string>>();
  const samples = new Map<string, AddressRow[]>();
  let placed = 0;

  for (const a of addresses) {
    const label = `${a.number} ${a.street}`;
    const id = locate(a.lon, a.lat);
    const precinct = id === null ? undefined : byId.get(id);
    if (!precinct) {
      unplaced.push(label);
      continue;
    }
    placed++;
    if (a.supervisor !== null && a.supervisor !== precinct.districts.supervisor) {
      supervisorMismatch.push(`${label}: address file says ${a.supervisor}, precinct ${precinct.id} says ${precinct.districts.supervisor}`);
    }
    const key = normalizeStreet(a.street);
    const points = streets.get(key) ?? [];
    points.push({ number: a.number, precinct: precinct.id });
    streets.set(key, points);
    zips.set(a.zip, (zips.get(a.zip) ?? new Set()).add(precinct.id));
    const sample = samples.get(precinct.id) ?? [];
    if (sample.length < CONGRESS_SAMPLE) samples.set(precinct.id, [...sample, a]);
  }

  const used = [...samples.keys()].map((id) => byId.get(id)).filter((p): p is Precinct => p !== undefined);

  const unknown = precincts.flatMap((p) =>
    KINDS.filter((k) => !county.expected[k.kind].includes(p.districts[k.kind])).map((k) => `${p.id}: ${k.kind} ${p.districts[k.kind]}`),
  );

  const unreachable = contests
    .filter((c) => {
      const kind = districtKind(c.jurisdiction);
      return kind !== null && !used.some((p) => p.districts[kind] === c.jurisdiction.district);
    })
    .map((c) => c.id);

  const congressMismatch = used.flatMap((p) => {
    const tally = new Map<string, number>();
    for (const a of samples.get(p.id) ?? []) {
      const d = locateCongress(a.lon, a.lat) ?? "none";
      tally.set(d, (tally.get(d) ?? 0) + 1);
    }
    const [top] = [...tally].sort((x, y) => y[1] - x[1]);
    return top && top[0] !== p.districts.congress ? [`${p.id}: precinct file ${p.districts.congress}, Prop 50 ${top[0]}`] : [];
  });

  const files = new Map<string, string>();
  files.set("precincts.json", json(sortedObject(precincts.map((p): [string, Precinct["districts"]] => [p.id, p.districts]))));
  files.set("streets.json", json([...streets.keys()].map(displayStreet).sort(natural)));
  files.set("zips.json", json(sortedObject([...zips].map(([zip, ids]): [string, string[]] => [zip, [...ids].sort(natural)]))));
  const tooBig: string[] = [];
  for (const [key, points] of streets) {
    const name = `streets/${streetSlug(key)}.json`;
    const body = json(compressRanges(points));
    if (body.length > MAX_STREET_FILE_BYTES) tooBig.push(`${name}: ${body.length} bytes`);
    files.set(name, body);
  }

  const errors = [
    ...listed("addresses outside every precinct", unplaced),
    ...listed("addresses whose Supervisor district disagrees with their precinct", supervisorMismatch),
    ...listed("precincts with an unknown district", unknown),
    ...listed("districted contests no address can reach", unreachable),
    ...listed("precincts whose congress district disagrees with the Prop 50 map", congressMismatch),
    ...listed(`street files over ${MAX_STREET_FILE_BYTES} bytes`, tooBig),
  ];
  const bytes = [...files.values()].reduce((n, f) => n + f.length, 0);
  return { files, errors, stats: { addresses: placed, precincts: precincts.length, streets: streets.size, zips: zips.size, bytes } };
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/districts-build.test.ts`
Expected: PASS. If the size-limit test passes without an error, the zigzag street compressed below 16 KB: raise the address count in the test, not the limit.

**Step 6: Commit**

```bash
git add src/pipeline/districts.ts tests/fixtures/districts.ts tests/districts-build.test.ts
git commit -m "feat(districts): build the address index with the design's cross-checks"
```

---

### Task 9: Write the files, and the `bb districts` command

**Files:**
- Modify: `src/pipeline/districts.ts` (append `writeDistrictFiles`, `generateDistricts`)
- Modify: `scripts/bb.ts` (imports at top; `USAGE` at lines 21-45; new `runDistricts()` before `main()`; `main()` dispatch at lines 266-280)
- Test: `tests/districts-build.test.ts` (append)

**Step 1: Write the failing test**

Append to `tests/districts-build.test.ts` (add `fs`, `os`, `path`, `afterEach` imports and `generateDistricts, writeDistrictFiles` to the districts import):

```ts
describe("generateDistricts", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
  const outDir = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "bb-out-"));
    dirs.push(d);
    return path.join(d, "sf");
  };
  const sources = (extra: typeof addresses = []) => ({
    addresses: async () => ({ rows: [...addresses, ...extra], skipped: 3 }),
    precincts: async () => precincts,
    congress: async () => congress,
  });

  it("writes every file and removes stale street files when clean", async () => {
    const out = outDir();
    fs.mkdirSync(path.join(out, "streets"), { recursive: true });
    fs.writeFileSync(path.join(out, "streets", "gone-st.json"), "{}");
    const r = await generateDistricts({ county, sources: sources(), contests, outDir: out });
    expect(r.errors).toEqual([]);
    expect(r.skipped).toBe(3);
    expect(fs.readdirSync(path.join(out, "streets")).sort()).toEqual(["3rd-st.json", "main-st.json"]);
    expect(JSON.parse(fs.readFileSync(path.join(out, "zips.json"), "utf8"))).toEqual({ "94110": ["1101", "1102"], "94130": ["1102"] });
  });

  it("writes nothing when a check fails", async () => {
    const out = outDir();
    const r = await generateDistricts({ county, sources: sources([addr(7, "MAIN ST", 5)]), contests, outDir: out });
    expect(r.errors).toHaveLength(1);
    expect(fs.existsSync(out)).toBe(false);
  });

  it("writeDistrictFiles creates nested directories", () => {
    const out = outDir();
    writeDistrictFiles(out, new Map([["a.json", "1\n"], ["streets/b.json", "2\n"]]));
    expect(fs.readFileSync(path.join(out, "streets", "b.json"), "utf8")).toBe("2\n");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/districts-build.test.ts`
Expected: FAIL naming `generateDistricts` / `writeDistrictFiles`.

**Step 3: Write minimal implementation**

Append to `src/pipeline/districts.ts` (and add `import fs from "node:fs";`, `import path from "node:path";` at the top, and `type DistrictSources` to the `./district-sources` import):

```ts
export function writeDistrictFiles(outDir: string, files: Map<string, string>): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [name, body] of files) {
    const file = path.join(outDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
}

export async function generateDistricts({
  county,
  sources,
  contests,
  outDir,
}: {
  county: County;
  sources: DistrictSources;
  contests: BuildInput["contests"];
  outDir: string;
}): Promise<BuildResult & { skipped: number }> {
  const [{ rows, skipped }, precincts, congress] = await Promise.all([sources.addresses(), sources.precincts(), sources.congress()]);
  const result = buildDistricts({ county, addresses: rows, precincts, congress, contests });
  if (result.errors.length === 0) writeDistrictFiles(outDir, result.files);
  return { ...result, skipped };
}
```

In `scripts/bb.ts`:

Add imports next to the other pipeline imports:

```ts
import { liveSources } from "../src/pipeline/district-sources";
import { generateDistricts, SF } from "../src/pipeline/districts";
```

Add to `USAGE`, after the `npm run bb -- review [--no-open]` line:

```
       npm run bb -- districts [--refresh]
```

and append this paragraph at the end of `USAGE`:

```

districts downloads SF's base addresses, voting precincts and the Prop 50 congressional
map (cached in .cache/districts; --refresh downloads again), checks them against each other
and the ballot, and writes public/districts/sf/. It writes nothing if a check fails.
```

Add before `main()`:

```ts
async function runDistricts(): Promise<void> {
  const data = loadElection(ROOT, ELECTION);
  const r = await generateDistricts({
    county: SF,
    sources: liveSources({
      fetch: (url) => fetch(url, { signal: AbortSignal.timeout(300_000) }),
      dir: path.join(process.cwd(), ".cache", "districts"),
      refresh: flag("--refresh"),
    }),
    contests: data.ballot.contests,
    outDir: path.join(process.cwd(), "public", "districts", SF.id),
  });
  const s = r.stats;
  console.log(`${s.addresses} addresses placed (${r.skipped} rows skipped), ${s.precincts} precincts, ${s.streets} streets, ${s.zips} ZIPs, ${Math.round(s.bytes / 1024)} KB`);
  r.errors.forEach((e) => console.error(`ERROR ${e}`));
  if (r.errors.length) {
    console.error("Nothing written.");
    process.exitCode = 1;
  } else {
    console.log(`Wrote public/districts/${SF.id}/. Review with: git status public/districts`);
  }
}
```

In `main()`, add a branch after `else if (cmd === "review") runReview();`:

```ts
  else if (cmd === "districts") await runDistricts();
```

**Step 4: Run tests and types**

Run: `npx vitest run tests/districts-build.test.ts && npx next typegen && npx tsc --noEmit`
Expected: tests PASS; `tsc` prints nothing.

Run: `npm run bb -- --help | grep districts`
Expected: the two new `districts` lines.

**Step 5: Commit**

```bash
git add src/pipeline/districts.ts scripts/bb.ts tests/districts-build.test.ts
git commit -m "feat(bb): districts command writes public/districts/sf"
```

---

### Task 10: Generate and commit the SF data

**Files:**
- Create (generated): `public/districts/sf/precincts.json`, `public/districts/sf/streets.json`, `public/districts/sf/zips.json`, `public/districts/sf/streets/*.json`
- Test: `tests/district-data.test.ts`

**Step 1: Re-verify the source schemas (they are external and can change)**

```bash
curl -s 'https://data.sf.gov/resource/3mea-di5p.json?$limit=5&$select=address_number,street_full_street_name,zip_code,longitude,latitude,supervisor' | python3 -m json.tool | head -20
curl -s 'https://data.sf.gov/resource/3mea-di5p.json?$select=count(*)'
curl -s 'https://data.sf.gov/resource/d6x4-hefw.json?$limit=2' | python3 -c "import json,sys; [print({k: v for k, v in r.items() if k != 'the_geom'}) for r in json.load(sys.stdin)]"
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' 'https://statewidedatabase.org/pub/data/d25/AB604%202025-08-16.zip'
```

Expected: five address rows with all six fields (some rows lack `supervisor`; that's fine), a count near 224,000, precinct rows carrying `prec_2022`, `supe22`, `assemb22`, `cong22`, `bart22`, `boe22`, and `200` with a size around 1.6–7 MB for the shapefile ZIP. If a field name changed, update `ADDRESS_FIELDS`, `PRECINCT_ID`, `PRECINCT_FIELDS` or `CONGRESS_FIELD` in `src/pipeline/district-sources.ts` and the matching test, and re-run Task 7's tests before continuing.

**Step 2: Verify the SF Elections lookup URL**

```bash
curl -s -L -o /tmp/portal.html -w '%{http_code} %{url_effective}\n' https://sfelections.org/tools/portal/ && grep -o '<title>[^<]*' /tmp/portal.html
```

Expected: `200 https://sfelections.org/tools/portal/` and `<title>Voter Portal`. If it moved, update `VOTER_PORTAL` in `src/lib/districts.ts`.

**Step 3: Run the build**

Run: `npm run bb -- districts`
Expected (first run downloads about 60 MB into `.cache/districts/`): a line like `2243xx addresses placed (N rows skipped), 514 precincts, ~2000 streets, 27 ZIPs, ~1500 KB` and `Wrote public/districts/sf/`.

If it prints `ERROR` lines, do not loosen a check. Read the examples:
- *outside every precinct*: look at the coordinates; addresses on the Farallones or piers may fall outside the precinct file. Report back to Sean before excluding anything.
- *Supervisor district disagrees*: compare the precinct file date (2023-09-13) with the address file; a handful near boundaries may mean the precinct file is stale. Report back with the list.
- *Prop 50*: means the precinct file's `cong22` no longer matches the Prop 50 map for SF; the build must not ship until that's resolved.

**Step 4: Inspect the output**

```bash
du -sh public/districts/sf && ls public/districts/sf/streets | wc -l
ls -S public/districts/sf/streets | head -3 | xargs -I{} wc -c public/districts/sf/streets/{}
head -c 300 public/districts/sf/streets/utah-st.json; echo
node -e '
const fs = require("fs"); const d = "public/districts/sf/";
const p = JSON.parse(fs.readFileSync(d + "precincts.json")); const z = JSON.parse(fs.readFileSync(d + "zips.json"));
for (const [zip, ids] of Object.entries(z)) {
  const sets = new Set(ids.map((id) => JSON.stringify(p[id])));
  console.log(zip, sets.size === 1 ? "ONE " + [...sets][0] : sets.size + " sets");
}'
```

Expected: total size about 1–2 MB in roughly 2,000 street files; the largest street file well under 16 KB; Utah St's file has odd and even ranges. The ZIP listing shows which ZIPs resolve on their own (as of 2026-10-06, the seven ZIPs with a single Supervisor district are 94104, 94108, 94111, 94123, 94129, 94130, 94133; other districts can still split them). Pick one ZIP marked `ONE` for the e2e tests (prefer 94130), and note its districts. Confirm 94103 shows more than one set.

**Step 5: Write the committed-data test**

`tests/district-data.test.ts` (replace `UNAMBIGUOUS_ZIP` and its expected districts with what Step 4 printed):

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeStreet, streetSlug } from "@/lib/address";
import { loadElection } from "@/lib/data";
import { districtKind, type Districts } from "@/lib/districts";
import { findPrecinct, type StreetFile } from "@/lib/ranges";
import { MAX_STREET_FILE_BYTES } from "@/pipeline/districts";

const dir = path.join(process.cwd(), "public/districts/sf");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T;
const precincts = read<Record<string, Districts>>("precincts.json");
const zips = read<Record<string, string[]>>("zips.json");
const streets = read<string[]>("streets.json");
const UNAMBIGUOUS_ZIP = "94130";

describe("committed SF district data", () => {
  it("has exactly one file per street in streets.json", () => {
    const expected = streets.map((s) => `${streetSlug(normalizeStreet(s))}.json`).sort();
    expect(fs.readdirSync(path.join(dir, "streets")).sort()).toEqual(expected);
  });

  it("keeps every street file under the size limit", () => {
    const big = fs.readdirSync(path.join(dir, "streets")).filter((f) => fs.statSync(path.join(dir, "streets", f)).size > MAX_STREET_FILE_BYTES);
    expect(big).toEqual([]);
  });

  it("maps all 27 SF ZIPs to precincts that exist", () => {
    expect(Object.keys(zips)).toHaveLength(27);
    const missing = Object.values(zips).flat().filter((id) => !precincts[id]);
    expect(missing).toEqual([]);
  });

  it("reaches every districted contest on the ballot", () => {
    const { ballot } = loadElection(path.join(process.cwd(), "data"), "2026-11");
    const used = [...new Set(Object.values(zips).flat())].map((id) => precincts[id]);
    const unreachable = ballot.contests.filter((c) => {
      const kind = districtKind(c.jurisdiction);
      return kind !== null && !used.some((d) => d[kind] === c.jurisdiction.district);
    });
    expect(unreachable.map((c) => c.id)).toEqual([]);
  });

  it("resolves 128 Utah St to Supervisor 6, Assembly 17, Congress 11, BART 9", () => {
    const precinct = findPrecinct(read<StreetFile>("streets/utah-st.json"), 128);
    expect(precinct && precincts[precinct]).toEqual({ supervisor: "6", assembly: "17", congress: "11", bart: "9", boe: "2" });
  });

  it(`resolves ${UNAMBIGUOUS_ZIP} to one district set and 94103 to several`, () => {
    const sets = (zip: string) => new Set(zips[zip].map((id) => JSON.stringify(precincts[id])));
    expect(sets(UNAMBIGUOUS_ZIP).size).toBe(1);
    expect(sets("94103").size).toBeGreaterThan(1);
  });
});
```

**Step 6: Run it**

Run: `npx vitest run tests/district-data.test.ts`
Expected: PASS. A failure in "exactly one file per street" means `normalizeStreet(displayStreet(key)) !== key` for some EAS name: add that name to the idempotence test in `tests/address.test.ts`, fix `normalizeStreet`/`displayStreet`, rebuild, and re-run.

**Step 7: Commit (data separately from code, so the diff stays reviewable)**

```bash
git add public/districts/sf tests/district-data.test.ts
git commit -m "data: SF address district index for Nov 2026 (<N> streets, <size>)"
```

Fill `<N>` and `<size>` from Step 4. Expected size: about 1–2 MB, about 2,000 files.

---
### Task 11: Client lookup module

**Files:**
- Create: `src/lib/address-lookup.ts`
- Test: `tests/address-lookup.test.ts`

Fetches each file at most once per page load (promises cached per URL; a failed fetch is dropped from the cache so a retry refetches). A ZIP resolves when all its precincts share one district set; otherwise the visitor is asked for the street. Every miss is `not-found`; network failures throw so the UI can say "try again".

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { httpLookup, resolveInput } from "@/lib/address-lookup";

const s6 = { supervisor: "6", assembly: "17", congress: "11", bart: "9", boe: "2" };
const s9 = { supervisor: "9", assembly: "17", congress: "11", bart: "9", boe: "2" };
const files: Record<string, unknown> = {
  "/districts/sf/precincts.json": { "7613": s6, "7614": s6, "7916": s9 },
  "/districts/sf/zips.json": { "94130": ["7613", "7614"], "94103": ["7613", "7916"] },
  "/districts/sf/streets.json": ["19th Ave", "19th St", "Ghost St", "Utah St"],
  "/districts/sf/streets/utah-st.json": { odd: [[101, 129, "7613"], [131, 131, null]], even: [[100, 140, "7916"]] },
};
const fakeFetch = () => vi.fn(async (url: string) => (url in files ? Response.json(files[url]) : new Response("not found", { status: 404 })));
const lookup = () => httpLookup({ fetch: fakeFetch() });
const resolved = (districts: typeof s6) => ({ kind: "resolved", set: { county: "sf", districts } });
const notFound = { kind: "not-found" };

describe("resolveInput", () => {
  it("resolves a ZIP whose precincts share one district set", async () => {
    expect(await resolveInput("94130", lookup())).toEqual(resolved(s6));
  });
  it("asks for the street when a ZIP spans district sets", async () => {
    expect(await resolveInput(" 94103 ", lookup())).toEqual({ kind: "ambiguous-zip", zip: "94103" });
  });
  it("does not find a ZIP outside the county", async () => {
    expect(await resolveInput("94601", lookup())).toEqual(notFound);
  });
  it("resolves an address on either side of the street", async () => {
    expect(await resolveInput("129 Utah St", lookup())).toEqual(resolved(s6));
    expect(await resolveInput("128 Utah St", lookup())).toEqual(resolved(s9));
  });
  it("ignores suffix, unit, city and ZIP", async () => {
    expect(await resolveInput("127A Utah Street #4, San Francisco, CA 94103", lookup())).toEqual(resolved(s6));
  });
  it("accepts a street without its type when the name is unique", async () => {
    expect(await resolveInput("129 Utah", lookup())).toEqual(resolved(s6));
  });
  it.each(["131 Utah St", "199 Utah St", "10 19th", "1 Nowhere St", "Utah St", "5 Ghost St", ""])("does not find %j", async (input) => {
    expect(await resolveInput(input, lookup())).toEqual(notFound);
  });
});

describe("httpLookup", () => {
  it("fetches each file once", async () => {
    const fetch = fakeFetch();
    const l = httpLookup({ fetch });
    await resolveInput("129 Utah St", l);
    await resolveInput("101 Utah St", l);
    const urls = fetch.mock.calls.map(([u]) => u);
    expect(urls.filter((u) => u.endsWith("utah-st.json"))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith("streets.json"))).toHaveLength(1);
  });
  it("refetches after a failure", async () => {
    const ok = fakeFetch();
    let calls = 0;
    const fetch = vi.fn(async (url: string) => (++calls === 1 ? Promise.reject(new Error("offline")) : ok(url)));
    const l = httpLookup({ fetch });
    await expect(resolveInput("94130", l)).rejects.toThrow("offline");
    expect(await resolveInput("94130", l)).toEqual(resolved(s6));
  });
  it("throws when a required file is missing", async () => {
    await expect(resolveInput("94130", httpLookup({ base: "/districts/la", fetch: fakeFetch() }))).rejects.toThrow("/districts/la/zips.json");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/address-lookup.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/address-lookup"`.

**Step 3: Write minimal implementation**

`src/lib/address-lookup.ts`:

```ts
import { findStreet, isZip, parseAddress, streetIndex, streetSlug } from "./address";
import { encodeDistricts, type Districts, type DistrictSet } from "./districts";
import { findPrecinct, type StreetFile } from "./ranges";

export type Lookup = {
  zips(): Promise<Record<string, string[]>>;
  precincts(): Promise<Record<string, Districts>>;
  streets(): Promise<string[]>;
  street(slug: string): Promise<StreetFile | null>;
};

export type Resolution = { kind: "resolved"; set: DistrictSet } | { kind: "ambiguous-zip"; zip: string } | { kind: "not-found" };

const NOT_FOUND: Resolution = { kind: "not-found" };

export function httpLookup({
  base = "/districts/sf",
  fetch: get = (url: string) => fetch(url),
}: { base?: string; fetch?: (url: string) => Promise<Response> } = {}): Lookup {
  const cache = new Map<string, Promise<unknown>>();

  function load<T>(file: string): Promise<T | null> {
    const url = `${base}/${file}`;
    const hit = cache.get(url);
    if (hit) return hit as Promise<T | null>;
    const p = get(url).then(async (res) => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return (await res.json()) as T;
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
    return p;
  }

  async function required<T>(file: string): Promise<T> {
    const v = await load<T>(file);
    if (v === null) throw new Error(`${base}/${file} is missing`);
    return v;
  }

  return {
    zips: () => required("zips.json"),
    precincts: () => required("precincts.json"),
    streets: () => required("streets.json"),
    street: (slug) => load(`streets/${slug}.json`),
  };
}

export async function resolveInput(input: string, lookup: Lookup, county = "sf"): Promise<Resolution> {
  const text = input.trim();
  if (isZip(text)) {
    const ids = (await lookup.zips())[text] ?? [];
    const table = await lookup.precincts();
    const sets = new Map<string, Districts>();
    for (const id of ids) {
      const districts = table[id];
      if (districts) sets.set(encodeDistricts({ county, districts }), districts);
    }
    if (sets.size === 0) return NOT_FOUND;
    if (sets.size > 1) return { kind: "ambiguous-zip", zip: text };
    const [districts] = sets.values();
    return { kind: "resolved", set: { county, districts } };
  }
  const parsed = parseAddress(text);
  if (!parsed) return NOT_FOUND;
  const street = findStreet(streetIndex(await lookup.streets()), parsed.street);
  if (!street) return NOT_FOUND;
  const file = await lookup.street(streetSlug(street.key));
  const precinct = file ? findPrecinct(file, parsed.number) : null;
  const districts = precinct ? (await lookup.precincts())[precinct] : undefined;
  return districts ? { kind: "resolved", set: { county, districts } } : NOT_FOUND;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/address-lookup.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/address-lookup.ts tests/address-lookup.test.ts
git commit -m "feat(address): browser lookup from the static district index"
```

---

### Task 12: District state in the URL and on the device; filter the list

**Files:**
- Modify: `src/components/useBallotFilters.ts` (append `useDistricts`; reuse `subscribe`, `replaceQuery`, `useQuery`)
- Modify: `src/components/BallotView.tsx:39` (`keep`), `:54-55` (`visible`, `all`)
- Create: `e2e/address.spec.ts`

The district code is separate from `Filters` (which stays guide-only, so "Reset filters" never clears the ballot). It lives in `?d=` and localStorage key `bb-districts`. As with the guide filters, a URL code wins over storage. Only `encodeDistricts()` output is ever written; the address is not reachable from here.

**Step 1: Write the failing e2e test**

`e2e/address.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { contestRow, isPhone, openBallot, watchErrors } from "./helpers";

const UTAH = "sf.s6.a17.c11.b9.e2";

test("a district code in the URL hides other districts' contests, through filter changes and reloads", async ({ page }, info) => {
  const errors = watchErrors(page);
  await openBallot(page, `?d=${UTAH}`);
  await expect(contestRow(page, "Board of Supervisors, District 6")).toBeVisible();
  await expect(contestRow(page, "Governor")).toBeVisible();
  await expect(contestRow(page, "Board of Supervisors, District 8")).toHaveCount(0);
  await expect(contestRow(page, "United States Representative, District 15")).toHaveCount(0);

  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const scope = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await scope.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
  await expect(page).toHaveURL(/[?&]why=1/);
  await expect(page).toHaveURL(new RegExp(`[?&]d=${UTAH.replace(/\./g, "\\.")}`));

  await page.reload();
  await expect(contestRow(page, "Board of Supervisors, District 8")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an invalid district code shows every contest", async ({ page }) => {
  await openBallot(page, "?d=sf.s99");
  await expect(contestRow(page, "Board of Supervisors, District 8")).toBeVisible();
});
```

**Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/address.spec.ts`
Expected: the first test FAILS at `toHaveCount(0)` for District 8 (count 1) on both projects; the second passes.

**Step 3: Implement**

Append to `src/components/useBallotFilters.ts` (add `encodeDistricts, initialDistricts, type DistrictSet` from `@/lib/districts` to the imports):

```ts
const DISTRICTS_KEY = "bb-districts";

function readStoredDistricts(): string | null {
  try {
    return window.localStorage.getItem(DISTRICTS_KEY);
  } catch {
    return null;
  }
}

export function useDistricts(): [DistrictSet | null, (next: DistrictSet | null) => void] {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, readStoredDistricts, () => null);
  const set = useMemo(() => initialDistricts({ query, stored }), [query, stored]);
  const update = useCallback((next: DistrictSet | null) => {
    const code = next ? encodeDistricts(next) : null;
    try {
      if (code) window.localStorage.setItem(DISTRICTS_KEY, code);
      else window.localStorage.removeItem(DISTRICTS_KEY);
    } catch {
    }
    const p = new URLSearchParams(window.location.search);
    if (code) p.set("d", code);
    else p.delete("d");
    replaceQuery(p.toString());
  }, []);
  return [set, update];
}
```

In `src/components/BallotView.tsx`:

- Imports: add `splitBallot` from `@/lib/districts`; change `import { useBallotFilters, useQueryParam } from "./useBallotFilters";` to `import { useBallotFilters, useDistricts, useQueryParam } from "./useBallotFilters";`.
- Line 39: `useBallotFilters({ guides, keep: ["c"] })` → `useBallotFilters({ guides, keep: ["c", "d"] })`. Without `d` here, every guide-filter change would drop the ballot from the URL.
- After line 39 add `const [districtSet, setDistrictSet] = useDistricts();`
- Replace lines 54-55:

```ts
  const visible = sections(ballot.contests);
  const all = visible.flatMap((s) => s.contests);
```

with:

```ts
  const { shown, hidden } = splitBallot(ballot.contests, districtSet);
  const visible = sections(shown);
  const all = ballot.contests;
```

`all` stays the full list so a shared `?c=` link still opens a contest that isn't on the visitor's ballot. (`hidden` and `setDistrictSet` are used in Tasks 13 and 14; if lint flags them as unused now, leave them out until then.)

**Step 4: Run tests**

Run: `npx playwright test e2e/address.spec.ts && npx playwright test e2e/ballot.spec.ts`
Expected: PASS on phone and desktop; the existing ballot tests still pass.

**Step 5: Commit**

```bash
git add src/components/useBallotFilters.ts src/components/BallotView.tsx e2e/address.spec.ts
git commit -m "feat(ballot): keep districts in ?d= and on the device, and filter the list"
```

---

### Task 13: AddressBox component and its placement

**Files:**
- Create: `src/components/AddressBox.tsx`
- Modify: `src/components/FilterPanel.tsx:35-43` (`FilterSidebar` gets a `top` slot)
- Modify: `src/components/BallotView.tsx` (sidebar `top`, phone box above `FiltersSheet` at line 135)
- Modify: `e2e/helpers.ts` (append `ballotBox`, `findBallot`)
- Test: `e2e/address.spec.ts` (append)

States, all inside one `<section aria-label="Your ballot">`:

| State | Shows |
|---|---|
| empty | "Address or ZIP code" combobox + Find |
| ZIP resolved / address resolved | "Supervisor 6 · Assembly 17 · Congress 11 · BART 9 · Change", "These are your districts, not your sample ballot." + "Confirm with SF Elections" |
| ZIP ambiguous | "94103 covers more than one district. Enter your street address." + "Street address" combobox with street autocomplete (focused) |
| not found | "We couldn't find that address." + "Look it up with SF Elections" |
| data failed to load | "Couldn't load district data. Try again." |

Read the Base UI Autocomplete docs first: `sed -n 1,200p node_modules/@base-ui/react/docs/react/components/autocomplete.md`. Confirm: `Autocomplete.Root` takes controlled `value` / `onValueChange(value, details)`; choosing an item by click **or** Enter on a highlighted item calls `onValueChange` with `details.reason === "item-press"` (source: `combobox/root/AriaCombobox.js`, `handleSelection` → `REASONS.itemPress`); `filteredItems` bypasses internal filtering; `Autocomplete.Input` renders `role="combobox"`; the positioner sets `--anchor-width`. Arrow keys, Enter and Escape are handled by Base UI; don't reimplement them.

**Step 1: Write the failing e2e tests**

Append to `e2e/helpers.ts`:

```ts
// Phone and desktop each render the box; take the visible one.
export function ballotBox(page: Page) {
  return page.getByRole("region", { name: "Your ballot" }).filter({ visible: true });
}

export async function findBallot(page: Page, input: string, field = "Address or ZIP code") {
  const box = ballotBox(page);
  await box.getByRole("combobox", { name: field }).fill(input);
  await box.getByRole("button", { name: "Find" }).click();
}
```

Append to `e2e/address.spec.ts` (extend the helpers import with `ballotBox, BALLOT, findBallot`):

```ts
const UTAH_SUMMARY = "Supervisor 6 · Assembly 17 · Congress 11 · BART 9";
const UNAMBIGUOUS_ZIP = "94130";
const VOTER_PORTAL = "https://sfelections.org/tools/portal/";

test("an unambiguous ZIP fills in the ballot", async ({ page }) => {
  await openBallot(page);
  await findBallot(page, UNAMBIGUOUS_ZIP);
  await expect(ballotBox(page).getByText(/^Supervisor \d+ · Assembly \d+ · Congress \d+ · BART \d+/)).toBeVisible();
  await expect(page).toHaveURL(/[?&]d=sf\.s\d+\.a\d+\.c\d+\.b\d+\.e2/);
  await expect(ballotBox(page).getByRole("link", { name: "Confirm with SF Elections" })).toHaveAttribute("href", VOTER_PORTAL);
});

test("an ambiguous ZIP asks for the street, with keyboard autocomplete", async ({ page }) => {
  await openBallot(page);
  await findBallot(page, "94103");
  const box = ballotBox(page);
  await expect(box.getByText("94103 covers more than one district. Enter your street address.")).toBeVisible();
  const street = box.getByRole("combobox", { name: "Street address" });
  await expect(street).toBeFocused();
  await street.pressSequentially("128 Uta");
  await expect(page.getByRole("option", { name: "128 Utah St" })).toBeVisible();
  await street.press("ArrowDown");
  await street.press("Enter");
  await expect(box.getByText(UTAH_SUMMARY)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]d=${UTAH.replace(/\./g, "\\.")}`));
});

test("an unknown address says so and links to SF Elections", async ({ page }) => {
  await openBallot(page);
  await findBallot(page, "1 Nowhere St");
  const box = ballotBox(page);
  await expect(box.getByText("We couldn't find that address.")).toBeVisible();
  await expect(box.getByRole("link", { name: "Look it up with SF Elections" })).toHaveAttribute("href", VOTER_PORTAL);
  await expect(page).not.toHaveURL(/[?&]d=/);
});

test("Change reopens an empty box and shows every contest again", async ({ page }) => {
  await openBallot(page, `?d=${UTAH}`);
  await ballotBox(page).getByRole("button", { name: "Change" }).click();
  const input = ballotBox(page).getByRole("combobox", { name: "Address or ZIP code" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await expect(page).not.toHaveURL(/[?&]d=/);
  await expect(contestRow(page, "Board of Supervisors, District 8")).toBeVisible();
});

test("the box tops the filter column on desktop and sits above the Filters button on phones", async ({ page }, info) => {
  await openBallot(page);
  await expect(ballotBox(page)).toBeVisible();
  if (isPhone(info)) {
    const box = await ballotBox(page).boundingBox();
    const filters = await page.getByRole("button", { name: /Filters/ }).boundingBox();
    expect(box && filters && box.y + box.height <= filters.y).toBe(true);
    expect(box && filters && Math.abs(box.width - filters.width) < 2).toBe(true);
  } else {
    await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("region", { name: "Your ballot" })).toBeVisible();
  }
});
```

If Task 10 Step 4 picked a ZIP other than 94130, change `UNAMBIGUOUS_ZIP`.

**Step 2: Run to verify they fail**

Run: `npx playwright test e2e/address.spec.ts`
Expected: the five new tests FAIL (no region named "Your ballot"); Task 12's tests still pass.

**Step 3: Write the component**

`src/components/AddressBox.tsx`:

```tsx
"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streetIndex, suggestStreets } from "@/lib/address";
import { httpLookup, resolveInput } from "@/lib/address-lookup";
import { districtSummary, VOTER_PORTAL, type DistrictSet } from "@/lib/districts";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

const lookup = httpLookup();
const BOX = "rounded-xl bg-card p-4 ring-1 ring-foreground/10";
const LINK = "underline underline-offset-2";

type Status = "idle" | "busy" | "not-found" | "error";

export function AddressBox({
  set,
  onChange,
  className,
}: {
  set: DistrictSet | null;
  onChange: (set: DistrictSet | null) => void;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [zip, setZip] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [streets, setStreets] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => streetIndex(streets), [streets]);
  const suggestions = useMemo(() => suggestStreets(index, text), [index, text]);

  const loadStreets = () => {
    if (streets.length === 0) lookup.streets().then(setStreets, () => {});
  };

  const submit = async (value: string) => {
    if (!value.trim() || status === "busy") return;
    setStatus("busy");
    try {
      const r = await resolveInput(value, lookup);
      if (r.kind === "resolved") {
        setText("");
        setZip(null);
        setStatus("idle");
        onChange(r.set);
      } else if (r.kind === "ambiguous-zip") {
        setText("");
        setZip(r.zip);
        setStatus("idle");
        loadStreets();
        inputRef.current?.focus();
      } else {
        setStatus("not-found");
      }
    } catch {
      setStatus("error");
    }
  };

  const change = () => {
    onChange(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (set) {
    return (
      <section aria-label="Your ballot" className={cn(BOX, className)}>
        <p className="text-sm font-semibold">Your ballot</p>
        <p className="mt-1 text-sm">
          {districtSummary(set)} ·{" "}
          <Button variant="link" className="h-auto p-0 text-sm underline" onClick={change}>
            Change
          </Button>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          These are your districts, not your sample ballot.{" "}
          <ExternalLink href={VOTER_PORTAL} className={LINK}>
            Confirm with SF Elections
          </ExternalLink>
        </p>
      </section>
    );
  }

  const label = zip ? "Street address" : "Address or ZIP code";
  return (
    <section aria-label="Your ballot" className={cn(BOX, className)}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <p className="text-sm font-semibold">Your ballot</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {zip ? `${zip} covers more than one district. Enter your street address.` : "See only the contests you'll vote on. Your address stays on this device."}
        </p>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <div className="mt-2 flex gap-2">
          <Autocomplete.Root
            items={suggestions}
            filteredItems={suggestions}
            value={text}
            onValueChange={(value, details) => {
              setText(value);
              if (status === "not-found" || status === "error") setStatus("idle");
              if (details.reason === "item-press") void submit(value);
            }}
          >
            <Autocomplete.Input
              id={id}
              ref={inputRef}
              render={<Input className="h-10 flex-1" />}
              placeholder={zip ? "123 Main St" : "123 Main St or 94110"}
              autoComplete="off"
              onFocus={loadStreets}
              aria-invalid={status === "not-found" || undefined}
            />
            {suggestions.length > 0 ? (
              <Autocomplete.Portal>
                <Autocomplete.Positioner sideOffset={4} className="isolate z-50">
                  <Autocomplete.Popup className="max-h-72 w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
                    <Autocomplete.List>
                      {(item: string) => (
                        <Autocomplete.Item key={item} value={item} className="flex min-h-10 cursor-default items-center rounded-md px-2 data-highlighted:bg-muted">
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            ) : null}
          </Autocomplete.Root>
          <Button type="submit" variant="outline" className="h-10" disabled={status === "busy"}>
            Find
          </Button>
        </div>
        {status === "not-found" ? (
          <p role="status" className="mt-2 text-sm">
            We couldn&apos;t find that address.{" "}
            <ExternalLink href={VOTER_PORTAL} className={LINK}>
              Look it up with SF Elections
            </ExternalLink>
          </p>
        ) : null}
        {status === "error" ? (
          <p role="status" className="mt-2 text-sm">
            Couldn&apos;t load district data. Try again.
          </p>
        ) : null}
      </form>
    </section>
  );
}
```

The address exists only in `text` (component state). Do not lift it, log it, or pass it to `onChange`.

**Step 4: Place it**

`src/components/FilterPanel.tsx`: change `FilterSidebar` (lines 35-43) to accept a `top` slot:

```tsx
export function FilterSidebar({ className, top, ...props }: Props & { className?: string; top?: ReactNode }) {
  return (
    <aside aria-label="Filters" className={className}>
      {top}
      <p className="text-sm font-semibold">Filters</p>
      <p className="text-sm text-muted-foreground">{countedLabel(filterSummary(props.filters, props.guides, props.files))}</p>
      <FilterControls {...props} />
    </aside>
  );
}
```

(`ReactNode` is already imported there.)

`src/components/BallotView.tsx`:

- Import `AddressBox` from `./AddressBox` and `type DistrictSet` from `@/lib/districts`.
- After `useDistricts()` add:

```tsx
  const [showAll, setShowAll] = useState(false);
  const onDistricts = (next: DistrictSet | null) => {
    setShowAll(false);
    setDistrictSet(next);
  };
```

(`showAll` is used in Task 14.)

- Desktop, the `FilterSidebar` line (around line 126):

```tsx
      <FilterSidebar
        {...filterProps}
        top={<AddressBox set={districtSet} onChange={onDistricts} className="mb-6" />}
        className={cn(PANE, "js-only lg:pr-2")}
      />
```

- Phone, directly above `<FiltersSheet … />` (line 135):

```tsx
          <AddressBox set={districtSet} onChange={onDistricts} className="js-only mt-3 lg:hidden" />
```

**Step 5: Run tests and checks**

Run: `npx playwright test e2e/address.spec.ts && npm run lint && npx next typegen && npx tsc --noEmit`
Expected: all address tests PASS on phone and desktop; lint and types clean.

If "ArrowDown, Enter" doesn't select the option, check in the docs whether `autoHighlight` changes what ArrowDown does from the input; fix the component, not the test. If clicking **Find** while the popup is open is swallowed as an outside press, set `modal={false}` explicitly on `Autocomplete.Root` and re-check.

Then look at it: `npm run dev`, open `http://localhost:3000/2026-11` at desktop width and at 390 px, in light and dark mode, and walk through every state in the table above.

**Step 6: Commit**

```bash
git add src/components/AddressBox.tsx src/components/FilterPanel.tsx src/components/BallotView.tsx e2e/helpers.ts e2e/address.spec.ts
git commit -m "feat(ballot): Your ballot box with ZIP and street lookup"
```

---

### Task 14: List header with "Show all"

**Files:**
- Modify: `src/components/BallotView.tsx` (header below the phone `FiltersSheet`, list from `showAll`)
- Test: `e2e/address.spec.ts` (append)

**Step 1: Write the failing e2e test**

```ts
test("the list header counts hidden contests and Show all brings them back", async ({ page }) => {
  await openBallot(page, `?d=${UTAH}`);
  await expect(page.getByText("45 contests on your ballot · 7 others hidden")).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByText("Showing all 52 contests")).toBeVisible();
  await expect(contestRow(page, "Board of Supervisors, District 8")).toBeVisible();
  await page.getByRole("button", { name: "Only your ballot" }).click();
  await expect(contestRow(page, "Board of Supervisors, District 8")).toHaveCount(0);
});

test("no header without districts", async ({ page }) => {
  await openBallot(page);
  await expect(page.getByText(/on your ballot ·/)).toHaveCount(0);
});
```

**Step 2: Run to verify it fails**

Run: `npx playwright test e2e/address.spec.ts -g "header"`
Expected: the first test FAILS (text not found).

**Step 3: Implement**

In `src/components/BallotView.tsx`, import `ballotLine` from `@/lib/districts`, then change `const visible = sections(shown);` to:

```ts
  const visible = sections(showAll ? ballot.contests : shown);
```

and add directly after the phone `<FiltersSheet … />` line (and its `<noscript>`):

```tsx
          {districtSet && hidden.length > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {showAll ? `Showing all ${ballot.contests.length} contests` : ballotLine({ shown: shown.length, hidden: hidden.length })} ·{" "}
              <Button variant="link" className="h-auto p-0 text-sm text-foreground underline" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Only your ballot" : "Show all"}
              </Button>
            </p>
          ) : null}
```

**Step 4: Run tests**

Run: `npx playwright test e2e/address.spec.ts && npm run lint`
Expected: PASS; lint clean.

**Step 5: Commit**

```bash
git add src/components/BallotView.tsx e2e/address.spec.ts
git commit -m "feat(ballot): contests-on-your-ballot header with Show all"
```

---

### Task 15: Analytics allowlist, referrer policy, About privacy note

**Precondition:** PR #13 (`feat: analytics, sitemap, robots, canonical URLs`) is merged into `main`. It landed as `6307935` on 2026-10-06; check with `gh pr view 13 --json state` (expect `MERGED`). If it isn't merged, skip to Task 16 and come back.

**Files:**
- Modify: `src/lib/analytics.ts` (from #13: denylist `PRIVATE_PARAMS` → allowlist)
- Modify: `tests/analytics.test.ts` (from #13)
- Modify: `next.config.ts` (referrer policy header)
- Modify: `src/app/about/page.tsx` (Privacy section from #13)
- Test: `e2e/address.spec.ts` (append)

**Step 1: Bring #13 into this branch**

```bash
git fetch origin
git log --oneline origin/main..HEAD   # this branch's commits only
git rebase origin/main
```

If the branch has already been pushed and reviewed, use `git merge origin/main` instead of rebasing. Resolve conflicts (likely only `src/components/BallotView.tsx` or `e2e/ballot.spec.ts`), then run `npm test` and `npx playwright test e2e/address.spec.ts` to confirm nothing regressed.

**Step 2: Write the failing unit tests**

Replace the `scrubUrl` block in `tests/analytics.test.ts` with:

```ts
describe("scrubUrl", () => {
  it("keeps only the filter params", () => {
    expect(
      scrubUrl("https://bayballot.com/2026-11?addr=1+Main+St&zip=94110&q=prop&c=prop-b&why=1&d=sf.s6.a17.c11.b9.e2&utm_source=x&off=a,b&offtypes=club"),
    ).toBe("https://bayballot.com/2026-11?c=prop-b&why=1&d=sf.s6.a17.c11.b9.e2&off=a%2Cb&offtypes=club");
  });
  it("drops params it doesn't list, whatever their case", () => {
    expect(scrubUrl("https://bayballot.com/2026-11?ZIP=94110&Addr=x&C=prop-b")).toBe("https://bayballot.com/2026-11");
  });
  it("drops the fragment", () => {
    expect(scrubUrl("https://bayballot.com/2026-11?c=prop-b#128-utah-st")).toBe("https://bayballot.com/2026-11?c=prop-b");
  });
  it("leaves URLs without params alone", () => {
    expect(scrubUrl("https://bayballot.com/about")).toBe("https://bayballot.com/about");
  });
});
```

Keep the existing `beforeSend` tests unchanged.

**Step 3: Run to verify they fail**

Run: `npx vitest run tests/analytics.test.ts`
Expected: FAIL on "keeps only the filter params" (`utm_source` survives) and "drops the fragment".

**Step 4: Implement the allowlist**

In `src/lib/analytics.ts` replace the comment, `PRIVATE_PARAMS` and `scrubUrl` with:

```ts
// Allowlist: a new query param stays out of analytics until it is added here on purpose.
const ALLOWED_PARAMS = new Set(["c", "d", "off", "offtypes", "why"]);

export function scrubUrl(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) {
    if (!ALLOWED_PARAMS.has(key)) u.searchParams.delete(key);
  }
  u.hash = "";
  return u.toString();
}
```

Run: `npx vitest run tests/analytics.test.ts`
Expected: PASS.

**Step 5: Write the failing e2e tests for the referrer policy and About**

Append to `e2e/address.spec.ts`:

```ts
test("pages set a strict referrer policy", async ({ page }) => {
  for (const path of [BALLOT, "/about"]) {
    const res = await page.goto(path);
    expect(res?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  }
});

test("the About page says addresses stay in the browser", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByText("Addresses and ZIP codes you enter stay in your browser.")).toBeVisible();
});
```

Run: `npx playwright test e2e/address.spec.ts -g "referrer|About"`
Expected: both FAIL.

**Step 6: Implement**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
};

export default nextConfig;
```

`src/app/about/page.tsx`, in the `Privacy` section's `<List>` (added by #13), add after the existing two items:

```tsx
            <li>
              Addresses and ZIP codes you enter stay in your browser. Only the resulting districts are saved, in the page link and on this device.
            </li>
```

**Step 7: Run tests**

Run: `npm test && npx playwright test e2e/address.spec.ts`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/lib/analytics.ts tests/analytics.test.ts next.config.ts src/app/about/page.tsx e2e/address.spec.ts
git commit -m "feat(privacy): analytics param allowlist, referrer policy, address note on About"
```

---

### Task 16: Remaining end-to-end coverage from the design

**Files:**
- Test: `e2e/address.spec.ts` (append)

Covered so far: unambiguous ZIP, ambiguous ZIP → street, not found, Change, Show all, URL code through filter changes and reload, placement, referrer, About. This task adds: a resolved address survives a reload and a visit without `?d=`, and the address never reaches the URL, storage, or any request except its own street file.

**Step 1: Write the tests**

```ts
test("the result survives a reload and a visit without the code", async ({ page }) => {
  const errors = watchErrors(page);
  await openBallot(page);
  await findBallot(page, "128 Utah St");
  await expect(ballotBox(page).getByText(UTAH_SUMMARY)).toBeVisible();
  await page.reload();
  await expect(ballotBox(page).getByText(UTAH_SUMMARY)).toBeVisible();
  await page.goto(BALLOT);
  await expect(ballotBox(page).getByText(UTAH_SUMMARY)).toBeVisible();
  await expect(contestRow(page, "Board of Supervisors, District 8")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the address never reaches the URL, storage, or any request but its street file", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await openBallot(page);
  await findBallot(page, "128 Utah St #4");
  await expect(ballotBox(page).getByText(UTAH_SUMMARY)).toBeVisible();

  expect(page.url()).not.toMatch(/utah|128|%234/i);
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stored).not.toMatch(/utah|128/i);
  expect(await page.evaluate(() => localStorage.getItem("bb-districts"))).toBe(UTAH);

  const mentions = [...new Set(requests.filter((u) => /utah/i.test(u)).map((u) => new URL(u).pathname))];
  expect(mentions).toEqual(["/districts/sf/streets/utah-st.json"]);
  expect(requests.filter((u) => /[?&/=]128\b|%23/.test(new URL(u).pathname + new URL(u).search))).toEqual([]);
});
```

**Step 2: Run**

Run: `npx playwright test e2e/address.spec.ts`
Expected: PASS on both projects. These test behavior already built; if one fails, it found a real leak or a persistence bug: fix the code, not the test. (If the `128` request check trips on a Next.js asset name, narrow it to requests under `/districts/` rather than loosening the pattern.)

**Step 3: Run the whole suite the way CI does**

```bash
npm run validate && npm test && npx next typegen && npx tsc --noEmit && npm run lint && npm run build && npm run e2e
```

Expected: all green.

**Step 4: Commit**

```bash
git add e2e/address.spec.ts
git commit -m "test(e2e): address filter persistence and privacy"
```

---

### Task 17: Runbook

**Files:**
- Modify: `docs/runbook.md` (new section before `## Manual guides`, line 58)

**Step 1: Add the section**

```markdown
## District data (address filter)

The "Your ballot" box looks addresses up in `public/districts/sf/`, a static index built from three sources and committed to the repo. Nothing is looked up at run time; the address never leaves the visitor's browser (only the street file for their street is requested from our own host).

**Rebuild** when a source changes: SF Elections publishes new precincts, a new election adds districted contests to `data/<election>/ballot.yml`, or before each election to pick up new addresses (DataSF updates addresses nightly; a monthly rebuild during the season is plenty).

    npm run bb -- districts --refresh   # downloads about 60 MB into .cache/districts (gitignored)
    npm test                            # tests/district-data.test.ts checks the committed files
    git status public/districts         # review, then commit as "data: SF district index YYYY-MM-DD"

Without `--refresh` it reuses the cached downloads. The command writes nothing if a check fails.

**Sources** (details in `docs/investigations/2026-10-06-sf-address-district-data.md`):

- Addresses: DataSF `3mea-di5p` (EAS base addresses), Socrata JSON API.
- Precincts and their districts: DataSF `d6x4-hefw` (columns `prec_2022`, `supe22`, `assemb22`, `cong22`, `bart22`, `boe22`).
- Congress (Prop 50 / AB 604): `https://statewidedatabase.org/pub/data/d25/AB604%202025-08-16.zip`, lon/lat NAD83.

If DataSF renames a column, the build fails on the first missing field. Update the field constants in `src/pipeline/district-sources.ts` and their tests.

**What the errors mean:**

- *addresses outside every precinct*: an address's coordinates fall outside the precinct file. Usually a stale precinct file or a bad coordinate.
- *Supervisor district disagrees*: the address file's own Supervisor district differs from its precinct's. Means the precinct file and the address file disagree about a boundary; don't ship until it's explained.
- *precincts with an unknown district*: a district outside the expected sets in `SF` (`src/pipeline/districts.ts`). Update the sets only if SF's districts really changed.
- *districted contests no address can reach*: a contest in `ballot.yml` whose district no SF precinct has. Usually a typo in `jurisdiction`.
- *congress district disagrees with the Prop 50 map*: the precinct file's `cong22` no longer matches the Prop 50 map. Don't ship until resolved.
- *street files over 16384 bytes*: one street's ranges grew past the limit. Check the street; raise `MAX_STREET_FILE_BYTES` only deliberately.

**Spot check** after a rebuild: on the ballot page, enter `128 Utah St` (expect Supervisor 6 · Assembly 17 · Congress 11 · BART 9) and `94103` (expect it to ask for the street). The not-found message links to SF Elections' Voter Portal, `https://sfelections.org/tools/portal/`; if that page moves, update `VOTER_PORTAL` in `src/lib/districts.ts`.

**Privacy rules** to keep when changing this feature: the address stays in `AddressBox` state; only the district code (`?d=sf.s6.a17.c11.b9.e2`, localStorage `bb-districts`) is stored; analytics keeps only the params listed in `src/lib/analytics.ts`.
```

**Step 2: Commit**

```bash
git add docs/runbook.md
git commit -m "docs: district data runbook"
```

---

### Task 18: Changelog entry

**Precondition:** the changelog page has landed on `main` with `data/changelog.yml` (entries `{ date, type: new | data | fix, title, details?, pr? }`). After `git fetch origin && git rebase origin/main` (or merge, as in Task 15), check: `test -f data/changelog.yml && head -30 data/changelog.yml`. If the file isn't there yet, stop here and tell Sean; this task waits for it.

**Files:**
- Modify: `data/changelog.yml`

**Step 1: Read the file and its schema**

Read `data/changelog.yml` and the schema/test that validates it (`grep -rn changelog src/lib tests scripts`). Match its ordering (newest first or last), date format and quoting exactly.

**Step 2: Add the entry**

```yaml
- date: YYYY-MM-DD
  type: new
  title: See only the contests on your ballot
  details: Enter your San Francisco address or ZIP code and the list shows just the contests you'll vote on. Your address stays in your browser; only your districts are remembered, in the page link and on your device.
  pr: <PR number>
```

Use the date the PR merges (or today's date if the entry ships in the same PR) and the PR number once the PR exists. Visitor-facing wording only: no "precinct", "EAS" or "district code".

**Step 3: Validate**

Run: `npm run validate && npm test`
Expected: PASS (the changelog schema accepts the entry).

**Step 4: Commit**

```bash
git add data/changelog.yml
git commit -m "docs(changelog): address filter"
```

---

## Open questions and risks

- **BOE in the district code.** The plan's code includes `e2` (`sf.s8.a17.c11.b8.e2`); the design's example omits it. Including it keeps the code a full description of a precinct and handles counties split between BOE districts. The visible summary omits BOE, as designed. Sean to confirm.
- **Street name in requests.** Fetching `/districts/sf/streets/<slug>.json` tells our static host (Vercel access logs) the street, never the house number. That follows the approved per-street layout. If that's not acceptable, bucket streets into ~64 files by a hash of the slug; the lookup API in Task 11 stays the same.
- **ZIP ambiguity is by full district set.** A ZIP whose precincts differ only in a district with no contest this year (e.g. Supervisor 1 vs 3, or BART 7 vs 9) still asks for the street. Comparing only the districts that change the ballot would resolve more ZIPs, but needs a rule for which code to store. Kept to the design's "one district set → done".
- **Precinct file is dated 2023-09-13.** If SF Elections redrew precincts for Nov 2026, the Supervisor cross-check is the first place it will show. Task 10 says to stop and report rather than loosen a check.
- **Normalization collisions.** EAS has both `SIXTH ST` and `06TH ST`, which normalize to one key. Overlapping numbers become ambiguous and show "not found" with the SF Elections link; non-overlapping numbers merge. The build output doesn't count these yet; if it matters, add a stat in Task 8.
- **Base UI Autocomplete keyboard behavior** (ArrowDown highlights the first option, Enter on it fires `item-press`, clicking Find with the popup open) is from reading 1.8.0's source; Task 13's e2e test is the check.
- **Analytics keeps `d`.** Per the design ("every query parameter except the known filter ones is dropped"), the district code is sent with page views. It is coarse (districts, not precincts), but Sean may prefer to drop it too.
