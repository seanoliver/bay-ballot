# Daily refresh blocked by bot walls on GitHub's runners

- **Date**: 2026-10-07
- **Area**: `src/pipeline/fetch.ts`, `src/pipeline/refresh.ts` (daily refresh)

## Symptom

The first scheduled refresh (2026-10-06) failed six guides that load fine from a laptop:

- cadc, d11-dems, league-pissed-off-voters, milk-club and sf-green-party got `HTTP 403`.
- sf-chronicle came back with 0 picks (previous 23). The shrink guard kept the old file.
- The summary said the run cost $0.00, although the Chronicle page was sent to the model.

## Root cause

Runner traffic comes from Azure data-center addresses, and these sites screen it:

- **Cloudflare managed challenge** (`cf-mitigated: challenge`, title "Just a moment..."):
  - The four NationBuilder sites (cadc, d11-dems, league, milk-club) block headless Chromium as well as plain HTTP.
  - sfgreenparty.org challenges plain HTTP but lets headless Chromium through.
- **sfchronicle.com** answers `200` with a 3 KB "Client Challenge" page ("A required part of this site couldn't load"), over HTTP and in the browser. The fetcher treated it as the page, so it reached the page gate (relevant change), was extracted, came back with no picks, and was caught by the shrink guard.
- `costOf` only counted guides with status `changed`, so the shrunk extraction's cost was left out of the estimate.

## Repro

`npm run bb -- fetch-check cadc d11-dems league-pissed-off-voters milk-club sf-green-party sf-chronicle` on a GitHub-hosted runner. A temporary CI job on PR #39 ran exactly this.

## Fix

- `fetchSource` retries a 403, 429 or 503, or a recognized bot wall, in headless Chromium.
- `detectBlock` recognizes Cloudflare, Akamai, Incapsula, PerimeterX, DataDome, Distil and the Chronicle's client challenge. It matches the `<title>`, or the text of short pages only.
- A page still blocked after the browser retry is an error, never content: no extraction, no page-store update.
- Shrunk extractions now count toward the run's cost estimate.
- `npm run bb -- fetch-check <guide...>` prints what each fetch attempt got, writing nothing.

## Verification

Runner results with the fix:

- sf-green-party: fetched through the browser retry.
- The four NationBuilder sites: still 403, now reported as `HTTP 403 (browser: HTTP 403)`.
- sf-chronicle: fails as `blocked (client challenge)` instead of being extracted.

Locally all six fetch normally.

## Guardrail

- `tests/fetch.test.ts` has one sample page per bot wall, plus the fallback paths.
- `tests/refresh.test.ts` checks that a shrunk extraction counts toward the cost.
- `fetch-check` is the first thing to run when a guide starts failing in CI.
