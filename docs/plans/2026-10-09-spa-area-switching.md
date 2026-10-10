# Client-side area switching

Switching between the Bay Area, county, and city ballots happens in the browser with `history.pushState`, so `BallotView` stays mounted and nothing is fetched.

## Background

- Area pages are separate static routes (`src/app/[election]/page.tsx`, and area slugs in `src/app/[election]/[contest]/page.tsx`). `ListPage` calls `ballotViewProps(d, { area })` on the server.
- A chip click is a soft RSC navigation: about 400 ms with no feedback, then `BallotView` remounts and loses scroll, the open contest (`?c=`), and filter UI state.
- Next patches `pushState`/`replaceState` to dispatch `ACTION_RESTORE` with the current tree (`node_modules/next/dist/client/components/app-router.js:252-279`). `usePathname` updates and the page stays mounted. Back/forward restores the tree saved in that entry, which is the same tree for every pushed entry, so nothing remounts.
- Consequences: derive the area from the URL, never from props. Next does not update head metadata, so set `document.title` by hand.
- React Compiler is off. Memoize by hand.

## Payload

| | gzip |
|---|---|
| Bay Area RSC payload today | 136 KB |
| County and city RSC payloads today | 33 to 60 KB |
| Slim client snapshot (contests, files, guides with areas, areas, pending ids) | 133 KB |

The Bay Area page sends the snapshot in place of its props, at the same size. Area pages keep their server-computed props and fetch the snapshot as static JSON when idle, or on intent over the Area nav. A chip click before it arrives does a normal navigation.

## Steps

1. **`src/lib/area-view.ts`**, client-safe, `import type` only from schema and data (no zod, no fs, no `node:path`).
   - `ElectionSnapshot = { election, date, contests, areas, guides: (GuideInfo & { areas; published })[], files /* published only */ }`.
   - `snapshotOf(d, election)`, `areaView(snapshot, areaId)` (the body of `ballotViewProps` plus `ListPage`'s `links` and `intro`), `areaFromPath(snapshot, pathname)` (undefined when the path is not a list page), and `viewFor`, a per-snapshot memo of `areaView`.
   - Build `allGuides` once per snapshot so its identity is stable; `useBallotFilters` memoizes on it.
2. **`src/lib/site-data.ts`**: `ballotViewProps` becomes a thin wrapper over `areaView` with the same return shape (`tests/site-data.test.ts` uses `toEqual`). Cache `snapshotOf` per election.
3. **`src/app/[election]/snapshot.json/route.ts`**: `dynamic = "force-static"`, `dynamicParams = false`, `generateStaticParams` from `elections()`. Version the URL with `?v=<dataAsOf>`.
4. **`src/app/[election]/list-page.tsx`**: render a client `AreaBallot`. The Bay Area passes `snapshot`; area pages pass `initial = areaView(snapshot, area.id)` and `snapshotUrl`. Metadata and static params are unchanged.
5. **`src/components/AreaBallot.tsx`**:
   - `useLocationPath(serverPath)` in `useBallotFilters.ts`, a `useSyncExternalStore` on `location.pathname` sharing the existing `subscribe`. `usePathname` updates inside a transition and would render the old area with the new `?c=` for a frame.
   - `areaId = areaFromPath(snap, path) ?? initial.area`; `deferredArea = useDeferredValue(areaId)`. The view comes from `initial` or `viewFor(snap, deferredArea)`.
   - `AreaPicker` gets links for `areaId`, so the chip and ✕ update in the click's frame. Set `aria-busy` and dim the list slightly while the deferred area lags.
   - Load the snapshot through a module-level promise cache on `requestIdleCallback` (skip when `navigator.connection.saveData`), and on `pointerenter`, `focusin`, or `touchstart` over the Area nav.
   - Set `document.title` from `areaTitle` in an effect on `areaId`. Announce "Showing <place> ballot" in the existing live region.
6. **`pushPath(href, { replace })` in `useBallotFilters.ts`**: check `HISTORY_BUDGET.tryNote(2)`, remember scroll for the current URL, drop `pending`, push or replace, dispatch `CHANGE_EVENT`. The target carries `off`, `offtypes`, and `why`, plus `c` only when that contest is in the target area. Call `markHomeVisit` first.
7. **`AreaPicker`**: keep `Link` and its href. Add `onSwitch?: (href) => boolean` and use Link's `onNavigate` to `preventDefault` when it returns true.
8. **`BallotView`**: `area` now changes while mounted. On change (previous-value-in-state pattern, as at `BallotView.tsx:171-175`), reset `stepped`, `exiting`, `stepWrite`, `jumpedTo`, `animate`, and the mobile sheet. Cache `slotsById` per view and `rowsById` per view plus filters in module `WeakMap`s. Scroll the detail pane to the top when `area` changes.
9. **`useHomeRedirect`**: redirect with `pushPath(..., { replace: true })` and fall back to `router.replace`.
10. **Scroll**: a chip click leaves scroll alone. Back/forward restores the saved position from an in-memory map in a `useLayoutEffect` after the deferred area commits. Leave `history.scrollRestoration` alone.
11. **Open contest**: keep it open with `?c=` when the contest is in the target area, otherwise drop `?c=` and close the pane without the exit animation.

## Risks

- Back/forward should reuse cached nodes; an e2e test asserts no RSC request.
- After a switch the router tree and `useParams` disagree with the URL. Vercel Analytics' `route` field will show the original segment.
- History budget: each switch costs two calls; past the budget a switch falls back to normal navigation.
- Server and client views must match; both come from `areaView`, and a test compares them.

## Tests

- Unit: `areaView(snapshotOf(d), id)` equals the old `ballotViewProps` for every fixture area and null. `areaFromPath` cases. `viewFor` identity. `pushPath` budget refusal, dropped `pending`, and `CHANGE_EVENT`.
- e2e: chip switches make no RSC or document request and keep a window marker; title updates; back/forward updates heading, title, `aria-current`, and scroll; the ✕ animation runs on a client switch; every area switched to client-side matches a direct load; reload after a switch renders the right server page; `?c=` kept or dropped per area; `why=1` and filter search survive; per-area section-state keys apply after a switch.
