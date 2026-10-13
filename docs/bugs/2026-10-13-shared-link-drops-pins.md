# A shared link without pin= wiped the reader's saved pins

- **Date**: 2026-10-13
- **Area**: `src/lib/filters.ts` (`initialFilters`), `src/components/useBallotFilters.ts`

## Symptom

A reader pins a guide or two, then opens a link someone shared that turns a guide off or shows only guides that explain (`?off=sf-gop` or `?why=1`). The ballot shows no pinned picks. If they then change any filter, their pins are gone for good, even after going back to the plain ballot page (issue #165).

A link that carries the sharer's own pins (`?off=sf-gop&pin=spur`) did the same harm by a different route. The reader rightly sees SPUR pinned while the link is open, but their next filter change saved `pin=spur` over their own saved pins.

## Root cause

`initialFilters` chose between the URL and the stored filters (`bb-filters` in localStorage) as a whole: if the URL had any filter param (`off`, `offtypes`, `why`, `pin`), the stored string was ignored entirely. Pins were added later (PR #162) as one more param in the same string, so a link with only `off=` or `why=` produced `pins: []`. The next `setFilters` call writes `toQuery(filters)` to both the URL and `bb-filters`, so that empty pin list overwrote the saved one. The shared-pins case is the same write: `setFilters` saved whatever pins were on screen, including ones the reader only saw because a link carried them.

## Repro

1. Open `/2026-11/sf`, pin SPUR. `bb-filters` holds `pin=spur`.
2. Open `/2026-11/sf?off=sf-gop`. No pinned chips show on Proposition B.
3. Tick "Only guides that explain their endorsements". `bb-filters` becomes `off=sf-gop&why=1` with no `pin`.
4. Open `/2026-11/sf`. SPUR is no longer pinned.

The new e2e test in `e2e/pins.spec.ts` fails at step 2 on the old code.

Shared pins: pin SF Chronicle on `/2026-11/sf`, open `/2026-11/sf?off=sf-gop&pin=spur`, tick "Only guides that explain", then open `/2026-11/sf`. SPUR is pinned and SF Chronicle is gone.

## Fix

Each `Filters` key is now either shared or reader-owned (`SHARED_KEYS` and `READER_KEYS` in `src/lib/filters.ts`). Shared filters (`off`, `why`) are the view a link describes. Reader-owned ones (`pins`) are the reader's own list.

- Reading (`initialFilters`): shared filters come from the URL when it has filter params. Pins come from the URL only if it has at least one known guide; otherwise the stored pins show.
- Writing (`savedFilters`, called from `setFilters` in `src/components/useBallotFilters.ts`): the URL always gets everything on screen, so a shared link keeps its `pin=` and the view doesn't jump. Storage gets the shared filters plus the stored pins, unless this change was to pins (pin or unpin). In that case it saves the full list on screen.
- Reset filters keeps the pins on screen, so it is not a pin change and the stored pins stay as they were. Pinning or unpinning while a shared link's pins are showing saves that whole visible list, since the reader acted on pins. Unpinning everything saves an empty list.

## Verification

- `npx vitest run tests/filters.test.ts`: `initialFilters` cases for stored pins under `off=`, `why=` and legacy `offtypes=` links, sanitizing stored pins (unknown ids, more than `MAX_PINS`), a link's own pins winning, all-unknown or empty `pin=` falling back, and nothing stored. `savedFilters` cases for a non-pin change and Reset keeping stored pins, and pin/unpin saving the visible list.
- `e2e/pins.spec.ts`:
  - "a link with only off=/why= keeps the saved pins through the next filter change" checks the URL has no `pin` before any click, and that the link's own param and `pin=spur` are both there after the change.
  - "a link with someone else's pins shows them, but a filter change doesn't save them over the reader's".
  - Both fail on the old code. With the pins, contest-filters, ballot and fallback specs on phone and desktop: 177 passed, 0 failed.

## Guardrail

`tests/filters.test.ts` "classifies every filter as shared or reader-owned" fails until a new `Filters` key is added to `SHARED_KEYS` or `READER_KEYS`. Both `initialFilters` and `savedFilters` loop over `READER_KEYS`, so classifying a key as reader-owned gives it the same fallback and save rules as pins.
