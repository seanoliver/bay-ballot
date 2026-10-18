# County page verdict contradicts the contest page

- **Date**: 2026-10-18
- **Area**: `src/lib/area-view.ts` (area list view), `src/lib/fallback.ts` (removed)

## Symptom

A reader saw Supreme Court Justice Groban on the Alameda County page as "No 100%, 1 of 1 guide", while the contest page said "Yes 71%, 5 of 7 guides". Same race, opposite verdicts.

## Root cause

`areaView` filtered the guides as well as the contests by area: `areaGuides(s.guides, area)` kept only guides whose `areas` list holds the page's id, and only their files were counted. Of the seven guides that picked Groban, only Reform California is tagged `alameda-county`, so the Alameda row tallied one No. Most guides aren't county-specific, so which guides counted on a county page was arbitrary.

A Bay Area "fallback" (`fallbackFor`, `ScopeSwitch`, `BayBlock`, the `bb-scope` choice) patched this only for state races that no local guide had picked. Groban had one local pick, so it got no fallback and showed the local-only verdict.

## Repro

On the old code: open `/2026-11/alameda-county`, find "Supreme Court Associate Justice Joshua Groban" (row reads No), then open `/2026-11/supreme-court-groban` (reads Yes 71%, 7 guides).

## Fix

- `src/lib/area-view.ts`: county and city lists still show only their contests (`areaContests`), but count every published guide's picks, like the Bay Area list. The list's guide pool is the guides covering the area plus any guide that picked one of its contests, so the filter sidebar and intro don't list guides with nothing on this ballot. The pending note and the No pick group still go by the area's guides (`noPickScope` / `areaNoPick` keep their rule).
- Removed the fallback system: `src/lib/fallback.ts`, `src/components/ScopeSwitch.tsx`, the section switch and Bay Area blocks in `BallotView`, `ContestDetail`'s `fallback` prop, and their tests.
- `src/app/about/page.tsx`: "How are guides counted?" said an area's page counts only its guides; it now says every page counts every guide.
- `src/lib/detail.ts`: new `localFirst`, used by `detailSides({ local })`, lists the guides covering the page's area first within each pick. Area lists pass `AreaView.local`; the contest page passes the guides for `contestPlace`'s area.

## Verification

- `npx vitest run`: all pass, including the new cases in `tests/area-view.test.ts` (Groban counts the same guides on Alameda and the Bay Area), `tests/site-data.test.ts`, `tests/detail.test.ts` (`localFirst`) and `tests/contest-pins.test.ts`.
- `e2e/county-counts.spec.ts`: the Alameda row, its pane and the contest page show the same Groban verdict, and in the Alameda pane Reform California comes before Contra Costa Republican Party in No.

## Guardrail

`tests/area-view.test.ts` checks that a statewide contest counts the same guides on a county list and on the Bay Area list. `e2e/county-counts.spec.ts` checks it in the browser against the contest page. Per-area guide tags now only change order and the No pick and pending scope, never a count.
