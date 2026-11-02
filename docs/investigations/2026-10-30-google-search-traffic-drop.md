# Google search traffic drop on Oct 22

Date: 2026-10-30
Repo: other (bay-ballot)
Trigger: curiosity

## Context
- Search Console showed about 4K impressions/day from Oct 11 to Oct 21, then nearly zero from Oct 22 on, across every query, including the brand query "bayballot".

## Key Findings
- The drop is real. Vercel Web Analytics shows visits referred by Google falling from about 430/day (Oct 14–21) to about 30/day (Oct 23–29). By hour, it fell between 05:00 and 08:00 UTC on Oct 22.
- No deploy caused it. Production went about 35 hours without a deploy before the drop: #265 shipped Oct 20 18:38 UTC, and #273 shipped Oct 22 13:23 UTC, after the drop. #263 (home canonical) shipped Oct 19 and traffic held for 2 days after it.
- Google is not blocked: robots.txt allows everything, contest pages return 200 with their own URL as canonical and no `noindex`, and the project has no Vercel firewall config.
- Search Console shows no manual action, no security issue, and no removal request.
- Google dropped the pages from its index. The Pages report fell from about 590 indexed pages to 324 by Oct 22 (that report was last updated Oct 22). "Crawled - currently not indexed" rose to 302 and "Discovered - currently not indexed" to 96. On Oct 30, `site:bayballot.com` returned about 9 results: the home page, county and area pages, and a few guides.
- URL Inspection of the top-traffic page `/2026-11/cccd-ward-3` (query "becca barrett vs allyse tanovitz") says "Crawled - currently not indexed", last crawled Oct 11, fetch successful, and indexing allowed. Google removed it from the index without crawling it again, so the change came from Google's quality evaluation, not from anything the page served.
- Adding official text did not bring pages back. #284 put the Secretary of State's official summaries on the 14 state proposition pages late on Oct 22, raising them to about 490 words of HTML. URL Inspection on Oct 30 showed all 14 as "Crawled - currently not indexed". Seven of them (props 1, 3, 38, 42, 43, 44 and 45) were crawled Oct 23–27, after the text was live.
- The drop looks like a judgment about the whole site, not about individual pages. Google traffic fell within one 3-hour window on Oct 22. Indexed pages fell from about 590 to 324 by Oct 22, and `site:` showed about 9 by Oct 30. The dropped pages include ones Google hadn't crawled since Oct 11. Per-page content changes are unlikely to reverse it on their own.
- On Oct 30, indexing was requested for the 10 contest pages with the most clicks; all 10 were confirmed out of the index.
- I found no Google core update or spam update announced for Oct 21–22. The September 2026 spam update finished Oct 8.

## How It Works
- "Crawled - currently not indexed" is Google deciding a page isn't worth keeping in the index. It's a quality judgment, not a technical error. Most likely Google rates the ~550 contest pages (about 690 URLs in the sitemap) as thin, near-duplicate pages built from one template on a new domain. Election content gets stricter quality treatment from Google. Area and county hub pages, which have more unique content, survived.

## Gotchas
- The Search Console Pages report lags by several days. `site:` and URL Inspection show the current state.
- A Search Console message about "Alternate page with proper canonical tag" on Oct 26 is expected: `/2026-11` sets its canonical to `/` (#263). It is not the cause.

## References
- docs/bugs/2026-10-19-home-redirect-split-canonical.md
- src/app/sitemap.ts, src/lib/seo.ts
