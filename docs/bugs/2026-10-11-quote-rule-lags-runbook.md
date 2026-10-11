# Re-extracts reintroduce quotes reviewers reject

- **Date**: 2026-10-11
- **Area**: data pipeline (`src/pipeline/extract.ts`, `src/pipeline/verify.ts`, `src/pipeline/quotes.ts`, `src/pipeline/placement.ts`)

## Symptom

Reviews of the refresh PRs (#130, #131, #135, #139) kept moving the same kinds of quote into `rejectedQuotes`: openers like "But", "And", "Moreover" or "Instead", a "This ..." that points back, thin verdicts with no reason. Issue #132 lists about 17 still published. Each re-extract could bring new ones back, because the model was never told the rule reviewers applied. Separately, Mercury News's two Barrera quotes were dropped as `wrong-contest, under lgsuhsd-measure-n` on every re-extract.

## Root cause

The quote rule grew in `docs/runbook.md` through review decisions, but the pipeline kept its older, narrower version:

- The extraction prompt said only "don't start with This/That/It/... referring to an earlier sentence". It named no connectors, no reason requirement beyond announcements, and no two-sentence option. The verifier prompt matched it.
- `standsAlone` checked only an opening pronoun or demonstrative, and let any quote through if it named a candidate. It knew no connectors and rejected "It ..." under a measure, which the rule allows.
- `misplacedUnder` treated every short line naming a contest as a section heading. The Barrera editorial's "Related Articles" block contains "Election 2026: Measure N seeks to upgrade aging infrastructure for West Valley schools", so the quotes below it were placed under Measure N.

## Repro

On the old code, `npm run bb -- quote-lint` (added here) run against `main`'s data does not flag the 27 published quotes that open with a connector, and it flags the two Barrera quotes as `wrong-contest, under lgsuhsd-measure-n`. `tests/placement.test.ts` "ignores contest headlines in a Related Articles block" fails on the old `placement.ts`.

## Fix

- Both prompts state the 2026-10-11 rule (reason, two-sentence context, pronouns, pointing back, connectors, subject). They are worded independently, since the verifier must not share text with the extractor.
- `standaloneProblem` in `src/pipeline/quotes.ts` returns why a quote fails: more than two sentences, a connector opener, a parenthetical ", however," in the first sentence, an opening demonstrative other than the allowed "this measure/office/race" (and "this funding" under a measure), "it" outside a measure, or a he/she quote under a multi-name pick that names none of its candidates. A two-sentence quote is judged by its first sentence. Reason and subject stay with the verifier.
- `misplacedUnder` skips up to 12 short lines after a sidebar label ("Related Articles", "More in ...", "Most Popular" and similar, but not a bare "Recommended", which some guides use as a per-candidate badge), skipping only headline-length lines and stopping at a paragraph or a line ending in ":", so a list that resumes after an inline ad keeps its candidate names. `keepPrevQuotes` notes each previous quote it declines to restore and why.
- `npm run bb -- quote-lint [--guide <id>]` runs the same checks over every published quote against the stored page text.

## Verification

`npm run bb -- quote-lint` over 960 published quotes: 17 failures with the old checks, 34 with the new. 27 newly flagged quotes (2.8%), all connector openers the runbook rejects. 8 "It ..." quotes under measures are no longer flagged, and the 2 Barrera quotes now pass. Tests in `tests/quotes.test.ts`, `tests/extract.test.ts`, `tests/verify.test.ts`, `tests/placement.test.ts` and `tests/quotelint.test.ts`.

## Guardrail

The prompts carry a one-line comment that they must change together with the runbook's quote rule. Tests check that both prompts state the rule's connector list, two-sentence allowance and pronoun rule. `bb quote-lint` makes drift between the rule and the published data visible before a review.
