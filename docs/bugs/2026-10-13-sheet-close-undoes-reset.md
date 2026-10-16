# Closing the phone Filters sheet undid a Reset that cleared the query

- **Date**: 2026-10-13
- **Area**: `src/lib/sheet-history.ts`, phone Filters sheet

## Symptom

On a phone, with guides turned off (for example after "Count only these N on the ballot" on a contest page), opening Filters, tapping Reset filters and then Close put the old `off=` list back. The counted-guides number jumped back with it.

## Root cause

The sheet pushes a history entry when it opens. Closing it from the UI calls `history.back()`, and `sheetStep` remembers the query changed while open (`restore`) so it can put it on the entry `back()` lands on. The dismiss branch tested `changed(state) ? ...`, so a change to an empty query (`""`, what Reset leaves when nothing is pinned) was falsy and dropped. `back()` then landed on the entry that still had the old `off=` list.

## Repro

Phone viewport, `/2026-11/prop-d`: tap "Count only these 17 on the ballot", open Filters, Reset filters, Close. The URL gets `?off=...` back. Any change that ends with no query at all hit it, it was not specific to Count only.

## Fix

`sheetStep`'s dismiss branch compares `changed(state)` to `null` instead of testing truthiness (`src/lib/sheet-history.ts`).

## Verification

`npx vitest run tests/sheet-history.test.ts`; `e2e/contest-pins.spec.ts` "Count only ... Reset filters undoes it" passes on the phone project.

## Guardrail

Unit test "survive closing from the UI when they clear the query" in `tests/sheet-history.test.ts`, and the phone run of `e2e/contest-pins.spec.ts` "an only= link counts just its guides, and Reset then Close leaves no filter in the URL" (the Count only test it replaced was removed with the button in #206).
