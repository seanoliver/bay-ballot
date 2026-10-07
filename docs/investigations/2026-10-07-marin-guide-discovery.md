# Bay Ballot Marin discovery: Marin County (Nov 3, 2026)

Researched 2026-10-07. It follows the structure of `2026-10-06-peninsula-guide-discovery.md`. This pass is research only. Nothing has been extracted, and `areas.yml`, `ballot.yml` and the guide files are unchanged.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-07 and saw Nov 2026 picks.
- **Not published**: the page loads but has no Nov 2026 picks, or it is stale.
- **Unverified**: I could not confirm it. The reason is given in each case.

**Access notes**
- `marincounty.gov` returns **403 to curl** for every page, including the elections pages. It loads in a real browser (Playwright), and same-origin `fetch()` from an open page works. Everything county-side below was read that way.
- `sierraclub.org` returns an Incapsula wall (212 bytes) to curl. It loads in a browser. The existing guide already has `fetchWith: browser`.
- `marinpost.org` returns **HTTP 401** (password-protected) to both curl and the browser. The site is effectively offline.
- `marinscope.com` (Sausalito Marinscope / Novato Advance / Mill Valley Herald) has lapsed and now serves SEO spam. `novatoadvance.com` redirects to an unrelated site, and `millvalleyherald.com` does not resolve.
- Wix sites (`nbclc.org`, `marinlwv.org`) contain the word "captcha" in their script bundles, but they return full server-rendered pages to curl. They are not bot walls.
- `marinij.com` serves full article text in the HTML. Its paywall is a client-side meter, so curl gets everything.

---

## 1. Guide table

Abbreviations: P, CC, W, X etc. are the Marin measure letters (section 2). "Reasons" means the guide explains each pick. "List" means it gives picks only. Proposed ids are suggestions.

### Newspapers

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Marin Independent Journal (`marin-ij`) | newspaper | One editorial per race. Index: https://www.marinij.com/opinion/editorials/ (no endorsements-only page; list each editorial as a source, like `smdj`) | **Yes, rolling** since 8/31 | Yes | HTML (metered, full text in HTML) | None | SD2 Connolly; CD2 Huffman; AD12 Lucan; Novato USD TA4 Picus; San Rafael D3 Davidi; Novato D2 Farac, D4 Christian; Larkspur Andre, Margulies, Friedel; San Anselmo Burdo, Dittmar; Tiburon Ryan, Defever, Hornbrook; Sausalito Cox, Hoffman; **Yes P**; Ross Herbst, McMillan; **Yes X**; **Yes CC** + Marin Healthcare D3 Su, D1 Hess; **No W**. Statewide: Lt Gov Ma, Insurance Commissioner Allen (both are Bay Area News Group editorials, "Written by the Bay Area News Group editorial board") |
| Pacific Sun | newspaper | https://pacificsun.com/voters-guide-part-two/ is from **2018** | **Not published** (no 2026 endorsements in search or feed) | — | — | None | — |
| Point Reyes Light | newspaper | https://www.ptreyeslight.com/ | **Not found.** The site search shows only old endorsement editorials (e.g. a June 3 primary) | — | — | None | West Marin districts, if it publishes |
| The Ark (Tiburon/Belvedere) | newspaper | https://www.thearknewspaper.com/election2026 | **Not found.** It has race coverage (Tiburon council, Reed Measure O) but no endorsements on the hub | — | Wix | None | Tiburon, Belvedere, Reed |
| Marin Post | blog/opinion | https://www.marinpost.org/ | **Unverified**: HTTP 401 to curl and the browser | — | — | **401** | — |
| Press Democrat | newspaper | https://election.pressdemocrat.com/guide/marin returns 404 (2026 primary hub only) | **Not found** for AD12/SD2/CD2 general | — | — | None | AD12, SD2 (Sonoma side) |

IJ editorial URLs (all verified 2026-10-07):
- https://www.marinij.com/2026/08/31/editorial-ij-recommends-connolly-in-race-for-state-senate-seat/
- https://www.marinij.com/2026/09/02/editorial-huffman-has-earned-chance-to-represent-expanded-district-in-congress/
- https://www.marinij.com/2026/09/05/editorial-in-close-race-lucans-experience-makes-him-choice-for-assembly/
- https://www.marinij.com/2026/09/06/editorial-novato-should-reelect-picus-to-school-board/
- https://www.marinij.com/2026/09/09/editorial-davidi-gets-nod-in-tight-race-for-district-3-seat-on-san-rafael-council/
- https://www.marinij.com/2026/09/13/editorial-ij-recommends-farac-christian-in-novato-council-races/
- https://www.marinij.com/2026/09/16/editorial-andre-friedel-margulies-best-for-larkspur/
- https://www.marinij.com/2026/09/20/editorial-in-tight-race-ij-picks-burdo-dittmar-for-san-anselmo-council/
- https://www.marinij.com/2026/09/23/endorsement-ryan-hornbrook-defever-best-for-tiburon-council/
- https://www.marinij.com/2026/09/24/endorsement-cox-huffman-get-nod-over-strong-challengers-in-sausalito/
- https://www.marinij.com/2026/09/26/endorsement-marin-childcare-tax-measure-p-deserves-support/
- https://www.marinij.com/2026/09/27/endorsement-ij-recommends-herbst-mcmillan-for-ross-council-seats/
- https://www.marinij.com/2026/09/28/endorsement-elect-fiona-ma-californias-lieutenant-governor/
- https://www.marinij.com/2026/09/30/endorsement-sausalitos-marinship-needs-measure-x-to-take-a-step-forward/
- https://www.marinij.com/2026/10/03/endorsement-pass-measure-cc-hospital-tax-elect-su-hess-to-healthcare-board/
- https://www.marinij.com/2026/10/04/endorsement-elect-ben-allen-californias-next-insurance-commissioner-2/
- https://www.marinij.com/2026/10/05/editorial-ij-recommends-no-vote-on-san-rafael-measure-w/

