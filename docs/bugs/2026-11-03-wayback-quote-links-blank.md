# Quote source links open Wayback copies that blank out

- **Date**: 2026-11-03
- **Area**: `src/lib/display.ts` (`sourceLink`), `src/pipeline/linkcheck.ts`

## Symptom

Tapping a quote's source link opened the Wayback Machine copy of the guide's page. The copy appeared for a moment and then went blank or crashed, on Sean's phone.

## Root cause

`sourceLink` returned the Wayback snapshot whenever one existed, and 173 sources had one. A Wayback copy re-runs the guide site's own scripts from web.archive.org. Most of them throw there (`$ is not defined`, `Sailthru is not defined`, null `querySelector`). In 15 snapshots loaded in headless Chrome, 10 threw page errors. Desktop Chrome kept the text, so the blank screen on a phone is inferred from those errors, not reproduced.

## Repro

Open any guide page, tap a quote's link: it goes to `https://web.archive.org/web/<ts>/<source>`. Load a sample of snapshots with Playwright and collect `pageerror` events.

## Fix

- `sourceLink` links the live page, with a `#:~:text=` fragment for the quote (first and last four words), so the browser scrolls to it. PDFs get no fragment.
- `ArchivedSource` has an optional `gone` date. Only a gone source links its snapshot.
- `npm run bb -- check-links` sets or clears `gone`. It marks a source gone on 404, 410 or a dead domain, confirmed by a second probe a minute later. Blocks (403, 429), 5xx errors and timeouts leave it unchanged.
- The daily refresh runs it with `--report`, which changes no data and keeps a "Source pages to check" issue listing missing pages. A person looks for where the guide moved the page before marking it gone.
- Re-archiving a gone source keeps its old snapshot.

## Verification

- `tests/linkcheck.test.ts`, `tests/display.test.ts`, `tests/detail.test.ts`.
- `npm run bb -- check-links` on 2026-11-03 marked sfyimby.org gone (404, confirmed with curl). contracostadems.com/endorsements/ redirects to its home page, which now holds the endorsements, so it stays live.

## Guardrail

Every quote link goes through `sourceLink`, and its tests assert that a live source never links Wayback.
