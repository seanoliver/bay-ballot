# Candidate surnames matched common words in the page gate

- **Date**: 2026-10-07
- **Area**: `src/pipeline/pagestore.ts` (`nameMarkers`, which decides whether a changed line names a candidate)

## Symptom

After Santa Clara County's candidates were added, two page-gate tests failed: a club page changing "picnic in the park" to "potluck" was classed as a relevant change. In production every guide page mentioning a park or a hall would be re-extracted, at a model cost, whenever that line changed.

## Root cause

The gate matched each candidate's surname alone, case-insensitively. New surnames are also English words: Kevin Park, Tomara Hall, Carson Dance, and others such as Wright and Cooper. "the park" matched "Park".

A first fix made surname-only markers case-sensitive. Review found that this missed slates set in capitals ("VEENKER", "PARK", "ARMENDÁRIZ").

## Repro

`tests/pagestore.test.ts`, "matches a surname alone in its own case or in capitals, not as a lowercase word":
- With case-insensitive surnames, "We had a picnic in the park by a hall" counts as relevant.
- With case-sensitive only, "VEENKER spoke to the members…" does not.

## Fix

A surname on its own now matches either as written ("Park") or in all capitals ("PARK"), never in lowercase. Full names still match in any case.

## Verification

`npx vitest run tests/pagestore.test.ts`:
- Red on the all-caps line before the second change; 32 passed after.
- The full suite passes.

## Guardrail

The test covers a lowercase common word (not relevant), a capitalized surname at line start, and all-caps surnames, including one with an accent (all relevant).
