# Results row pushes the page down after hydration, so a tap on Filters misses

- **Date**: 2026-11-04
- **Area**: `useElectionDay` (`src/components/ElectionChip.tsx`), `ElectionOver`

## Symptom

On PR #330 (results links once the election is over), CI failed ten phone e2e tests on Nov 4. Each one tapped Filters and then timed out waiting for a checkbox in the Filters sheet: the reasons filter reload test, the phone sheet filter test, and the contest-filters and ZIP filter tests. Retries failed the same way. They passed locally. A real visitor saw the same thing: the ballot jumps down about 76px a moment after it loads.

## Root cause

`useElectionDay` returned `null` until hydration, so the static HTML never held post-election content. After hydration, `ElectionOver` mounted the "The election is over. Results:" row above the area chips. The CI trace showed the tap at (195, 441), where Filters was in the first frame. The next frame had the results row, and Filters had moved to y=517. The tap hit empty space, so the sheet never opened. On the slower CI runner, hydration finished between Playwright's stability check and the tap. Locally, it finished before the check.

The `[WebServer] Error: Internal: NoFallbackError` in the log is unrelated. It comes from the "an unknown contest is a 404" test and also shows up on main's green runs.

## Repro

On the old code, build after Nov 3, 2026 (Pacific), throttle the CPU and run `npx playwright test e2e/ballot.spec.ts --project=phone -g "reasons filter"`. Or open `/2026-11` on a phone and watch the list move down once on load.

## Fix

`next.config.ts` inlines `BUILD_DAY` (the build's Pacific date) through `env`. Until hydration, `useElectionDay` now returns the build-day state when the build ran after election day, and `null` otherwise. A production build made after the election therefore prerenders the results row, the footer's county list and the results chip, and hydration matches it. After hydration the visitor's clock still decides, so a build made before the election still switches over.

## Verification

- `npx tsc --noEmit`: pass.
- `npx playwright test e2e/ballot.spec.ts e2e/contest-filters.spec.ts e2e/zip.spec.ts e2e/header-footer.spec.ts --project=phone --project=desktop`: all pass, including the ten that failed in CI.
- `.next/server/app/2026-11.html` contains "The election is over".

## Guardrail

`header-footer.spec.ts` › without JavaScript › "built after election day, the page already holds the results links" checks that the results row, chip and footer list are in the HTML. If the prerender goes back to `null`, that test fails.
