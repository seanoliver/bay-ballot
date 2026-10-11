# Re-extract drops valid quotes on unchanged picks

- **Date**: 2026-10-10
- **Area**: data pipeline (`src/pipeline/extract.ts`, `src/pipeline/refresh.ts`)

## Symptom

Daily refreshes removed quotes from picks whose page text had not changed. The 2026-10-10 refresh (#135) dropped about 45 quotes across 5 guides when only page noise changed (ads, related-article lists, view counts), and review put 43 of them back by hand. #130 lost about 100 and #131 lost 6 on SF Chronicle. Each loss shows up as quote churn in the data diff and the changelog, and costs a reviewer time to restore.

## Root cause

A relevant page change sends the whole guide back through the model, and `refreshGuide` wrote whatever quotes the model returned this time. The model picks up to 3 quotes per pick fresh on every run and often omits sentences it chose before, so a pick could come back with fewer quotes even though every old quote was still on the page under the same heading. Nothing in the pipeline compared the new quotes with the previous file.

The #130 "fix" was not a code change. During that PR's review, the dropped quotes were restored into the data files by hand and rechecked with the extractor's quote checks (the same checks `toEntries` runs). The commit `data: fix the 2026-10-10 refresh per review` in #130 touched only `data/`, so the next refresh had the same behaviour.

## Repro

On the old code, give a guide a pick with a quote that is on its stored page, change the page in a way the page gate counts as relevant, and have the model return the same pick with no quotes. `tests/refresh.test.ts` "keeps a still-valid quote the re-extract omitted" does this with a fake client: on the old code the quote disappears, the pick counts as changed, and a verifier call is made.

## Fix

`keepPrevQuotes` in `src/pipeline/extract.ts` runs in `refreshGuide` right after `toEntries` and the scope filter, before the shrink check, `nextFile` and the verifier. For each pick the model returned, it puts back a previous quote when:

- the pick (candidates or vote) is the same as before,
- the quote's source page is still one of the guide's pages and the quote passes `verifyQuotes` on that page (word for word, a full sentence, not attributed speech, substantive),
- it passes the same contest checks as `toEntries` (`standsAlone` and `misplacedUnder`, now shared through `contestProblem`),
- and it is not in `rejectedQuotes`.

Restored quotes go back in their old positions relative to the quotes that stayed. If the pick would go over 3 quotes, the model's new quotes are dropped first. Picks the model no longer returns, picks on contests no longer on the ballot, and held picks are not touched, so nothing comes back for them. Because the merge happens before the verifier, a restored quote is audited with the rest and dropped if the verifier rejects it in this run. Each restore and each new quote cut for the limit is written to the run notes.

## Verification

- `npx vitest run tests/extract.test.ts tests/refresh.test.ts`: passes, including the new `keepPrevQuotes` cases (kept when omitted, original order, limit, not on page, source page gone, rejected, pick changed, now under another heading, pick no longer returned) and two refresh cases (kept with no verifier call; verifier still drops a kept quote).
- `npm test`: every file passes when run alone; under a machine load average of about 40, some unrelated files (append-run, local-refresh, pagestore, placement, fetchcheck) time out in the full run.
- `npx next typegen && npx tsc --noEmit` and `npm run lint`: clean (lint has 4 existing warnings in untouched test files).

## Guardrail

The `keepPrevQuotes` tests in `tests/extract.test.ts` and the two refresh tests in `tests/refresh.test.ts` fail if a re-extract stops carrying valid quotes forward or starts restoring ones it should not. The runbook's refresh steps now describe the rule, so a reviewer who sees "kept previous quote the model omitted" in the notes knows where it came from. If a kept quote is wrong, the fix is `rejectedQuotes`, which this path respects.
