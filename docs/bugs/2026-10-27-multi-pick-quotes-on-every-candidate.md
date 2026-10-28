# Quotes in multi-name picks showed under every picked candidate

- **Date**: 2026-10-27
- **Area**: `src/lib/detail.ts` (`detailSides`), `src/lib/schema.ts` (`Quote`), refresh pipeline

## Symptom

Issue #306: on the SF Board of Education page, Ryan Hazelton's card showed Bay Area Reporter's "Fisher's correct that achieving a balanced budget…" and Pissed Off Voters' "Virginia Cheung is a SFUSD parent…". Each quote was about another candidate the same guide also picked.

## Root cause

A quote was stored per guide per contest, with nothing saying which candidate it was about. `detailSides` puts a guide's row under each name in its pick, then attached all of that row's quotes to every one of those candidates. `pickReasons` flagged a quote naming a rival but not the candidate (`attack`), but only ranked it lower. Hazelton had two quotes and both were flagged, so both still filled the two visible slots.

Across the data, 56 quotes named only some of their guide's picks, which made 82 wrong placements, plus 5 more that used a first name only ("Leah has the policy chops").

## Repro

On the old code, `detailSides(board, [row("A", ["W", "X"], [q("W is right.")])])` returns the quote under both W and X.

## Fix

- `Quote` gains an optional `about: string[]`, the picked names the quote is about. Omitted means the whole pick.
- `src/lib/quote-about.ts`: `quoteAbout` derives it from the names in the quote: full name in any case, surname as written or in capitals (same rule as the page gate, see 2026-10-07-surnames-matched-common-words), first name as written, and contest aliases. `tagQuotes` fills it on entries and keeps a published quote's `about` while those names stay picked, so hand corrections survive re-extracts.
- `refresh.ts` tags picks before comparing them with the published file (otherwise every refresh would look changed and re-run the verifier) and again after verify, for released holds. `bb verify` tags too.
- `detailSides` shows a quote under a candidate only when `quoteIsFor(q, name)`; the guide chip's quote mark follows.
- 18 endorsement files backfilled.

## Verification

- `npx vitest run`: 1647 passed, including new `tests/quote-about.test.ts`, a `detailSides` case and a validation case.
- `npm run validate`: data OK.
- Local dev server, `/2026-11/board-of-education`: the Fisher quote shows only under Alida Fisher; Hazelton's card has no reasons and Bay Area Reporter's chip there has no quote mark.

## Guardrail

`validateElection` fails when a quote names only some of a multi-name pick but has no `about`, when `about` names someone not picked, and when a measure quote has `about`. A hand edit or pipeline path that skips tagging fails CI instead of showing the quote under the wrong candidate.
