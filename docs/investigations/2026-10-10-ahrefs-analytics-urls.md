# How the Ahrefs analytics script handles URLs

Investigated 2026-10-10 (Pacific), while hardening the Ahrefs Web Analytics setup from #136 (issue #137).

## Context

Bay Ballot loads Ahrefs Web Analytics in production. Some URLs carry an address or ZIP (`addr`, `zip`, `q`), and those must never reach analytics. To scrub them we need to know every place the script reads a URL from and every event it sends on its own.

## Key findings

Read from the script itself: `https://analytics.ahrefs.com/analytics.js`, downloaded 2026-10-10 (6,947 bytes; checked in with a source header as `e2e/fixtures/ahrefs-analytics.js`).

- **Attributes it reads**, all from its own `<script>` tag (`document.currentScript`):
  - `data-key`: the site key, sent as `k`. An event with neither `data-key` nor `data-domain` is dropped.
  - `data-domain`: sent as `d`.
  - `data-no-pageview-auto`: present means no automatic page views at all.
  - `data-no-pageview-on-load`: present means no page view on load, but history changes still send one.
  - `data-page-location`: the URL to report. Read again on every event, not once. Empty or missing means `window.location`. A value starting with `/` is resolved against the current origin.
  - `data-api`: the event endpoint. Defaults to `<script origin>/api/event`. Errors go to `data-error`, default `<script origin>/api/error`.
  - `data-prop-*`: each becomes a custom property on every event (`p`).
  - `data-track-visibility`: present means it also sends `x-visibilitychange-hidden`, `x-visibilitychange-visible` and `x-pagehide`, but only while no page view has gone out from the automatic tracker.
  - `data-instance`: the global name it installs (default `AhrefsAnalytics`). If that global already exists it warns and stops.
- **What every event carries:** `n` (name), `u` (the `data-page-location` URL or `location.href`, full, with query and fragment), `r` (`document.referrer`, raw, or null), plus language, screen size, pixel ratio and `document.title`. Page views go by `XMLHttpRequest`; link clicks, form submits and visibility events go by `navigator.sendBeacon`. Bodies are JSON sent as `text/plain`.
- **Link clicks:** it attaches a click and auxclick listener to every `<a>` on the page, and to every `<a>` added later through a `MutationObserver`. Each click sends `x-link-click` with the anchor's resolved `href` in the props. It skips `data:`, `blob:` and `javascript:` links and clicks that were already `defaultPrevented`. There is no attribute to turn this off.
- **Form submits:** every `<form>` gets a submit listener that sends `x-form-submit` with the form's resolved `action`. No opt-out attribute either.
- **History:** only when automatic page views are on, it wraps `history.pushState` and listens to `popstate`, sending a page view whenever the reported URL changes. It never wraps `replaceState`. With `data-no-pageview-auto` it touches neither.
- **Skipped traffic:** it ignores events when the reported URL's hostname is `localhost`, `127.x`, `[::1]`, or the protocol is `file:`. It also ignores them when `navigator.webdriver`, `window._phantom`, `window.__nightmare` or `window.Cypress` is set, unless `window.__web_analytics` is truthy.
- **Storage:** the script has no `cookie`, `localStorage` or `sessionStorage` code. It sets nothing on the device.

## How it works in Bay Ballot

`src/components/SiteAnalytics.tsx` loads the script with `data-no-pageview-auto` and sends each page view by hand with `sendEvent("pageview")`, after setting `data-page-location` to the URL with `addr`, `zip` and `q` removed (`scrubUrl` in `src/lib/analytics.ts`). It also removes those params from the address bar, for the link-click reason below. That runs:

- after mount and on each pathname change, in a `setTimeout` so Next's app router has already wrapped `history.replaceState`;
- on `bb-filters-change` (the app's own same-path history writes) and on `popstate`.

It calls `history.replaceState(null, "", url)`. In Next 16.3.8 (`next/dist/client/components/app-router.js`) the wrapper copies `__NA` and the router tree from the current `history.state` into the new entry, then dispatches a restore action with the new URL, so `useSearchParams`, `router.refresh()` and server actions see the scrubbed URL too. Passing `history.state` instead makes the wrapper skip that sync, because the state already has `__NA`. Calling it before the wrapper exists writes a null state, and Back to that entry then does nothing.

`next.config.ts` sends `Referrer-Policy: strict-origin` on every route, and the layout metadata sets the same policy as a meta tag.

## Gotchas

- **Fragment links inherit the query.** A link with `href="#section"` resolves against the current URL, so its `href` is the full page URL plus the fragment. The section menu uses such links, so a click would report `?zip=...` if the address bar still had it. Scrubbing `data-page-location` alone does not help here; only scrubbing the address bar does.
- **Forms report `action`.** A `<form>` without an `action` attribute resolves `action` to the current page URL, query included. Bay Ballot has no forms today. A future one needs an explicit `action`, or the address bar must already be clean.
- **Referrer.** `r` is the raw `document.referrer`. The browser default, `strict-origin-when-cross-origin`, sends the full URL for same-origin requests, so a full page load from `/2026-11?zip=94110` to another Bay Ballot page would report that URL as `r`. `strict-origin` sends only the origin, also for same-origin requests. Client-side navigations do not change `document.referrer` at all, so they report the referrer of the first load.
- **Testing.** Playwright sets `navigator.webdriver`, so a test must set `window.__web_analytics = true`, and it must load the page under a non-localhost host. `e2e/analytics.spec.ts` maps `bb.test` to the local server with Chromium's `--host-resolver-rules`.
- **Double listeners.** The guard flags have a typo (it checks `ahrefsAnalytics_click_tracked` but sets `ahrefsWebAnalytics_click_tracked`), so a link removed and added back gets a second listener and its clicks are counted twice. This only skews counts.

## References

- `src/components/SiteAnalytics.tsx`, `src/lib/analytics.ts`, `next.config.ts`
- `e2e/analytics.spec.ts`, `e2e/fixtures/ahrefs-analytics.js`
- `node_modules/next/dist/client/components/app-router.js` (history wrapper)
- Issue #137, PR #136
