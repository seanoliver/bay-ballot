# Home page redirect split Google's canonical

- **Date**: 2026-10-19
- **Area**: routing and SEO (`src/app/page.tsx`, `src/lib/site-data.ts`, `src/lib/seo.ts`)

## Symptom

Search Console flagged bayballot.com on 2026-10-11 with "Duplicate, Google chose different canonical than user" and "Page with redirect".

## Root cause

`/` called `redirect()` to `/2026-11`, which Next serves as a 307 (temporary). Google treats the source of a temporary redirect as the URL to keep, so it picked `/` as canonical. Every signal on our side named `/2026-11`: its `<link rel="canonical">`, the sitemap, and internal links. The two disagreed.

`curl -sI https://bayballot.com/` showed `HTTP/2 307` with `location: /2026-11`. The two URLs never served separate copies of the page.

## Repro

```bash
curl -sI https://bayballot.com/ | grep -iE '^(HTTP|location)'
curl -sL https://bayballot.com/2026-11 | grep -o '<link rel="canonical"[^>]*>'
```

## Fix

- `/` renders the latest election's Bay Area page (`src/app/page.tsx`), with canonical `/` and the WebSite JSON-LD.
- `electionIndex(id)` in `src/lib/site-data.ts` returns `/` for the latest election and `/<id>` for older ones. Canonicals, the sitemap, the area chips, back links, the footer and the About page use it.
- The snapshot carries `index`, so in-browser area switching treats `/` as the Bay Area page.
- `/2026-11` still serves 200, with its canonical set to `/`. There is no permanent redirect, which browsers would cache past the next election.

## Verification

`npx vitest run`, `npx playwright test`, then `curl -sI` on `/`, `/2026-11` and `/sitemap.xml` after deploy.

## Guardrail

`e2e/search-appearance.spec.ts` checks that `/` returns 200 without a redirect and that `/` and `/2026-11` both declare canonical `https://bayballot.com` (Next drops the trailing slash on the root). `tests/seo.test.ts` checks that the sitemap lists `/` and not `/2026-11`.