Not yet covered by the IJ: Corte Madera, Fairfax, Mill Valley, Belvedere, all school boards except Novato TA4, County Board of Education, special districts except Marin Healthcare, and Measures N, O, Q–V (except W, X), Y–FF.

### Parties

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Marin County Democratic Party (`marin-dems`) | party | https://marindemocrats.org/2026-november-election-endorsements/ (measure pages: `/measure-n-miller-creek-school-district/`, `/measure-p/`, `/measure-w-san-rafael-services/`, `/measure-cc-critical-care-for-marin/`) | **Yes** | Candidate statements for some; one page per measure | HTML | None | CD2 Huffman; SD2 Connolly; councils: Corte Madera Beckman, Fruin; Fairfax Adams; Larkspur Andre, Burnett; Novato D2 Farac, D4 Christian; San Anselmo Burdo, Dittmar; San Rafael D2 Hill, D3 Sandoval; Sausalito Saad, Brinton; Tiburon Hornbrook, Ryan. Schools: County BOE TA5 Nemzer, TA6 Robinson; Miller Creek Hutchinson, Honsberger; Reed Ghaffary, Godfrey, Tsai; Sausalito Marin City Holcomb, Maunder; Tam Union Koo, Sutherland, Wynn. Other: Fairfax Clerk Ackerman; Marin City CSD Wiggins (full), Canson (short); North Marin Water D5 Williams; Southern Marin Fire DeBerry. **Yes N, P, W, CC.** No AD12 pick (two Democrats). Statewide: links to CADEM |
| Marin County Republican Party (`marin-gop`) | party | https://maringop.org/elections/endorsements/ (measures, HTML) and https://maringop.org/2026/09/15/marin-gop-endorses/ (candidates, two PNG cards: `/wp-content/uploads/2026/09/Artboard-1@4x-1.png`, `Artboard-2@4x-1.png`) | **Yes** (voted at the July meeting, posted 9/15) | Measures: long reasons for No on CC, PDF for No on P. Candidates: list | HTML + **PNG images** (candidates) + PDF (`/wp-content/uploads/2026/09/Measure_P_Opposition.pdf`) | None | SD2 Gibbs; CD2 Littau; Governor Hilton, Lt Gov Romero, SoS Wagner, Controller Morgan, Treasurer Hawks, AG Gates, SPI Shaw (no Insurance Commissioner pick); Marin Healthcare D1 Hess; Novato D4 Carpiniello; Richardson Bay Sanitary Turnacliff; County BOE TA3 Adams; Novato USD TA4 Drouillard. **No P, No CC.** "No position" on the paramedic tax renewals. Props: Yes 39, 41, 42, 43; No 1–5, 37, 38, 40, 44, 45 |
| County Voter Information Guide, party endorsements | (reference, not a guide) | https://www.marincounty.gov/departments/elections/november-3-2026-general-election/vig-endorsements-110326 | Yes | — | HTML | 403 to curl | Party endorsements printed under EC 13302(b): Democratic Party (statewide offices, BOE 2 Lieber, CD2 Huffman, SD2 Connolly; no AD12), American Independent Party, and others |

### Democratic clubs

| Guide | Type | URL | Published? | Notes |
|---|---|---|---|---|
| Marin County Council of Democratic Clubs | club | **Not found.** `mccdc.org` is a child development center, not this group. No site turned up in search | **Unverified** | The Marin Dems' clubs page lists chartered clubs (12th Assembly District Democrats, California Young Democrats Marin Chapter, PDA Marin, Novato Democratic Club) with **no websites** |
| Novato Democratic Club, PDA Marin, CYD Marin, 12th AD Democrats | club | No sites found | **Unverified / none found** | — |

### Labor

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| North Bay Labor Council, AFL-CIO (`nbclc`) | union | https://www.nbclc.org/2026endorsements | **Yes** (the page also covers Sonoma, Napa, Mendocino, Lake; the June section is gone) | List | HTML (Wix) | None | CD2 Huffman; SD2 Connolly; **AD12 Elward** (priority race); San Rafael D2 Hill, D3 Sandoval; Fairfax Adams, Bragman; San Anselmo Burdo, Dittmar; Novato D2 Farac; Larkspur Burnett, Friedel; Corte Madera Beckman, Fruin, Gallegos; Novato USD TA4 Picus; College of Marin Treanor (**not on the ballot**). **Yes CC, P, W, N, R, S, U, V, Y, BB, DD** (not Q). It links a separate statewide list (props) |
| Marin Building Trades | union | No separate site or list found. NBCLC is the Marin/Sonoma council | **Unverified** | — | — | — | — |
| SEIU 1021 (already a guide) | union | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 | **Yes** | List | HTML | None | Marin section: Novato D2 Farac, D4 Christian; **Yes Marin P; Yes San Rafael W**. Also AD12 Elward, SD2 Connolly, and Sonoma County BOE TA2 Quinn (a cross-county contest on some Marin ballots). **No CD2 pick** |

