# Fallback reasons-only e2e test read the count before the filter applied

- **Date**: 2026-10-08
- **Area**: `e2e/fallback.spec.ts`

## Symptom

CI failed on PR #77: "the reasons-only filter applies to the Bay Area tally" got `expect(4).toBeLessThan(4)` on phone and desktop, retries included. The same test passed locally.

## Root cause

The ballot page is server-rendered without filters. `?why=1` is read in the browser (`src/lib/filters.ts`, via `useBallotFilters`) and only applies after hydration. The test read the "N guides from across the Bay Area" label once, right after `page.goto`. On the slower CI runner that read happened before hydration, so it saw the unfiltered count.

## Repro

Run the old test on a slow machine, or throttle the CPU, so the `textContent()` call runs before hydration finishes.

## Fix

`e2e/fallback.spec.ts`: read the unfiltered count first, then load `?why=1` and `expect.poll` until the count drops below it.

## Verification

`npx playwright test e2e/fallback.spec.ts --retries=0 --repeat-each=3`: 78 passed, 3 skipped. CI on PR #77 re-run after push.

## Guardrail

Any e2e assertion on a value that a client-side filter changes must use a retrying assertion (`expect(locator).toHaveText`, `expect.poll`), not a single `textContent()` read.
