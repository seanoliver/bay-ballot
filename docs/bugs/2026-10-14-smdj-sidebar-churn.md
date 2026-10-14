# SMDJ sidebar churn re-extracts smdj daily

- **Date**: 2026-10-14
- **Area**: `src/pipeline/fetch.ts`, `src/pipeline/pagestore.ts` (page gate), smdj

## Symptom

The daily refresh re-extracted smdj almost every day, although no editorial had changed. After #182 added 12 editorials, each re-extract sent about 537 KB of page text (18 pages) to the extract and verify models. Tracked in #184.

## Root cause

The fetcher converts the whole `<body>` to text. SMDJ pages carry sidebars that change daily:
- Weather lines ("59° Sunny" became "69° Sunny").
- "Most read" and "Most commented" lists with counts ("Nash has failed (7)" became "(8)").
- Teaser headlines for other articles ("California's Prop 43 would make special taxes harder to pass").

`relevantChange` treats a changed line that names a candidate or a measure as relevant, which is right for endorsement text. So the candidate names in the sidebars made each day's page "relevant".

## Repro

Diff two stored versions of any SMDJ page before this fix, for example `git diff 9eb4a8d 9c91742 -- data/2026-11/pages/smdj/*booker*`. The changed lines are weather, list counts and teasers, and `pageGate` returns `relevant` for them.

## Fix

- `contentSelector` (optional) on an endorsement file. `fetchSource` keeps only the matched elements (`selectContent` in `src/pipeline/fetch.ts`) over both http and the browser, and fails the fetch when nothing matches.
- `fetchOptions` in `src/pipeline/sources.ts` passes it from the file to every fetch: `extract`, `refresh`, `pages --seed` and `fetch-check`.
- smdj sets `contentSelector: "header.asset-header h1, #article-body"`. The comment count in the header is left out on purpose: it changes as readers comment.
- Re-seeded smdj's stored pages: 18 files, 9,335 lines of sidebar removed.

## Verification

- `npm run bb -- fetch-check smdj`: 18 of 18 sources fetched; each preview starts with the editorial headline and body.
- The stored roundup page still lists every contest and pick.
- `npm run bb -- quote-lint --guide smdj`: 0 of 36 quotes fail.
- `tests/fetch.test.ts` (selector over http and browser, the no-match error), `tests/sources.test.ts`, `tests/refresh.test.ts` (selector reaches the fetcher).

## Guardrail

- A selector that stops matching fails the fetch, which the refresh reports as a failed guide, so a redesign can't silently bring the sidebars back.
- The runbook documents `contentSelector` next to the other per-guide fetch settings.
