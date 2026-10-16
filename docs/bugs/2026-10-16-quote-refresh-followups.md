# Quote refresh notes and diff lines misreport kept or reordered quotes

- **Date**: 2026-10-16
- **Area**: refresh pipeline, `keepPrevQuotes` (`src/pipeline/extract.ts`) and `diffPicks` (`src/pipeline/diff.ts`)

## Symptom

Found in review of #205 (keep full quote pairs on refresh), issue #208. No refresh run has shown them yet.

1. The run notes said "previous quote not kept" for a published pair whose text was still on the site, inside a longer quote the model returned.
2. When the model returned an unranked multi-name pick in a new name order, the summary showed the `~` line but no `removed` lines for quotes the pick lost.
3. A removed quote with an emoji at character 60 showed a broken character in the summary.
4. A "kept previous full quote" note could name a quote the 3-quote limit then dropped.

## Root cause

1. `keepPrevQuotes` matched the published pair to the first model quote that `sameQuote` accepts. When that was the model's one-sentence fragment and the pair failed `problem()`, it called `notKept`, without checking that another model quote held the whole pair. `withoutContained` then dropped the fragment, so the data was right; only the note was wrong.
2. `diffPicks` decided "same pick" by comparing the displayed names in order, while `keepPrevQuotes` uses `samePick`, which ignores order for unranked picks. `toEntries` keeps the model's name order, so a reordered pick reaches `diffPicks`.
3. `clip` in `diff.ts` sliced UTF-16 units, splitting a surrogate pair.
4. The `lengthened` notes were written before the `MAX_QUOTES` trim. Only a previous entry with more than 3 quotes reaches it, which the schema rejects, so it needs contrived input.

## Repro

New tests in `tests/extract.test.ts` ("writes no not-kept note when a longer model quote holds a published pair that fails its checks", "writes no kept-full-quote note for a published quote the limit of 3 then drops") and `tests/diff.test.ts` ("names removed quotes when an unranked pick only changed name order", "cuts a removed quote by characters, never inside an emoji"). Each failed on the old code.

## Fix

- `keepPrevQuotes`: skip the swap and the note when any remaining quote holds the published quote's normalized text. Write the `lengthened` notes after the `MAX_QUOTES` trim, as the `restored` notes are.
- `diffPicks`: use `samePick` to decide whether to list `removed` lines. The `~` line still shows a name-order change. Clip by code points.
- Also from #208: `diffPicks` shows the quote as one line of inline code, so scraped `@handle`, links and images can't render in the PR body; a quote that differs only after normalization (dashes, quotes, spacing) shows as `reworded`; `capSummary` (`src/pipeline/refresh.ts`, called in `scripts/bb.ts`) cuts `summary.md` at a line under 60,000 characters, below GitHub's 65,536-character body limit.

## Verification

`npx vitest run tests/extract.test.ts tests/diff.test.ts` and `npx vitest run tests/refresh.test.ts`: all pass. The new tests fail with the old `extract.ts` and `diff.ts`.

## Guardrail

The tests above. `diffPicks` now calls the same `samePick` as `keepPrevQuotes`, so the two can't disagree on what counts as the same pick.
