# Your vote offered only Leave blank on judge retentions

- **Date**: 2026-10-26
- **Area**: `src/components/YourVote.tsx`

## Symptom

On a retention contest such as Supreme Court Associate Justice Kelli M. Evans, the Your vote box showed one button, Leave blank, and no Yes or No.

## Root cause

`Contest.kind` has three values: `candidate`, `measure` and `retention`. `YourVote` chose the Yes/No/Blank buttons with `kind === "measure"`, so a retention fell through to the candidate list. A retention has no candidates, which left only Leave blank.

## Repro

Start your ballot, then open `/2026-11/supreme-court-evans` before Nov 4.

## Fix

`YourVote` now shows the candidate list only for `kind === "candidate"` and Yes/No/Blank for everything else.

## Verification

`npx playwright test e2e/your-ballot.spec.ts -g retention` passes on phone and desktop, and fails on the old component (one button instead of three).

## Guardrail

The e2e test "a judge's retention takes Yes, No or Blank". When adding a contest kind, grep for `kind ===` across `src/components` to find branches that list the kinds one by one.
