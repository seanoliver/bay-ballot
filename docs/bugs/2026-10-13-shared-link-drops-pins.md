# A shared link without pin= wiped the reader's saved pins

- **Date**: 2026-10-13
- **Area**: `src/lib/filters.ts` (`initialFilters`), `src/components/useBallotFilters.ts`

## Symptom

A reader pins a guide or two, then opens a link someone shared that turns a guide off or shows only guides that explain (`?off=sf-gop` or `?why=1`). The ballot shows no pinned picks. If they then change any filter, their pins are gone for good, even after going back to the plain ballot page (issue #165).

## Root cause

`initialFilters` chose between the URL and the stored filters (`bb-filters` in localStorage) as a whole: if the URL had any filter param (`off`, `offtypes`, `why`, `pin`), the stored string was ignored entirely. Pins were added later (PR #162) as one more param in the same string, so a link with only `off=` or `why=` produced `pins: []`. The next `setFilters` call writes `toQuery(filters)` to both the URL and `bb-filters`, so that empty pin list overwrote the saved one.

## Repro

1. Open `/2026-11/sf`, pin SPUR. `bb-filters` holds `pin=spur`.
2. Open `/2026-11/sf?off=sf-gop`. No pinned chips show on Proposition B.
3. Tick "Only guides that explain their endorsements". `bb-filters` becomes `off=sf-gop&why=1` with no `pin`.
4. Open `/2026-11/sf`. SPUR is no longer pinned.

The new e2e test in `e2e/pins.spec.ts` fails at step 2 on the old code.

## Fix

`initialFilters` still takes `off` and `why` from the URL when it has filter params, but takes pins from storage unless the URL itself has a `pin` param. Pins are the reader's own list rather than part of the view someone shared. A URL `pin=` (even empty) still wins, and unpinning writes a stored string without `pin`, so an empty pin list stays reachable. Because `setFilters` writes the whole `Filters` object back, the next change puts the restored pins into the URL and storage.

## Verification

- `npx vitest run tests/filters.test.ts`: new cases for stored pins with `off=`/`why=` links, URL `pin=` winning (including empty), and no pins after unpinning.
- `e2e/pins.spec.ts` "a link with only off=/why= keeps the saved pins through the next filter change", on phone and desktop: fails on the old code, passes with the fix.
- `e2e/pins.spec.ts`, `contest-filters.spec.ts`, `ballot.spec.ts`, `fallback.spec.ts` on phone and desktop: 175 passed, 0 failed.

## Guardrail

The unit and e2e tests above. When a new param joins `Filters`, decide whether it belongs to the shared view (taken from the URL) or to the reader (kept from storage when the URL lacks it), and add an `initialFilters` case for it.
