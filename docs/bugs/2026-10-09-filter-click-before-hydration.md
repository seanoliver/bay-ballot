# Arrow key after clicking filter text moved the selection on CI

- **Date**: 2026-10-09
- **Area**: `e2e/ballot.spec.ts` ("after clicking filter text, arrows do nothing"), `src/components/useBallotKeys.ts`

## Symptom

On CI's desktop project, the test expected `?c=us-rep-11` after ArrowDown and got `?c=us-rep-12`. It failed on 4 runs on 2026-10-09 and passed on rerun each time (#76).

## Root cause

`useBallotKeys` records the last clicked element with a `pointerdown` listener that it adds in a `useEffect`, after hydration. The test clicked the Filters heading as soon as the server-rendered heading was visible. On a slow runner the click landed before hydration, so it wasn't recorded. By the time ArrowDown was pressed the `keydown` listener existed, saw no recorded click, treated the key as a page key, and moved the selection.

## Repro

Delay every `/_next/static/chunks/**` request by 1.5 s with `page.route`, click the Filters heading while `[aria-keyshortcuts]` is still absent, wait for it to appear, then press ArrowDown. On the old steps this failed 9 of 10 runs with `?c=us-rep-12`.

## Fix

`e2e/ballot.spec.ts`: wait for the Contests region's `aria-keyshortcuts` attribute before clicking. That attribute is set in the render after hydration, by which point the keyboard listeners are in place. `areas.spec.ts` already waits the same way.

The app is unchanged. A visitor would need to click filter text in the first moment of a page load and then press an arrow key, and the result is only a different contest selected.

## Verification

- The forced-order repro with the fixed steps: 20 of 20 passed.
- The fixed test repeated 60 times with 12 workers: 60 passed.
- All `desktop keyboard` tests: 31 passed.

## Guardrail

A desktop keyboard test that clicks before pressing keys must first wait for `aria-keyshortcuts` on the Contests region. A click before hydration is invisible to the keyboard hook.
