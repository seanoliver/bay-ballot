# SMDJ teaser headlines misplace quotes

- **Date**: 2026-10-14
- **Area**: `src/pipeline/placement.ts` (quote placement check)

## Symptom

Re-extracting smdj with its individual editorials in `extraSources` dropped 17 valid quotes as `wrong-contest`. For example, the Nicolas quote for South San Francisco District 3 was dropped as "under foster-city-council-1". Before this change, 27 of smdj's 30 picks had no quotes.

## Root cause

Each SMDJ editorial page opens with teasers for the previous and next editorials:

```
Previous
[Editorial: Nash, Newsom, Sahae for San Mateo City Council]
Editorial: Nash, Newsom, Sahae for San Mateo City Council
The members of the San Mateo City Council work hard, do thei…
Next Up
[Editorial: Venkat for District 1 Foster City Council]
Editorial: Venkat for District 1 Foster City Council
Two current councilmembers, Mayor Art Kiesel and Councilmemb…
Editorial: Nicolas for South San Francisco District 3
```

- `headingMarkers` read the unbracketed teaser headline, and the clipped snippet after it, as contest headings. The snippet above names Art Kiesel, a Foster City candidate.
- The article's own title ("South San Francisco District 3") names no candidate and doesn't say "council", so it matches no contest.
- So the closest heading above the article's quotes belonged to the teaser for another race.
- On the Guingona page, the "Next Up" snippet is "U.S. Congress, District 15:", the first line of the roundup article.

## Repro

Run `npx vitest run tests/placement.test.ts -t "article teasers"` on the old code. Three of the six tests fail.

## Fix

`sidebarLines` in `src/pipeline/placement.ts` now finds a teaser by three lines in order:
1. A "Previous" or "Next Up" label.
2. A `[Headline]` link line.
3. The same headline again, unbracketed.

It skips only the repeated headline and the snippet line after it, so the article's own title still counts as a heading.

**Rejected first attempt:** adding "Previous" and "Next Up" to `SIDEBAR_LABEL`. That label rule hides the next 12 lines, which also covered each article's title. The check then saw no heading at all, so it could not catch a quote filed under the wrong race.

**Rejected second attempt:** matching `[X]` followed by `X` without the label. Empower Oakland and East Bay DSA use that same pattern for real candidate headings, and 13 of their quotes started failing.

## Verification

- `npm run bb -- quote-lint` over all guides gives output identical to before the change: 2 of 1035 failing, both unrelated.
- `tests/placement.test.ts`, `tests/extract.test.ts` and `tests/quotes.test.ts` pass.
- Removing each part of the rule (the twin line, the snippet line, the twin match) makes at least one of the six tests fail.
- `npm run bb -- extract smdj --browser --force-extract`: picks unchanged, 19 of 30 picks quoted, `quote-lint --guide smdj` reports 0 failures.

## Guardrail

- The "article teasers (San Mateo Daily Journal layout)" tests in `tests/placement.test.ts`. They include the Empower Oakland layout, and a check that a quote under the article's own headline is still flagged when it is filed under another race.
- Still open: `attributed-speech` false positives on a Burlingame Measure D quote and a Millbrae quote.
