# News-site sidebars stored as guide text

- **Date**: 2026-10-14
- **Area**: `src/pipeline/fetch.ts`, `src/pipeline/refresh.ts`, `src/pipeline/sources.ts`; press-democrat, mercury-news, pa-daily-post

## Symptom

Refresh added picks found only in sidebar or related-article headlines on Press Democrat, Mercury News and PA Daily Post pages (examples in #178). Stored text for those guides also carried "Related Articles" boxes, a paywall offer and reader comments.

## Root cause

These three guides had no `contentSelector`, so the fetcher kept everything in `<body>` except nav, footer and scripts. Headlines of other editorials in sidebars, related-article boxes and "More in" lists read as endorsements to the extract model. Mercury News also needed a different selector for its two index pages than for its articles, which one guide-wide `contentSelector` could not express.

## Repro

On the old code, `npm run bb -- pages --seed mercury-news` and read a stored article: "Related Articles" headline boxes sit between paragraphs of the editorial, a "More in Endorsements" list follows it, and some pages also carry the subscription offer.

## Fix

- `contentSelectors` maps a source URL to its own selector (`src/lib/schema.ts`, `src/pipeline/sources.ts`).
- Press Democrat and Mercury News: `h1.entry-title, .article-body` minus `aside.related, .sspw-wrapper`. Mercury News and East Bay Times indexes: `main article.archive-view`. PA Daily Post: `article.type-post`.
- A selector miss throws `SelectorMissError`. An http miss retries once in the browser; after a guide's first miss later pages skip the retry, and after a real rescue the rest go to the browser.
- In refresh a missed page keeps its stored text or is left out. A guide that would re-extract while a page misses, or whose every page missed, is `blocked`: nothing is extracted or stored, and the run exits 2. A guide already in shrunk-skip stays `shrunk-skipped`; a test for this is deferred to #190. Misses on unchanged guides are listed in the summary and counted in the run digest; on a cloud run that commits nothing they appear only in the log and digest (#190).
- 52 stored pages re-seeded (about 3,500 lines removed). Five new Mercury News picks added with a changelog entry.

## Verification

- `fetch-check` 52 of 52; `quote-lint` 0 failures; `npm run validate`.
- Targeted vitest files (refresh, fetch, report, schema, sources, write, fetchcheck) pass; CI green on #192.
- Mutation-checked tests; six review rounds, the last with no P0 or P1 findings.

## Guardrail

- Schema rejects a `contentSelectors` key that is not one of the guide's sources.
- Tests pin keep-or-leave-out on a miss, `blocked` with exit 2, the retry cut-off and rescue switch against the real fetcher, and `strictSelectors` for `bb extract`.
- A layout change that misses every page of a guide blocks it and holds the refresh PR. On an otherwise unchanged guide, a partial miss keeps the stored text (or leaves out a never-stored page) and is only listed. A layout change to Mercury News articles alone misses 24 of 26 pages, so that guide is not blocked; this and other hardening are on #190.
