# SEO status

The current state of Bay Ballot in Google Search, and the log of what has been tried. Update it whenever indexing changes, a fix ships, or a measurement is taken. Dated investigations and designs are linked below and hold the detail.

Last updated: 2026-11-02

## Where things stand

- **Status:** most contest pages were dropped from Google's index on Oct 22, 2026. Google referral traffic fell from about 430 visits a day to about 30.
- **Still indexed:** the home page. `site:bayballot.com` returned about 9 results on Oct 30 (home, county and area pages, a few guides) and 1 on Nov 2 (the home page).
- **Not indexed:** contest pages, including all 14 state propositions ("Crawled - currently not indexed").
- **Penalties:** none. Search Console shows no manual action, no security issue and no removal request (checked Oct 30).
- **Authority:** Ahrefs Domain Rating 4.2 (Oct 30), so almost no outside links.
- **Likely cause:** Google re-rated the whole site (a new domain with hundreds of near-identical template pages), not any single page. Details are in the Oct 30 investigation.

## Plan

Approach A from `docs/superpowers/specs/2026-10-30-site-level-seo-design.md`:

1. Keep every contest indexable. A guide-count cutoff was rejected: 3 of the top 10 contest pages by clicks had only 1 guide.
2. Keep county and area pages as the pages Google ranks for broad searches.
3. Add link features (a guide badge, a press section) and send a few pitches.

| Step | Status |
|---|---|
| Design doc | draft, in review |
| Guide badge, press section | not started (needs three-option mockups) |
| Pitches | not started |

## Measurements

Add a row each week from Search Console (Pages report, Performance) and `site:bayballot.com`.

| Date | Indexed pages | Crawled, not indexed | Discovered, not indexed | `site:` results | Google visits/day (Vercel) | Notes |
|---|---|---|---|---|---|---|
| ~Oct 18 | ~590 | ~110 | ? | ? | ~430 | before the drop |
| Oct 22 | 324 | 302 | 96 | ? | 192 (that day) | Pages report last updated this day |
| Oct 30 | ? (report lags) | ? | ? | ~9 | ~20–60 | 10 contest pages requested for re-indexing |
| Nov 2 | ? | ? | ? | 1 | 11–31 (Oct 30 to Nov 2) | `site:` shows only the home page, signed out. Search Console not checked |

## Experiments and results

| Date | What | Result |
|---|---|---|
| Oct 19 | #263 (serve the Bay Area ballot at /): fixed a canonical mismatch on the home page | Traffic held for 2 more days; not the cause of the drop |
| Oct 22 | #284 (state proposition official summaries): ~490 words of official text on prop pages | 7 of 14 crawled afterward, all still not indexed. Copied official text doesn't help |
| Oct 30 | Requested indexing for the 10 contest pages with the most clicks: cccd-ward-3, court-of-appeal-6, gold-ridge-fire-director, solano-county-measure-e, sonoma-county-fire-director, supreme-court-groban, san-mateo-county-measure-j, wvm-trustee-area-7, wvm-trustee-area-3, solano-county-measure-h | Pending; check the week of Nov 6 |

## Lessons

- The Search Console Pages report lags by days. URL Inspection and `site:` show the current state.
- Copying official text (Secretary of State, county guides) adds no unique content in Google's eyes; that text is on many sites.
- New content must not restate what the page already says.
- Ahrefs has no Search Console or analytics data for this site, and its API units ran out on Oct 30. Vercel Web Analytics (filter `referrerHostname` to Google) is the reliable traffic source.

## References

- `docs/investigations/2026-10-30-google-search-traffic-drop.md`
- `docs/superpowers/specs/2026-10-30-site-level-seo-design.md`
- `docs/bugs/2026-10-19-home-redirect-split-canonical.md`
- Search Console property: `sc-domain:bayballot.com`
