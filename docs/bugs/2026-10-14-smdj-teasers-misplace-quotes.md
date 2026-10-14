# SMDJ teaser headlines misplace quotes

- **Date**: 2026-10-14
- **Area**: `src/pipeline/placement.ts` (quote placement check)

## Symptom

Re-extracting smdj with its individual editorials in `extraSources` dropped 17 valid quotes as `wrong-contest`. For example, the Nicolas quote for South San Francisco District 3 was dropped as "under foster-city-council-1". Before this run, 26 of smdj's 30 picks had no quotes.

## Root cause

Each SMDJ editorial page opens with teasers for the previous and next editorials:

```
Previous
[Editorial: Nash, Newsom, Sahae for San Mateo City Council]
Editorial: Nash, Newsom, Sahae for San Mateo City Council
Next Up
[Editorial: Venkat for District 1 Foster City Council]
Editorial: Venkat for District 1 Foster City Council
Editorial: Nicolas for South San Francisco District 3
```

- `headingMarkers` read the unbracketed teaser headline as a contest heading.
- The article's own title ("South San Francisco District 3") matches no City Council pattern, because it never says "council".
- So the closest heading above the article's quotes was the teaser for another race.
- `sidebarLines` already skips lines after labels such as "Related Articles", but its list did not include "Previous" or "Next Up".

## Repro

Run `npx vitest run tests/placement.test.ts -t "previous and next"` on the old code. It returns `foster-city-council-1` where the test expects `null`.

## Fix

- Added `previous` and `next\s+up` to `SIDEBAR_LABEL` in `src/pipeline/placement.ts`.
- As of this date, only smdj's stored pages contain either line.

## Verification

- `tests/placement.test.ts` and `tests/extract.test.ts` pass.
- `npm run bb -- extract smdj --browser --force-extract` kept 22 more quotes and left every pick unchanged.
- `quote-lint --guide smdj` reports 0 failures.

## Guardrail

- The test "ignores the teasers above an editorial (San Mateo Daily Journal layout)" in `tests/placement.test.ts`.
- Still open:
  - One Guingona quote is placed under `us-rep-15`.
  - Two Burlingame Measure D quotes and one Millbrae quote fail the `attributed-speech` check as false positives.
