# Switching areas without a navigation

Investigated 2026-10-09 (Pacific), while building client-side area switching (plan: `docs/plans/2026-10-09-spa-area-switching.md`).

## Context

A chip click in the area picker was a soft RSC navigation: a fetch of the target page's payload, then a remount of `BallotView` that lost scroll, the open contest (`?c=`) and filter UI state such as the guide search. The goal was to switch areas with `history.pushState`, keep `BallotView` mounted, and keep every URL server-rendered on a direct load.

## Key findings

- **Next 16.3 patches `history.pushState` and `replaceState`** (`node_modules/next/dist/client/components/app-router.js`, the `useEffect` that defines `applyUrlFromHistoryPushReplace`). Each call copies the current entry's `__NA` and `__PRIVATE_NEXTJS_INTERNALS_TREE` into the new state and dispatches `ACTION_RESTORE` with the new URL inside `startTransition`.
- **`ACTION_RESTORE` keeps the current tree.** `restoreReducer` restores the tree saved in history state, which for our pushes is the tree of the page the visitor loaded. So the router's `canonicalUrl` and `usePathname` follow the URL, but the page segment, its props and `useParams` stay those of the original page. Nothing remounts and nothing is fetched.
- **Back and Forward behave the same way.** Next's `popstate` handler calls `dispatchTraverseAction` with the saved tree; every pushed entry carries the same tree, so a traversal between them is a no-op for the router. The e2e tests assert no document or `_rsc` request across chip clicks, Back and Forward.
- **Next does not touch head metadata on these updates.** `document.title` must be set by hand.
- **`usePathname` updates in a transition**, after the query has already changed through our `useSyncExternalStore`. Reading the area from it would draw the old area with the new `?c=` for a frame, so the path is read with its own `useSyncExternalStore` on `location.pathname`.
- **`Link`'s `onNavigate` is the right hook.** It runs only for a plain left click on a same-origin link, after Next has called `preventDefault` on the click; calling its `preventDefault` stops `dispatchNavigateAction`. A modified click (new tab) never reaches it, and the `href` stays real for crawlers and no-JS visitors.
- **Chrome restores scroll for same-document traversals itself (`scrollRestoration: "auto"`)**, but `scrollY` read in a `popstate` listener is still the position being left. The restore it does lands against the old list, because the new list draws in a deferred render; we re-apply our own saved position after that render commits.

## Payloads

Measured from `.next/server/app` after `npm run build`, gzip -9.

| | raw | gzip |
|---|---|---|
| `/2026-11` RSC payload (now carries the snapshot) | 764 KB | 135 KB |
| `/2026-11/snapshot.json` | 752 KB | 132 KB |
| `/2026-11/sonoma` RSC payload | 176 KB | 33 KB |
| `/2026-11/san-jose` RSC payload | 240 KB | 47 KB |
| `/2026-11/sf` RSC payload | 291 KB | 57 KB |

The Bay Area page's payload is the same size as before (136 KB in the plan), since the snapshot replaced its props. Area pages fetch the snapshot once, when idle or when the pointer or focus reaches the area chips.

## Timings

`next start` on a laptop, desktop viewport, Chromium, median of 7 runs. Times are from the click event to the DOM change (MutationObserver), and to the frame after it (rAF then a message). "First" is the first switch to an area on a fresh page; "again" reuses its cached view. The last row is a normal RSC navigation (the area page with its snapshot request blocked), served from localhost, so it has no network time in it.

| | chip | chip painted | heading | heading painted |
|---|---|---|---|---|
| 1x, Bay Area → Sonoma (first) | 9 ms | 37 ms | 60 ms | 69 ms |
| 1x, Sonoma → Bay Area | 4 ms | 17 ms | 38 ms | 65 ms |
| 1x, Bay Area → Sonoma (again) | 5 ms | 18 ms | 25 ms | 34 ms |
| 1x, Sonoma → Bay Area, RSC navigation | 41 ms | 59 ms | 81 ms | 118 ms |
| 4x CPU, Bay Area → Sonoma (first) | 45 ms | 113 ms | 253 ms | 284 ms |
| 4x CPU, Sonoma → Bay Area | 19 ms | 31 ms | 133 ms | 262 ms |
| 4x CPU, Bay Area → Sonoma (again) | 33 ms | 73 ms | 125 ms | 150 ms |
| 4x CPU, Sonoma → Bay Area, RSC navigation | 142 ms | 223 ms | 326 ms | 466 ms |

At 4x the chip's paint after a first switch waits on the first chunk of the deferred render (the new area's view and its rows and bars are built in one go). Precomputing views on intent would trim that if it matters.

## How it works

- `src/lib/area-view.ts` builds an `ElectionSnapshot` (contests, areas, guides with their areas and a `published` flag, published files) and derives any area's `BallotView` props from it with `areaView`. `ballotViewProps` on the server is a wrapper over the same function, so the server and browser views can't drift; `tests/area-view.test.ts` checks both against the old implementation and across a JSON round trip.
- The Bay Area page sends the snapshot as its props. Area pages send their own view plus `snapshotUrl`, a static route (`src/app/[election]/snapshot.json/route.ts`, `force-static`) versioned by a content hash.
- `AreaBallot` reads the area from `location.pathname`, keeps the chips and the title on the urgent value, and renders the list from `useDeferredValue`. While the two differ the list region has `aria-busy` and its sections dim after 150 ms.
- `AreaPicker`'s chips call `onSwitch(href)` from `onNavigate`. It builds the target with the carried filter params plus `?c=` when the target area has that contest, marks the home visit, and calls `pushPath`, which checks the history budget and dispatches the change event. A `false` return (no snapshot yet, or the budget is spent) lets the `Link` navigate normally.
- `useHomeRedirect` uses the same switch with `replace` for the returning-visitor redirect to `/sf`.
- `BallotView` resets the stepped selection, the exiting pane, motion and the step write when its `area` prop changes, and announces "Showing <place> ballot".

## Gotchas

- Derive the area from the URL, never from route props: after a switch, a Back from a contest page restores the original page's tree and props under the pushed URL.
- After a switch, `useParams` and Vercel Analytics' route still name the page first loaded.
- `areaFromPath(...) ?? initial.area` is wrong: the Bay Area is `null`. Check for `undefined`.
- Each switch costs two history calls (ours plus Next's `replaceState`). Past the budget, the chip falls back to a normal navigation.
- Header `Link` prefetches carry `next-router-prefetch`; a test watching for RSC requests has to ignore them.
- A deploy between an area page's load and its snapshot fetch pairs an old page with new data. The URL's hash keeps browsers from caching across deploys, but the server ignores it.

## References

- `node_modules/next/dist/client/components/app-router.js` (patched history, `popstate`)
- `node_modules/next/dist/client/components/router-reducer/reducers/restore-reducer.js`
- `node_modules/next/dist/client/app-dir/link.js` (`linkClicked`, `onNavigate`)
- `node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md` (native History API)
- `src/components/AreaBallot.tsx`, `src/lib/area-view.ts`, `e2e/area-switch.spec.ts`
