# Refresh drops a pick when a guide misspells a candidate

- **Date**: 2026-10-14
- **Area**: `src/lib/names.ts`, `src/pipeline/extract.ts` (`toEntries`), `src/pipeline/refresh.ts`, `src/pipeline/write.ts` (`nextFile`), `src/pipeline/verify.ts`

## Symptom

Two refreshes removed picks that were still on the guide's page. sf-labor-council's page said "Manuhar Raju" for the public defender, whom the ballot lists as "Mano Raju" (#152). smdj's page said "Deborah Ruddock" for Half Moon Bay council district 4, where the ballot had "Debbie Ruddock" (#155). Tracked in #175.

## Root cause

`toEntries` maps each extracted name through `matchName`, which accepts exact names, accents, dropped middle names and initials, and listed aliases. A name it rejects drops the whole pick with a `PICK DROPPED` note, since a partial pick changes its meaning. A one-letter slip or a formal first name for a short one fails `matchName`, so the refresh removed the published pick. A person had to read the note, find the spelling, add an alias and restore the pick.

## Repro

On the old code, `toEntries` with a pick of `["Scott Weiner"]` for `us-rep-11` returns no pick for that contest and the note `us-rep-11: PICK DROPPED — unknown candidate 'Scott Weiner'`.

## Fix

- `suggestName` (`src/lib/names.ts`) returns the one candidate a rejected name is close to: first names one edit apart or sharing their first three letters, last names equal or (5+ letters) one edit apart, where two swapped letters count as one edit. It checks aliases and nickname variants, and returns nothing when two candidates are close.
- `toEntries` holds such a pick under `held:` with the new reason `name-mismatch`, the suggested candidate as its pick, and evidence naming the page's spelling. Names close to no candidate are still dropped.
- When the file already publishes that same pick (the #152 and #155 cases), the refresh keeps it published and adds a note, since the same guide names the same candidate for the same contest.
- The refresh adds these holds to the file and to the run's held list, so the PR is labeled for review and the run exits 2.
- `nextFile` drops a previous `name-mismatch` hold, since each extraction rebuilds it; once an alias makes the name match, the next extraction publishes the pick. A rebuilt hold with the same pick, ranking and evidence as the file's existing one is kept and not reported again. The verifier neither checks nor releases these holds (`isPersonHold` in `src/lib/schema.ts`).
- The page's spelling goes into the evidence as inline code on one line, since it reaches the PR body.

## Verification

- New tests in `tests/names.test.ts`, `tests/extract.test.ts`, `tests/write.test.ts`, `tests/verify.test.ts` and `tests/refresh.test.ts`, including the real #152 spelling against the ballot's "Mano Raju".
- Mutation checks: each new guard fails a test when removed (the prefix rule, swapped letters, the 5-letter last-name limit, the single-match rule, the hold and duplicate check in `toEntries`, `nextFile`, the verifier skip, the refresh paths, keeping a published pick, hold reuse, rejected quotes and evidence escaping).

## Guardrail

- A near name now holds the merge with the suggested candidate in the PR summary, instead of silently removing a pick.
- `suggestName` never publishes; only an alias or a person moving the pick releases it.
