# Refresh cuts a published two-sentence quote to one sentence

- **Date**: 2026-10-15
- **Area**: refresh pipeline, `keepPrevQuotes` (`src/pipeline/extract.ts`) and `diffPicks` (`src/pipeline/diff.ts`)

## Symptom

The 2026-10-15 refresh (#195) removed the SF Chronicle's only Prop 5 quote and shortened Indivisible Sonoma's Prop 43 quote. Both were published two-sentence quotes. Neither showed in the run summary: Prop 43 stayed at one quote, so its `q` line did not appear. Both were restored by hand. Issue #202.

## Root cause

`sameQuote` treats two quotes as the same when one contains the other (40+ normalized characters). When the model returned only the second sentence of a published pair, `keepPrevQuotes` found it "the same" as the pair, kept the model's fragment, and did not restore the pair. The verifier then often dropped the fragment as not-standalone, because the second sentence depends on the first.

`diffPicks` only compared quote counts, so a quote replaced by a shorter one (same count) produced no diff line.

## Repro

`keepPrevQuotes({ "prop-g": entry("N", `${q1} ${q2}`) }, { "prop-g": entry("N", q2) }, …)` on the old code returned `[q2]`.

## Fix

- `keepPrevQuotes`: when the model's quote matches a published one but is shorter, swap in the published quote if it still passes `problem()` (on the page, under this contest, not rejected, verifier rules). Otherwise keep the model's quote and note why the published one was not kept. Note: `kept previous full quote over the model's shorter one`.
- `keepPrevQuotes` then runs `withoutContained` on every unchanged pick: it drops any quote whose normalized text sits inside another quote of that pick, and later exact repeats. Without it, a pair the model split into two quotes came back as the pair plus one of its own sentences. The two "kept …" notes are written only for published quotes that remain; "previous quote not kept" is written when a published quote fails its checks and no remaining quote holds its text (that last condition came with `2026-10-16-quote-refresh-followups.md`).
- `diffPicks`: when the pick is unchanged, add `q <contest>: removed "<text>"` (cut to 60 characters) for each published quote whose exact text is gone, so shortened and removed quotes appear in the run summary and PR body.

## Verification

`npx vitest run tests/extract.test.ts tests/diff.test.ts`: 11 new `keepPrevQuotes` tests (pair kept; fragment kept when the pair is off the page; split pair kept once, short sentence first or last; repeats; a longer model quote holding the pair; normalized comparison; slot order; notes only for kept quotes) and 2 new `diffPicks` tests (removed lines with the 60-character cut, and its boundary). The first two extract tests failed before the fix. The review rounds on #205 mutated each changed line; every mutation fails a test.

## Guardrail

The `keepPrevQuotes` and `diffPicks` tests above, and the `removed` diff line, which makes any future loss of a published quote visible in review.
