# News-site sidebars stored as guide text

- **Date**: 2026-10-14
- **Area**: `src/pipeline/fetch.ts`, `src/pipeline/refresh.ts`, `src/pipeline/sources.ts`; press-democrat, mercury-news, pa-daily-post

## Symptom

Refresh picked up endorsements from sidebar headlines on Press Democrat and Mercury News pages, and stored text for those guides plus PA Daily Post carried "Related Articles" boxes, paywall offers and reader comments. Tracked in #178.

## Root cause

These three guides had no `contentSelector`, so the fetcher stored the whole `<body>`. Headlines of other editorials in the related box read as endorsements to the extract model. Mercury News also needed a different selector for its two index pages than for its articles, which one guide-wide `contentSelector` could not express.

## Repro

On the old code, `npm run bb -- pages --seed mercury-news` and read any stored article: the "Related Articles" headlines and the subscription offer follow the editorial text.

## Fix

- `contentSelectors` maps a source URL to its own selector (`src/lib/schema.ts`, `src/pipeline/sources.ts`).
- Selectors for the three guides: `h1.entry-title, .article-body` minus `aside.related, .sspw-wrapper`; Mercury News and East Bay Times indexes use `main article.archive-view`; PA Daily Post uses `article.type-post`.
- A selector miss throws `SelectorMissError`. An http miss retries once in the browser; after a guide's first miss later pages skip the retry, and after a real rescue the rest go to the browser.
- In refresh a missed page keeps its stored text or is left out. A guide that would re-extract while a page misses, or whose every page missed, is `blocked`: nothing is extracted or stored, and the run exits 2. Misses on unchanged guides are listed in the summary and counted in the run digest.
- 52 stored pages re-seeded (about 3,500 lines removed). Five new Mercury News picks added with a changelog entry.

## Verification

- `fetch-check` 52 of 52; `quote-lint` 0 failures; `npm run validate`.
- Targeted vitest files (refresh, fetch, report, schema, sources, write, fetchcheck) pass; CI green on #192.
- Mutation checks on each new guard; six review rounds, the last clean at P0 to P1.

## Guardrail

- Schema rejects a `contentSelectors` key that is not one of the guide's sources.
- Tests pin keep-or-leave-out on a miss, `blocked` with exit 2, the retry cut-off and rescue switch against the real fetcher, and `strictSelectors` for `bb extract`.
- A layout change now holds the refresh PR instead of storing a page of chrome. Remaining hardening is on #190.
