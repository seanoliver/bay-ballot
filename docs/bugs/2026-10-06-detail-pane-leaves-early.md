# Detail pane scrolls away before it meets the footer

- **Date**: 2026-10-06
- **Area**: ballot page, desktop detail pane (`src/components/BallotView.tsx`)

## Symptom

With a contest open on desktop, a pane shorter than the viewport, and a list longer than the pane, scrolling down toward the footer moved the pane up and off the screen while there was still empty space between its bottom edge and the footer.

## Root cause

The sticky element is the pane's wrapper, a grid item in the ballot grid. Grid items stretch to their row by default (`align-self: stretch`), and the row is as tall as the whole contest list, so the wrapper was capped by `max-h-dvh` at the full viewport height. On a 1440x900 window, Governor's card was 556px tall inside a 900px sticky wrapper.

The sticky wrapper is pushed up once its own bottom reaches the end of the grid. Its bottom was the viewport's bottom, not the card's, so the card started moving while it still had room. The containing block was correct; the sticky box was just too tall.

## Repro

1. Open `/2026-11?c=governor` at 1440x900.
2. Scroll to the bottom of the page.
3. The card's top goes above the viewport (-49px) while its bottom is still well above the footer.

## Fix

Add `lg:self-start` to the sticky panes (the detail pane and the filter sidebar share the class list). The wrapper's height is now the card's height, still capped at the viewport, and a long card keeps scrolling inside it.

## Verification

- New desktop e2e tests run a short pane (Governor) and a long pane (Prop B with every "All reasons" open). Each scrolls to the page bottom in steps and checks two things:
  - While the visible card has room above the footer, it stays at its stuck position.
  - At the bottom it is either still stuck or sits a gutter (under 120px) above the footer.
- Without the fix, the short-pane test fails: expected top 24, received -49. With the fix, both pass.
- The rest of vitest, tsc, build, and e2e also pass.

## Guardrail

The e2e tests above. A sticky grid item needs `self-start` (or `align-self: start`); the comment on the `PANE` class list says why.