### Advocacy

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Sierra Club SF Bay Chapter (already a guide, `sierra-club-sf-bay`) | advocacy | https://www.sierraclub.org/sfbay/2026-endorsements | **Yes** | List (explanations only for SF items) | HTML | **Incapsula** (browser OK) | CD2 Huffman; SD2 Connolly; **AD12 Elward**; Corte Madera Beckman; Larkspur Andre, Margulies; Mill Valley Perrey; Novato D2 Farac; San Rafael D2 Hill; Sausalito Brinton; **Yes Sausalito X**. Also lists **"Board of supervisors D1: Mary Sackett"**, which was decided in June and is not on the Nov ballot |
| Sierra Club Marin Group | advocacy | https://www.sierraclub.org/san-francisco-bay/marin/political-endorsements | **Not published**: "We are kicking off our 2026 endorsement process now" with 2024 results below | — | HTML | Incapsula | Use the chapter page |
| YIMBY Action (already a guide) + Marin YIMBY chapter | advocacy | https://yimbyaction.org/endorsements/november-2026-california-general . Chapter reasons: https://marinyimby.org/endorsements/endorsements/ca-state-assembly/ , `/statewide-offices/`, `/local-ballot-measures/` | **Yes** | National page: list. Chapter pages: reasons for AD12, Ma, Allen, props 1, 37, 43, Sausalito X | HTML (chapter index is client-rendered; the three subpages are server-rendered) | None | CD2 Huffman; AD12 Lucan; Larkspur Jaffe, Walter; Corte Madera Fruin, Bell, Beckman; Novato D2 Farac, D4 **Eklund**; Ross Roesler, Herbst; San Anselmo Dittmar; San Rafael D2 Hill, D3 Sandoval; **Yes Sausalito X**. Chapter site has no local candidate picks |
| Courage California (already a guide) | advocacy | https://www.progressivevotersguide.com/california/2026/general/county/marin | **Yes** | Yes | HTML | None | CD2 Huffman, SD2 Connolly, AD12 Elward, BOE 2, props. **No local races** |
| California Working Families Party (already a guide) | party (minor) | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf | **Yes** | List | PDF | None | SD2 Connolly, AD12 Elward, **Larkspur Burnett**. Nothing else in Marin |
| Bay Rising Action (already a guide) | advocacy | https://bayrisingaction.org/voterguide/ | **Yes** | Yes | HTML | None | Marin section: **Yes P** only |
| Greenbelt Alliance (already a guide) | advocacy | https://www.greenbelt.org/voter-guide-26/ | **Yes** | Yes | HTML | browser (existing `fetchWith`) | **Yes Sausalito X**. The page also still carries a June Measure B (SMART) item |
| Indivisible Marin (`indivisible-marin`) | advocacy | https://indivisiblemarin.org/indimarins-voters-guide links the PDF https://indivisiblemarin.org/s/IndiMarin-Voting-Guide-for-California-2026-Midterms.pdf (redirects to Squarespace static) | **Yes** (published 9/22) | Yes (summary per item) | PDF, text layer | None | CD2 Huffman, SD2 Connolly, **AD12 Elward**, **Yes P, Yes CC**, all 17 props (Yes 1–5, 37, 38; No 39–45), **Yes on all Supreme Court and Court of Appeal retentions** |
| Marin Environmental Voters | advocacy | No such organization found. California Environmental Voters (statewide) endorses Huffman and Connolly per their campaign pages, but is not a guide in the repo | **Unverified** | — | — | — | — |
| Marin Conservation League | advocacy (c3) | https://www.marinconservationleague.org/ | **None found.** No election or measure positions on the site | — | — | None | — |
| Marin County Bicycle Coalition | advocacy (c3) | https://marinbike.org/ | **Not published.** As a c3 it runs candidate questionnaires ("Bike the Vote", last 2024), not endorsements | — | — | None | — |
| Marin Environmental Housing Collaborative | advocacy | https://www.mehc.org/ returns a 114-byte page | **None found** | — | — | — | — |
| Marin Builders Association, Marin Association of Realtors, North Bay Leadership Council | business | https://mba-online.org/ , https://www.marinrealtors.com/ , https://www.northbayleadership.org/ | **None found** (no endorsement pages; the Indivisible PDF lists NBLC as a Measure CC supporter) | — | — | None | — |
| Chambers of commerce (San Rafael etc.) | business | `sanrafaelchamber.com` fails TLS to curl | **Unverified** | — | — | — | — |

### Civic (Leagues don't endorse candidates)

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| League of Women Voters of Marin County (`lwv-marin`) | civic | https://www.marinlwv.org/local-ballot-measure-recommendations | **Yes** | No own reasons (links to the county's measure pages) | HTML (Wix) | None | **Yes P, N, CC** |
| LWV California (already a guide) | civic | https://lwvc.org/ballot-recommendations/ | Yes | Yes | HTML (`manual: true`) | — | Props |

### Counts

Guides with any Nov 2026 Marin pick, local or district (statewide-only guides excluded):
- **Published, new:** 6. These are marin-ij, marin-dems, marin-gop, nbclc, lwv-marin and indivisible-marin.
- **Published, existing and should be widened:** 7. These are sierra-club-sf-bay, yimby-action, courage-california, ca-wfp, seiu-1021, bay-rising-action and greenbelt-alliance.
- **Statewide only, widen by precedent:** lwv-ca (as for the Peninsula).
- **Not published or not found:** Pacific Sun, Point Reyes Light, The Ark, Press Democrat, Sierra Club Marin Group (uses the chapter page), Council of Democratic Clubs and the chartered clubs, Marin Building Trades, MCL, MCBC, MEHC, business groups. Marin Post is unreachable (401).

---

## 2. Ballot contests

### Sources

