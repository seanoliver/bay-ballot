# Site-level SEO: earn links, keep every contest indexable

Date: 2026-10-30
Status: draft for review

## Why

On Oct 22, between 05:00 and 08:00 UTC, Google referral traffic to bayballot.com collapsed, and Google dropped most of its ~590 indexed pages. Google referral visits fell from about 430 a day to about 30. Search Console shows no manual action, no security issue and no removal request. Contest pages are now "Crawled - currently not indexed". The home page, the county and area pages, and a few guide pages are still indexed. See `docs/investigations/2026-10-30-google-search-traffic-drop.md`.

Adding official text did not bring pages back. All 14 state proposition pages got the Secretary of State's summaries in #284, and 7 of them were crawled after that went live. All 14 are still out of the index. The drop looks like Google re-rating the whole site: a new domain with Ahrefs Domain Rating 4.2, with hundreds of near-identical template pages. More text per page is not the fix.

## Goals

- Before the next election, have Google index the county and area pages and the strong contest pages.
- Win broad searches ("contra costa endorsements") with county and area pages, and race searches ("becca barrett vs allyse tanovitz") with strong contest pages.
- Earn outside links through features that make linking natural, plus a few pitches. No sustained outreach campaign.

## Non-goals

- Recovering traffic for the Nov 3, 2026 election.
- Adding more text to contest pages. The prop pages show it doesn't fix indexing. Clutter cleanup (option C in the mockups) is a separate UX change if wanted.
- Importing county voter guides.

## Anti-goals

- Hiding any contest from visitors. Pages that aren't indexed stay on the site, stay linked from county pages and keep working.
- Adding text that restates what the page already says (Sean's rule from the mockup review).
- Anything with a recurring paid cost.

## Constraints

- Every fact on the site stays traceable to a source, and Bay Ballot gives no recommendations of its own.
- Next.js version in this repo differs from common knowledge: read `node_modules/next/dist/docs/` before using the Metadata `robots` API.
- Changes visitors can see need a changelog entry (`data/changelog/`), per AGENTS.md. The link features count.
- Any visible UI (the guide badge, the press page) goes through Sean's three-design-options step before it is built.

## Approaches considered

- **A. Keep only strong pages indexed, strengthen county pages (chosen, then narrowed).** Originally: `noindex` contests with fewer than 3 guides and add link features. Review found 1-guide pages among the top traffic pages, so the pruning half was dropped. What remains is close to C, plus a check of the county pages.
- **B. Merge contests into county pages.** Every contest's canonical points at its county page. This sends Google the clearest signal but gives up race searches, which drove the October traffic.
- **C. Links only.** No indexing changes. At Domain Rating 4.2 this is likely too slow, and Google keeps judging the site by its thinnest pages meanwhile.

## Design

### 1. No pruning (decided in review)

- Every contest stays indexable. A guide-count cutoff was dropped: 3 of the 10 contest pages with the most clicks had only 1 guide (court-of-appeal-6, gold-ridge-fire-director, sonoma-county-fire-director). For small races, one endorsement may be the only information online, so those pages are valuable to searchers.
- Recovery relies on outside links and on the county and area pages Google already keeps.

### 2. County and area pages

- These already render every contest with candidate names and top-line results in server HTML (about 2,300 visible words on `/2026-11/contra-costa`), and Google kept them. No content change is needed.
- Check that each contest row on a county page links to its contest page with a plain `<a href>` in server HTML, for 1-guide contests too.

### 3. Link features (visible UI: three-option mockups first)

- **Guide badge.** Each guide page (`/guides/<id>`) gets a "Link to this comparison" block: a copyable HTML snippet with a small badge or text link back to that guide's page on Bay Ballot ("See how [guide] compares with other Bay Area guides"). Guides that want to show they're part of the comparison can paste it.
- **Press and about page.** A section on `/about`, or a `/press` page, with a one-paragraph description, the number of guides and contests covered, a screenshot and a contact address, so a journalist or newsletter writer can link without having to ask.
- **Pitch list (not code).** A short list of local newsletters, subreddits and reporters who covered Bay Area voter guides in 2026, with draft pitches. Sean sends them himself. Drafts go to Bear per Sean's drafting rule.

### 4. Measuring the result

- Starting now, record weekly from Search Console: indexed page count, "Crawled - currently not indexed" count, and impressions. Track the 10 contest pages that had indexing requested on Oct 30 as a control group.
- If contest pages still aren't indexed a few months after the link features ship, reconsider pruning by search data (keep pages Google showed in results) or approach B.

## Calls made in review (Claude's, for Sean to check)

- **Ship after Nov 3.** The link features go out after election day, once a design is picked.
- **Tracking is manual.** Sean or Claude adds a weekly row to `docs/seo.md` from Search Console and Vercel Analytics. No API automation (which would need setup and possibly a recurring cost).
- **Contact address:** the press section uses `corrections@bayballot.com`, which the footer already shows.
- **Control group:** the 10 re-indexed pages are listed in `docs/seo.md`. Three of them have only 1 guide (court-of-appeal-6, gold-ridge-fire-director, sonoma-county-fire-director); that is why the cutoff was dropped.

## Left to the builder

- How the badge snippet is generated and tested.
- Changelog entry wording for the link features.