- Local candidates ON the ballot (list created 8/17/2026): https://www.marincounty.gov/departments/elections/november-3-2026-general-election/information-and-about-candidates-110326/local-candidates-ballot-110326
- Local candidates NOT on the ballot: https://www.marincounty.gov/departments/elections/november-3-2026-general-election/information-and-about-candidates-110326/local-candidates-not-ballot-110326
- Measures list (updated 8/10/2026), one page per measure with the ballot question: https://www.marincounty.gov/departments/elections/november-3-2026-general-election/information-about-measures-110326/list-measures-110326
- Notice of Election (offices on the ballot): https://www.marincounty.gov/departments/elections/november-3-2026-general-election/news-releases-110326/notice-election-november-3-2026-general-election
- SoS Certified List of Candidates (8/27/2026), already in `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`.
- Redacted extracts committed with this doc: `data/2026-11/sources/Marin-Candidates-Nov2026.txt` (contest, seats, candidate names with an incumbent marker; no ballot designations or contact data) and `data/2026-11/sources/Marin-Measures-Nov2026.txt` (letter, jurisdiction, ballot question, vote required).

Machine-readability: all county pages are HTML, but they need a browser (403 to curl). There is no PDF roster or sample-ballot lookup in use. Precinct maps are on ArcGIS (https://experience.arcgis.com/experience/591190cfd0a84a56a5155698b21c3fee).

### State and federal districted contests

The Notice of Election lists exactly these for Marin. The whole county is in each district.

| Contest | Candidates (SoS) | Proposed change |
|---|---|---|
| U.S. Representative, District 2 | Jared Huffman (D), Robin Littau (R) | New `us-rep-2`, within Marin |
| State Senate, District 2 | Damon Connolly (D), Tief Gibbs (R) | New `state-senate-2`, within Marin. First State Senate contest in the data. `STATE_DISTRICTS` already lists "State Senate" |
| State Assembly, District 12 | Jackie Elward (D), Eric Lucan (D) | New `assembly-12`, within Marin. The county notice calls it "short-term" (unverified why) |
| Board of Equalization, District 2 | Sally J. Lieber, John Pimentel | Existing `board-of-equalization-2`: add Marin to `within` |
| 1st District Court of Appeal (11 retentions) | Same justices as the existing contest | Existing `court-of-appeal-1`: add Marin to `within` |

Statewide offices, Supreme Court retention and Props 1–5 and 37–45 are already in `ballot.yml` and apply as is. **Marin is not in the Regional Transit Measure** (the RTM covers Alameda, Contra Costa, SF, San Mateo and Santa Clara, per the Sierra Club and YIMBY Action pages and the county's measure list). The `rtm` contest's `within` must not gain Marin.

### Local candidate contests on the ballot (40)

The county lists these as ON the ballot. Coverage counts guides from section 1 with a pick in the contest.

| # | Contest | Seats | Candidates | Guides with picks |
|---|---|---|---|---|
| 1 | Marin County Board of Education, TA3 | 1 | Cynthia Johanson Irish (inc), Craig Stuart Adams | GOP |
| 2 | Marin County Board of Education, TA5 | 1 | Marilyn Nemzer (inc), Avery Lieberman | Dems |
| 3 | Marin County Board of Education, TA6 | 1 | Curtis F. Robinson (inc), James Goddard | Dems |
| 4 | Sonoma County Board of Education, TA2 (cross-county) | 1 | Jonathan Lenz, Caitlin Quinn | SEIU |
| 5 | Petaluma Joint UHSD, TA3 (cross-county) | 1 | John Garcia, Laura Holmes | — |
| 6 | Tamalpais Union HSD | 3 | Roenisch (inc), Saavedra (inc), Maria D. Sandoval, Joy Scully Koo, Brian A. Sutherland, Valerie Wynn, Leslie J. Harlander | Dems |
| 7 | Miller Creek SD | 3 | Honsberger (inc), Hutchinson (inc), McShane (inc), Adam Compton, Matt Dance | Dems |
| 8 | Lagunitas SD | 3 | Michelson (inc), Charlotte Burger Troy, Ally Dukkers Wilson, David Cort | — |
| 9 | Novato Unified, TA4 | 1 | Abbey Picus (inc), Francis Drouillard | IJ, NBCLC, GOP |
| 10 | Reed Union SD | 3 | Ghaffary (inc), Tsai (inc), Krupa Antani, Lina Godfrey | Dems |
| 11 | Ross SD | 3 | Mozaffarian (inc), Gabby Solar, Beth Sutro, David Allen-Hughes, Brad Hill | — |
| 12 | Sausalito Marin City SD | 3 | Walters (inc), Leshawn Holcomb, Alena Maunder, Eduardo Vazquez | Dems |
| 13 | Belvedere City Council (uncontested) | 2 | Peter Mark (inc), Jane Cooper (inc) | — |
| 14 | Corte Madera Town Council | 3 | Beckman (inc), Ravasio (inc), David C. Bell, Ava Fruin, Deborah E. Gallegos | Dems, NBCLC, Sierra, YIMBY |
| 15 | Fairfax Town Council | 2 | Larry Bragman, Susan Denise Adams, Matt Da Cunha, Aubrey Harmon, Doug Kelly, Cheryl Scorza | Dems, NBCLC |
| 16 | Fairfax Town Clerk | 1 | Deborah Benson, Bruce Ackerman | Dems |
| 17 | Fairfax Town Treasurer (uncontested) | 1 | Talia Friedman (inc) | — |
| 18 | Larkspur City Council | 3 | Andre (inc), Margulies (inc), Gareth Walter, Aaron Burnett, Spencer Doyle, Jeanne Friedel, Brian H. Jaffe | IJ, Dems, NBCLC, Sierra, YIMBY, WFP |
| 19 | Mill Valley City Council (uncontested) | 2 | Stephen Burke (inc), Max Perrey (inc) | Sierra |
| 20 | Novato City Council, D2 | 1 | Rachel Farac (inc), Mike Little, Bob Rasmussen | IJ, Dems, NBCLC, SEIU, Sierra, YIMBY |
| 21 | Novato City Council, D4 | 1 | Pat Eklund (inc), Luiggino Galletto, Chris Carpiniello, Dan Christian | IJ, Dems, SEIU, YIMBY, GOP |
| 22 | Ross Town Council | 2 | Robert Herbst, Jeffrey Kuhn, Julie A McMillan, Paul J. Roesler | IJ, YIMBY |
| 23 | San Anselmo Town Council | 2 | Steve Burdo (inc), Philip Chigos, Will Dittmar | IJ, Dems, NBCLC, YIMBY |
| 24 | San Anselmo Town Clerk (uncontested) | 1 | Cecily T. Wilson (inc) | — |
| 25 | San Anselmo Town Treasurer (uncontested) | 1 | Lori J. Lopin | — |
| 26 | San Rafael City Council, D2 (uncontested) | 1 | Eli Hill | Dems, NBCLC, Sierra, YIMBY |
| 27 | San Rafael City Council, D3 | 1 | Daryoush Davidi, Robert Sandoval | IJ, Dems, NBCLC, YIMBY |
| 28 | Sausalito City Council | 2 | Joan Cox (inc), Jill James Hoffman (inc), Nastassya Saad, Adrian Brinton | IJ, Dems, Sierra |
| 29 | Tiburon Town Council | 3 | Kathleen Defever, Alice Fredericks, Chuck Hornbrook, Jack Ryan, Faris Jafar | IJ, Dems |
| 30 | Bel Marin Keys CSD | 2 | Lattanzio (inc), Nash (inc), Kevin Dugan | — |
| 31 | Marin City CSD | 3 | Douglas (inc), Haynes (inc), Eboni McKinley, Royce McLemore, Derek Morgan, Capri M. Price, La Tanya J. Wiggins, Beatra Hall | Dems |
| 32 | Marin City CSD, short term | 1 | Sarah Elizabeth Canson (inc), Terrie Harris Green | Dems |
| 33 | Southern Marin Fire Protection District | 4 | Chun, Deberry, Fleming, Perazzo (all inc), Eric Steinhofer, Amy Svendberg, Thomas Clark | Dems |
| 34 | Marin Healthcare District, Division 1 | 1 | Clayton Hess, Kendra Hoepper | IJ, GOP |
| 35 | Marin Healthcare District, Division 3 | 1 | Brian Su (inc), Jonathan Goff | IJ |
| 36 | Bolinas Community PUD | 3 | Andrew Alexander Green (inc), Grace Godino (inc), Mickey Murch, Nathan Siedman | — |
| 37 | Strawberry Recreation District | 3 | Saghezchi, Teese, Waterfield (all inc), David T. Morgenthaler | — |
| 38 | Strawberry Recreation District, short term | 1 | Doug Twillman (inc), Aliza Hawkins | — |
| 39 | Richardson Bay Sanitary District | 3 | Fitzgerald, McIntosh, Walravens (all inc), John Turnacliff | GOP |
| 40 | North Marin Water District, Division 5 | 1 | Marc Hunter Lewis, Laurie L. Williams | Dems |

Breakdown: 3 county board of education, 2 cross-county (Sonoma-run), 7 school, 17 city/town (6 of them uncontested), 11 special district. **29 of 40 have at least one guide pick.**

Not on the ballot (appointed in lieu, per the county): all of Marin Community College District (so NBCLC's College of Marin pick has no contest), San Rafael City Schools, MMWD Divisions 1, 3, 4, Novato D5 short term, Marin Healthcare D4, Mill Valley SD, Larkspur-Corte Madera SD, Kentfield SD, Ross Valley SD, Shoreline USD, Novato USD TA5 and TA6, and the other special-district seats: 54 contests in all, 33 of them special districts. The full list is in the source extract. There are no Board of Supervisors seats (D1 and D5 were decided in June).

### Local measures (20)

| Letter | Jurisdiction | Subject | Vote | Guides with positions |
|---|---|---|---|---|
| AB | Sonoma County Junior College District (cross-county) | $830M facilities bond | 55% | — |
| N | Miller Creek SD | $67M school bond | 55% | Dems Y, LWV Y, NBCLC Y |
| O | Reed Union SD | $115M school bond | 55% | — |
| P | County of Marin (citizen initiative) | Childcare parcel tax, 5¢/sq ft, ~$12.5M/yr, 15 yrs | Majority | IJ Y, Dems Y, NBCLC Y, SEIU Y, Bay Rising Y, LWV Y, Indivisible Y, GOP N |
| Q | Corte Madera | Ross Valley Paramedic Authority tax renewal | 2/3 | — (NBCLC lists the other paramedic renewals but not Q) |
| R | Fairfax | Paramedic tax renewal | 2/3 | NBCLC Y |
| S | Larkspur | Paramedic tax renewal | 2/3 | NBCLC Y |
| T | Mill Valley | Municipal services tax renewal (fire, vegetation, roads) | 2/3 | — |
| U | Ross | Paramedic tax renewal | 2/3 | NBCLC Y |
| V | San Anselmo | Paramedic tax renewal | 2/3 | NBCLC Y |
| W | San Rafael | Transfer tax 0.2% to 1%, ~$7.5M/yr | Majority | IJ **N**, Dems Y, NBCLC Y, SEIU Y |
| X | Sausalito (citizen initiative) | Marinship rezoning (AIM initiative), repeals Marinship Specific Plan | Majority | IJ Y, Sierra Y, YIMBY Y, Greenbelt Y |
| Y | CSA 27 (Ross Valley Paramedic Authority) | Paramedic tax renewal | 2/3 | NBCLC Y |
| Z | CSA 29 (Paradise Cay) | Dredging parcel tax | 2/3 | — |
| AA | Inverness PUD | Appropriations limit | Majority | — |
| BB | Kentfield Fire Protection District | Paramedic tax renewal | 2/3 | NBCLC Y |
| CC | Marin Healthcare District (citizen initiative) | Hospital parcel tax, 14¢/sq ft, ~$12.4M/yr, 30 yrs | Majority | IJ Y, Dems Y, NBCLC Y, LWV Y, Indivisible Y, GOP N |
| DD | Sleepy Hollow Fire Protection District | Paramedic tax renewal | 2/3 | NBCLC Y |
| EE | Stinson Beach County Water District | Appropriations limit | Majority | — |
| FF | Upper Bay Permanent Road Division | Road improvement and maintenance tax | 2/3 | — |

**12 of 20 measures have a guide position.** Novato and Tiburon have no measures. Belvedere has no measure.

### Totals

3 new district contests (CD2, SD2, AD12) plus 2 widened (BOE 2, Court of Appeal 1). 40 local candidate contests (34 contested) and 20 local measures. If the San Mateo rule is kept (add a local race only when a guide covers it), that is **29 candidate contests and 12 measures**.

---

## 3. Proposed area structure (not implemented)

One county page, modeled on `san-mateo`:

```yaml
  - id: marin
    name: Marin County
    shortName: Marin
    kind: county
    jurisdictions:
      - { level: state, name: California }
      - { level: county, name: Marin }
      - { level: city, name: Belvedere }
      - { level: city, name: Corte Madera }
      - { level: city, name: Fairfax }
      - { level: city, name: Larkspur }
      - { level: city, name: Mill Valley }
      - { level: city, name: Novato }
      - { level: city, name: Ross }
      - { level: city, name: San Anselmo }
      - { level: city, name: San Rafael }
      - { level: city, name: Sausalito }
      - { level: city, name: Tiburon }
```

**No city pages.** San Rafael is the only plausible candidate (largest city), but it has just two council seats, one of them uncontested, and one measure (W). Every guide covering it is a countywide guide. A San Rafael page would add little over the county page, unlike Palo Alto and Mountain View, which have their own local guides.

Contest ids, following the Peninsula convention: `us-rep-2`, `state-senate-2`, `assembly-12`, `marin-county-board-of-education-3`, `marin-county-measure-p`, `san-rafael-council-3`, `san-rafael-measure-w`, `sausalito-measure-x`, `tamalpais-uhsd-trustee`, `miller-creek-sd-measure-n`, `marin-healthcare-district-1`, `marin-healthcare-measure-cc`, and so on. Special districts and school districts use `level: district` with `within: [{ level: county, name: Marin }]`. The cross-county contests (Sonoma BOE TA2, Petaluma JUHSD TA3, SRJC Measure AB) would be `within` Marin only, since there is no Sonoma area.

### Guides to widen to `marin`

| Guide | Change |
|---|---|
| sierra-club-sf-bay | Add `marin`. Same source. Watch the stale BOS D1 line |
| yimby-action | Add `marin`; add the three marinyimby.org subpages as `extraSources` for reasons (as Peninsula for Everyone is for SMC) |
| courage-california | Add `marin`; add `.../county/marin` as an `extraSource` |
| ca-wfp | Add `marin` |
| seiu-1021 | Add `marin` |
| bay-rising-action | Add `marin` |
| greenbelt-alliance | Add `marin` |
| lwv-ca | Add `marin` (statewide props, as done for the Peninsula) |

Not widened, following the Peninsula precedent for statewide-only guides: spur (RTM and props only, and Marin has no RTM), sf-chronicle. mercury-news has statewide Bay Area News Group picks, and the IJ reprints the same editorials (Ma, Allen), so widening it would double-count one editorial board in Marin.

---

## 4. Gotchas

- **Measure letters collide across counties.** Marin has P, W, X, CC, N and O. SMC has Menlo Park P, East Palo Alto O and CC, SMFCSD W, Brisbane X; SF has Prop C and others; Alameda/Contra Costa will add more. Multi-county guides use bare letters (SEIU: "Measure P - Vote YES" under a "Marin County" heading; YIMBY: "Measure P, Menlo Park Downtown Parking Lots" next to "Measure X, Sausalito"). Contest ids must carry the jurisdiction, and extraction prompts must not alias bare letters.
- **The IJ reprints Bay Area News Group statewide editorials** ("Written by the Bay Area News Group editorial board"). The Oct 4 Ben Allen piece has a `-2` slug: it is a reprint of a May primary editorial.
- **The IJ's slug says "cox-huffman"**; the text and the candidate are Jill **Hoffman**. The IJ also spells Margulies "Marguiles" once.
- **Name variants to alias:** Joy Scully Koo (roster) = "Joy Koo" (Dems). Nastassya Saad (roster) = "Natassya Saad" (Dems). Leshawn Holcomb = "LeShawn". Cristine Soto Deberry = "Cristine Soto DeBerry". Will Dittmar = "William Dittmar" (NBCLC). Clayton Hess = "Dr. Clay Hess" (GOP). Abbey Picus = "Abby Picus" (older Sierra pages). Dan Christian = "Daniel Christian" (IJ).
- **Label variants:** Dems call the County Board of Education "Marin County Office of Education - Area 5" and Tiburon a "City Council". NBCLC calls Corte Madera "City Council" in two lines and "Town Council" in one.
- **Stale items:** Sierra Club lists Board of Supervisors D1 (Sackett), decided in June. Greenbelt lists June Measure B (SMART). NBCLC lists College of Marin (Treanor), which is not on the ballot. LWV Marin's page says "Read about Measure K" under Measure N.
- **Marin GOP candidates are PNG-only**, like smc-dems and svgop: mark `manual: true` or hand-enter. Its measure positions are HTML. Its treasurer, Francis Drouillard, is also its Novato USD TA4 pick.
- **AD12 is Democrat vs Democrat.** The Dems and the county party-endorsement page take no AD12 position. Guides split: IJ and YIMBY for Lucan; NBCLC, Sierra, SEIU, WFP, Courage and Indivisible for Elward.
- **The county site needs a browser.** `marincounty.gov` returns 403 to curl and on GitHub runners it will likely do the same. Only ballot data comes from there, not guides, so refresh is unaffected.
- **Uncontested races listed as ON the ballot.** Belvedere, Mill Valley, San Rafael D2, the Fairfax treasurer and the San Anselmo clerk and treasurer appear on the county's ON list with as many candidates as seats. Whether they print on the ballot is unverified (see below).
- **Marin YIMBY's `/endorsements/` index renders client-side**; its three category subpages are server-rendered and fetch fine.

## 5. Unverified, and decisions for Sean

Unverified:
- Whether the six uncontested races in the ON list actually print on Marin ballots. A sample ballot would settle it; the county's sample-ballot lookup was not tried.
- Why the county notice calls AD12 "short-term".
- Point Reyes Light, The Ark and Pacific Sun may still publish. Marin Post is unreachable. No Council of Democratic Clubs site was found.
- NBCLC's linked statewide list (props) was not read.
- The Marin Dems' measure pages were read for P, N, W and CC; all say Yes.

Decisions:
1. **Which local contests to add.** All 40 candidate contests and 20 measures, or only the 29 and 12 that some guide covers (the San Mateo rule)?
2. **Cross-county contests** (Sonoma BOE TA2, Petaluma JUHSD TA3, SRJC Measure AB). They reach only a few Marin precincts. Only SEIU (Sonoma BOE) takes a position.
3. **Indivisible Marin** as a guide. It is a local chapter of a national advocacy group with a substantive, reasoned PDF. The repo has no Indivisible guide yet.
4. **mercury-news vs marin-ij** for statewide picks (see section 3).
5. **Coordination with the Contra Costa and Alameda passes.** sierra-club-sf-bay, yimby-action, ca-wfp, seiu-1021, bay-rising-action, greenbelt-alliance, courage-california and lwv-ca will likely be widened by all three branches. Expect conflicts on each guide's `areas:` line, and widen each guide once with one `extract --force-extract` (see the runbook note on reviewing quote diffs).

---

## Decisions (2026-10-07)

These supersede the proposals above where they differ. Implementation waits until the ballot split has merged.

### Guides

- **Inclusion rule:** any guide whose endorsements are clearly for Nov 3, 2026 is in, however few contests it covers.
- **New Marin guides (5):**

| id | Type | Source | Notes |
|---|---|---|---|
| marin-dems | party | https://marindemocrats.org/2026-november-election-endorsements/ | extraSources: `/measure-n-miller-creek-school-district/`, `/measure-p/`, `/measure-w-san-rafael-services/`, `/measure-cc-critical-care-for-marin/` (all on marindemocrats.org) |
| marin-gop | party | https://maringop.org/2026/09/15/marin-gop-endorses/ | `manual: true`. Candidate picks are entered by hand from the two PNG cards; measure positions come from https://maringop.org/elections/endorsements/ |
| nbclc | union | https://www.nbclc.org/2026endorsements | Skip the College of Marin pick (no contest) |
| lwv-marin | civic | https://www.marinlwv.org/local-ballot-measure-recommendations | Measures only |
| indivisible-marin | advocacy | https://indivisiblemarin.org/s/IndiMarin-Voting-Guide-for-California-2026-Midterms.pdf | PDF with a text layer. The repo has no closer type than advocacy |

- **Marin IJ is not a separate guide.** It folds into `mercury-news`, which becomes one Bay Area News Group guide naming its papers (Mercury News, East Bay Times, Marin IJ). This supersedes the `marin-ij` proposal in sections 1 and 3 and decision 4 in section 5.

### Shared guides: what each needs for Marin

The team lead widens these once for all three counties. This branch does not edit them.

| Guide | Add to `areas` | New `extraSources` | Notes |
|---|---|---|---|
| mercury-news | marin | The 15 IJ local and district editorials below | Leave out the IJ's Ma (9/28) and Allen (10/4) URLs: they are reprints of BANG statewide editorials the guide already has |
| sierra-club-sf-bay | marin | none (same page covers Marin) | The page lists "Board of supervisors D1: Mary Sackett", which was decided in June; there is no contest for it |
| yimby-action | marin | https://marinyimby.org/endorsements/endorsements/ca-state-assembly/ , https://marinyimby.org/endorsements/endorsements/statewide-offices/ , https://marinyimby.org/endorsements/endorsements/local-ballot-measures/ | Reasons for AD12, Ma, Allen, props 1, 37, 43 and Sausalito X. Local council picks come from the national page |
| courage-california | marin | https://www.progressivevotersguide.com/california/2026/general/county/marin | No local races |
| ca-wfp | marin | none | Marin picks: SD2, AD12, Larkspur Burnett |
| seiu-1021 | marin | none | Marin picks: Novato D2/D4, Marin P, San Rafael W, Sonoma BOE TA2 |
| bay-rising-action | marin | none | Marin pick: P |
| greenbelt-alliance | marin | none | Marin pick: Sausalito X. Ignore the June Measure B item |
| lwv-ca | marin | none | Manual; props only |

IJ editorials to add to mercury-news:
- https://www.marinij.com/2026/08/31/editorial-ij-recommends-connolly-in-race-for-state-senate-seat/
- https://www.marinij.com/2026/09/02/editorial-huffman-has-earned-chance-to-represent-expanded-district-in-congress/
- https://www.marinij.com/2026/09/05/editorial-in-close-race-lucans-experience-makes-him-choice-for-assembly/
- https://www.marinij.com/2026/09/06/editorial-novato-should-reelect-picus-to-school-board/
- https://www.marinij.com/2026/09/09/editorial-davidi-gets-nod-in-tight-race-for-district-3-seat-on-san-rafael-council/
- https://www.marinij.com/2026/09/13/editorial-ij-recommends-farac-christian-in-novato-council-races/
- https://www.marinij.com/2026/09/16/editorial-andre-friedel-margulies-best-for-larkspur/
- https://www.marinij.com/2026/09/20/editorial-in-tight-race-ij-picks-burdo-dittmar-for-san-anselmo-council/
- https://www.marinij.com/2026/09/23/endorsement-ryan-hornbrook-defever-best-for-tiburon-council/
- https://www.marinij.com/2026/09/24/endorsement-cox-huffman-get-nod-over-strong-challengers-in-sausalito/
- https://www.marinij.com/2026/09/26/endorsement-marin-childcare-tax-measure-p-deserves-support/
- https://www.marinij.com/2026/09/27/endorsement-ij-recommends-herbst-mcmillan-for-ross-council-seats/
- https://www.marinij.com/2026/09/30/endorsement-sausalitos-marinship-needs-measure-x-to-take-a-step-forward/
- https://www.marinij.com/2026/10/03/endorsement-pass-measure-cc-hospital-tax-elect-su-hess-to-healthcare-board/
- https://www.marinij.com/2026/10/05/editorial-ij-recommends-no-vote-on-san-rafael-measure-w/

The IJ is still publishing; new editorials need adding as they appear.

### Contests

San Mateo rule: a local race or measure is added only where a guide takes a position. Cross-county contests follow the same rule, with `within` including Marin. That gives 3 new district contests, 2 widened, 29 candidate contests and 12 measures. Petaluma JUHSD TA3 and SRJC Measure AB have no guide position and are left out; Sonoma BOE TA2 (SEIU) is in.

District: `us-rep-2`, `state-senate-2`, `assembly-12` (new, within Marin); add Marin to `within` on `board-of-equalization-2` and `court-of-appeal-1`. Do not add Marin to `rtm`.

Proposed local ids (area-prefixed, following the existing `san-mateo-county-*`, `<city>-council-<n>`, `<city>-measure-<x>` and `<district>-trustee` patterns):

| Kind | ids |
|---|---|
| County board of education | `marin-county-board-of-education-3`, `-5`, `-6` |
| Cross-county | `sonoma-county-board-of-education-2` |
| School | `tamalpais-uhsd-trustee`, `miller-creek-sd-trustee`, `novato-usd-trustee-area-4`, `reed-usd-trustee`, `sausalito-marin-city-sd-trustee` |
| City/town | `corte-madera-council`, `fairfax-council`, `fairfax-clerk`, `larkspur-council`, `mill-valley-council`, `novato-council-2`, `novato-council-4`, `ross-council`, `san-anselmo-council`, `san-rafael-council-2`, `san-rafael-council-3`, `sausalito-council`, `tiburon-council` |
| Special district | `marin-city-csd-director`, `marin-city-csd-director-short-term`, `southern-marin-fire-director`, `marin-healthcare-district-1`, `marin-healthcare-district-3`, `richardson-bay-sanitary-director`, `north-marin-water-district-5` |
| Measures | `miller-creek-sd-measure-n`, `marin-county-measure-p`, `fairfax-measure-r`, `larkspur-measure-s`, `ross-measure-u`, `san-anselmo-measure-v`, `san-rafael-measure-w`, `sausalito-measure-x`, `marin-csa-27-measure-y`, `kentfield-fire-measure-bb`, `marin-healthcare-measure-cc`, `sleepy-hollow-fire-measure-dd` |

Every Marin measure id carries its jurisdiction, so none can collide with `menlo-park-measure-p`, `east-palo-alto-measure-cc`, `smfcsd-measure-w`, `brisbane-measure-x` or the East Bay letters.

### Name aliases found

| Roster name (canonical) | Variant | Seen in |
|---|---|---|
| Joy Scully Koo | Joy Koo | marin-dems |
| Nastassya Saad | Natassya Saad | marin-dems |
| Leshawn Holcomb | LeShawn Holcomb | marin-dems |
| Cristine Soto Deberry | Cristine Soto DeBerry | marin-dems |
| Will Dittmar | William Dittmar | nbclc |
| Clayton Hess | Dr. Clay Hess | marin-gop |
| Dan Christian | Daniel Christian | IJ |
| Sarah Margulies | Sarah Marguiles | IJ (one misspelling) |
| Jill James Hoffman | "Huffman" (URL slug only) | IJ |
| Abbey Picus | Abby Picus | older Sierra Club Marin pages |
| Gabriella "Gabby" Solar, Elizabeth "Beth" Sutro | Gabby Solar, Beth Sutro | county roster nicknames |
| Marilyn Nemzer, Curtis F. Robinson | "Marin County Office of Education - Area 5/6" | marin-dems (contest label, not a name) |
