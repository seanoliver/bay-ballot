# Bay Ballot Solano discovery: Solano County (Nov 3, 2026)

Researched 2026-10-09. It follows the structure of `2026-10-07-marin-guide-discovery.md`. This pass is research only. Nothing has been extracted, and the area files, `ballot.yml`, the county ballot files and the guide files are unchanged.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-09 and saw Nov 2026 picks.
- **Not published**: the page loads but has no Nov 2026 picks, or it is stale.
- **Unverified**: I could not confirm it. The reason is given in each case.

**Access notes**
- `solanocounty.gov` and `content.solanocounty.gov` (registrar pages and PDFs) return full pages to curl with a browser user agent. No bot wall. This is unlike Marin's county site.
- `sierraclub.org` answers curl with a 302 and an empty body (Incapsula). It loads in a browser (Playwright). The existing Sierra Club guide already uses `fetchWith: browser`.
- `beniciaheraldonline.com` returns **HTTP 500** to curl. `beniciaherald.com` does not resolve.
- `unionhall.aflcio.org/nsclc` is the Napa-Solano labor council's old site. Its newest endorsement post is "March 2020 Endorsements". The live site is `napasolanoclc.org`.
- `vallejochamber.com` returns a 1 KB page to curl (a script shell). I did not try it in a browser.
- `sites.google.com/view/northernsolanodems` (Northern Solano Democratic Club) serves its endorsements as image cards only. The text layer has no candidate names.
- `timesheraldonline.com`, `thereporter.com` and `dailyrepublic.com` serve full article text to curl.

---

## 1. Guide table

Abbreviations: E, H, O, P, Q, U, V, X, Y, Z and B are the Solano measure letters (section 2). "Reasons" means the guide explains each pick. "List" means it gives picks only. Proposed ids are suggestions.

### Newspapers

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Vallejo Times-Herald (Bay Area News Group) | newspaper | Editorials index https://www.timesheraldonline.com/opinion/editorials/ ; endorsements tag https://www.timesheraldonline.com/opinion/endorsements/ | **Not published.** The editorials index shows nothing newer than 2025-09-20. The endorsements tag has no 2026 items. A site search for "endorsement" (https://www.timesheraldonline.com/?s=endorsement) returns only news stories about other groups' endorsements | n/a | HTML | None | n/a |
| The Reporter, Vacaville (Bay Area News Group) | newspaper | https://www.thereporter.com/opinion/editorials/ ; https://www.thereporter.com/opinion/endorsements/ | **Not published.** Same pattern as the Times-Herald. The endorsements tag holds one 2024 Santa Clara editorial and no Solano items | n/a | HTML | None | n/a |
| Daily Republic, Fairfield | newspaper | "Our View" index https://www.dailyrepublic.com/opinion/our-view/ | **Not published.** The newest "Our View" item is timestamped 2023-07-17, and the "Daily Republic endorsements recap" is dated 2018-11-06. The opinion page carries only reader letters about 2026 races (for example "A vote for Mike Silva", "Support for Robert Marin") | n/a | HTML | None | n/a |
| Benicia Herald | newspaper | https://beniciaheraldonline.com/ | **Unverified**: HTTP 500 | n/a | n/a | 500 | n/a |
| Vallejo Sun | newspaper (nonprofit) | https://www.vallejosun.com/ | **None found.** It reports on races but a site search for "endorse" found no endorsement editorials | n/a | HTML | None | n/a |
| Mercury News / BANG statewide editorials (already a guide, `mercury-news`) | newspaper | https://www.mercurynews.com/opinion/endorsements/ | Statewide picks only. The Fiona Ma and Ben Allen editorial slugs from mercurynews.com return **404** on timesheraldonline.com and thereporter.com, so the Solano papers do not appear to reprint them under the same URLs | n/a | HTML | None | No Solano local picks. The stored `data/2026-11/pages/mercury-news/` text has no Solano, Vallejo, Vacaville, Fairfield or Benicia mention |

### Parties

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Solano County Democratic Central Committee (`solano-dems`) | party | https://www.solanodemocrats.com/endorsements | **Verified** | List (one graphic card per candidate; videos of candidate discussions) | HTML (NationBuilder), names in text | None | BOS D4 Silva; County BOE "Area 4" Kedarisetty (she runs in **TA6**; see gotchas); Solano CC TA4 Yang; Benicia USD TA1 Dan Smith; Dixon USD Cuevas, Fink; Vallejo USD TA1 Lerner; Benicia council Birdseye, Scott; Dixon D2 Cerna; Fairfield D1 K Patrice Williams, D3 Carr, D5 Panduro; Suisun mayor Hernandez; Suisun council Washington, Dawson; Vacaville mayor Chapman, D4 Finley, D6 Wylie; Vallejo D4 Rogers, D5 Truemper. Measures: **Yes E, H, U, V, X, Y, Z** (Y and Z labels swapped, see gotchas). No Fairfield mayor pick, no P, O, Q or B. No federal or state picks on the page. It also lists June picks (BOS D3 Wanda Williams, Superintendent Nikki Parr) under "Already Decided" |
| Solano County Republican Central Committee (`solano-gop`) | party | https://solanorepublicanparty.com/ (homepage section "SCRCC 2026 Voter Guide") | **Verified** | List | HTML (GoDaddy site), names in text under photos | None | Two tiers. **Endorsed**: SPI Shaw ("Sonya"), SoS Wagner, CD8 Recile, Benicia council Zollars, Vacaville D4 Vogel, D2 Chalk, Fairfield D3 Robert Marin, AG Gates, Suisun mayor Michael Jefferson, Dixon council Thom Bogue. **Recommended**: Governor Hilton, Lt Gov Romero, Treasurer Hawks, BOE "State Board of Equalization" Grove, AD11 Callison ("Jenny Callion"), BOS D4 Carli, Vacaville mayor Stockton, Suisun council Katrina Garcia, Rio Vista council Butler, Dolk, Dixon USD Ceremello, Lockwood. Props: Yes 39, 41, 42, 43; No 1 to 5, 37, 38, 40, 44, 45. No local measures |
| County Voter Information Guide, party endorsements | (reference, not a guide) | e.g. https://content.solanocounty.gov/sites/default/files/2026-08/SOLA11031001_-_VIG_1_ES.pdf (page "Party Endorsements") | Yes | n/a | PDF | None | Democratic: statewide offices, BOE 1 Esparza, CD8 Garamendi, AD11 Wilson. Republican: statewide, BOE 1 Grove, CD8 Recile, AD11 "N/A". American Independent and others also listed |

### Democratic and other clubs

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Northern Solano Democratic Club (`northern-solano-dems`) | club | https://sites.google.com/view/northernsolanodems/campaign-organizing-workgroup | **Verified** (read from the image cards in a browser screenshot) | List, plus three "Spotlight" cards with priorities (Cuevas, K Patrice Williams, Wylie) | **Images only** (Google Sites) | None, but no text layer | BOS D4 Silva; Vacaville mayor Chapman, D4 Finley, D6 Wylie; Dixon USD Cuevas, Fink; Solano County BOE TA6 Kedarisetty; Dixon D2 Cerna; Solano CC Yang; **Fairfield mayor Nikila Walker Gibson**; Fairfield D1 K Patrice Williams, D3 Carr, D5 Panduro; Suisun mayor Hernandez; Suisun council Dawson, Washington. Three cards are stamped "ELECTED!": Wanda Williams (June), Nancy Dunn (Vacaville USD, off the ballot), Kai Eusebio (Fairfield-Suisun USD, off the ballot) |
| United Democrats of Southern Solano County | club | No site found. Search finds only a 2023 Cabaldon campaign post (https://cabaldonforsenate.com/2023/11/30/largest-vallejo-based-democratic-club-has-endorsed-our-campaign/) | **Unverified** | n/a | n/a | n/a | Vallejo, if it publishes |
| Benicia, Vacaville, Vallejo Democratic clubs; Indivisible chapters; Solano Young Democrats | club | No 2026 pages found by search | **Unverified / none found** | n/a | n/a | n/a | n/a |

### Labor

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Napa Solano Central Labor Council (`napa-solano-labor`) | union | https://napasolanoclc.org/elections/ ("Endorsements – General Election 2026") | **Verified** | List | HTML (WordPress) | None | CD8 Garamendi; AD11 Wilson (also CD4 Thompson and AD4 Aguiar-Curry, which are not on Solano ballots); BOS D4 Silva; "Solano County Office of Education, Area 6" Kedarisetty; Solano CC TA4 Yang; Benicia council Scott (only); Dixon D1 Schroeder, D2 Cerna; Dixon USD Cuevas; Fairfield mayor **Tonnesen** ("Tonneson"); Fairfield D1 Williams, D3 Carr, D5 Panduro; Suisun mayor Hernandez; Suisun council Dawson, Washington; Vacaville mayor Chapman, D6 Wylie ("Wyle"); Vallejo D2 Matulac, D4 Rogers, D5 Truemper; Vallejo USD Area 1 Lerner, Area 3 Reynolds (listed under the Napa heading). Measures listed without a verdict word: "Solano County – Measures E and H", "Benicia – Measures X, Y, Z", "Fairfield – Measure P". Also Napa County picks |
| SEIU 1021 (already a guide, `seiu-1021`) | union | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 | **Verified** (stored page text, `data/2026-11/pages/seiu-1021/`) | List | HTML | None | "SOLANO COUNTY" section: BOS D4 Silva; Fairfield mayor Tonnesen ("Tonneson"), D1 Williams, D3 Carr, D5 Panduro; Suisun mayor Hernandez, council Dawson, Washington; Vallejo D4 Rogers, D5 Truemper; **Yes Fairfield P**. Statewide: BOE 1 Esparza. AD11 Wilson is already in its data |
| IFPTE Local 21 (already a guide, `ifpte-21`) | union | https://ifpte21.org/endorsements/ | **Verified** (stored page text) | List | HTML | None | "Solano County Board of Supervisors: Michael Silva, District 4" |
| Napa/Solano Building Trades Council | union | Only a 2024 list was found (https://www.dc16iupat.org/voting-makes-a-difference/, per search) | **Unverified**: no 2026 list found | n/a | n/a | n/a | n/a |
| Teamsters, Solano County public-sector unions | union | None found | **Unverified** | n/a | n/a | n/a | n/a |

### Advocacy

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Sierra Club Redwood Chapter (`sierra-club-redwood`) | advocacy | https://www.sierraclub.org/redwood/endorsements | **Verified** (browser) | List | HTML | **Incapsula** (browser OK) | CD8 Garamendi (also CD1, CD2, CD4); statewide offices; props (Support 1, 4, 5; Oppose 39, 43, 45); BOS D4 Silva; Benicia council Birdseye, Scott; Rio Vista Dolk; Suisun council Washington, Garcia; Vacaville mayor Chapman, D6 Wylie; Vallejo D2 Matulac, D4 **Palmares**, D5 Truemper. Also Napa County Measure B and **Sonoma County Measure H** (see gotchas). No Solano measures |
| Sierra Club SF Bay Chapter (already a guide) | advocacy | https://www.sierraclub.org/sfbay/2026-endorsements | Loaded in a browser: **no Solano content** | n/a | HTML | Incapsula | Solano is in the Redwood Chapter, not this one |
| Solano Orderly Growth Committee (`solano-orderly-growth`) | advocacy | Own site **not found**. Only source: The Reporter, 9/16 (https://www.thereporter.com/2026/09/16/solano-orderly-growth-endorses-candidates-in-local-races/) | **Verified as reported** (news article, not the group's own page) | Yes (the article gives a reason per pick) | HTML (news) | None | BOS D4 Silva; Vacaville mayor Chapman, D6 Wylie (no pick in D2 or D4); Fairfield mayor Walker-Gibson; Suisun council Washington, Garcia; Dixon D1 Schroeder, D2 Cerna; Rio Vista Dolk; Vallejo D2 Matulac ("Mtulac"), D4 Palmares, D5 Truemper; Benicia Birdseye, Scott |
| Reform California (Carl DeMaio) (`reform-california`) | advocacy | https://www.reformcalifornia.org/voter-guides/solano | **Verified** | Reasons for props only; candidates are list | HTML | None | Statewide offices (Insurance Commissioner "You are Doomed"); BOE 1 Grove; Supreme Court and 1st District retentions (19 justices listed, see gotchas); CD8 Recile; AD11 "Jenny Callison"; Benicia Zollars; Dixon council Bogue; Fairfield mayor "No Endorsement", council "Bob Marin"; Rio Vista Dolk, Butler; Suisun mayor Jefferson, council Garcia; Vacaville mayor Stockton, D2 Chalk, D4 Vogel; Dixon USD Lockwood; "Solano Community College District Trustee Area 6: Amber Cargo-Reed" (**off the ballot**). Props with reasons. It also lists CD4, CD7, AD4 and AD7, which are not on Solano ballots |
| Courage California (already a guide) | advocacy | https://www.progressivevotersguide.com/california/2026/general/county/solano | **Verified** | Yes | HTML | None | CD8 Garamendi, AD11 Wilson, BOE 1 Esparza, props. **No local races** |
| California Working Families Party (already a guide, `ca-wfp`) | party (minor) | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf | **Verified** (stored page text) | List | PDF | None | Bay Area page: "BRIANNA ROGERS" opposite "VALLEJO CITY COUNCIL" (the PDF pairs three names with three offices in order; no district number). Nothing else in Solano |
| East Bay DSA (already a guide, `east-bay-dsa`) | advocacy | https://vote.eastbaydsa.org/simple-guide.html | **Verified** (stored page text) | Yes | HTML | None | Solano measures: **Yes E, H, B, X, Y, Z**; "no recommendation" on O, P, Q, U, V. BOE 1: "California DSA takes no position". It also covers Napa Measure B. No Solano candidates |
| Planned Parenthood Northern California Action Fund (already a guide, `pp-norcal-action`) | advocacy | https://www.plannedparenthoodaction.org/planned-parenthood-northern-california-action-fund/endorsements | **Verified** (stored page text) | List | HTML | None | "Solano County" section: BOS D4 Silva; Vallejo D2 Matulac, D4 Rogers, D5 Truemper. AD11 Wilson is already in its data |
| Equality California (already a guide, `eqca`) | advocacy | https://www.eqca.org/our-endorsements/ | **Verified** (stored page text) | List | HTML | `fetchFrom: local` | CD8 Garamendi, AD11 Wilson, **BOE 1 Esparza**, **Vallejo D5 Tara Beasley-Stansberry** |
| Bay Area Reporter (already a guide, `bay-area-reporter`) | newspaper | https://www.ebar.com/story/170347/Opinion/Editorial/Editorial%3A%20B.A.R.%20endorses%20city%20council%20candidates | **Verified** (stored page text) | Yes | HTML | browser (existing `fetchWith`) | **Vallejo D5 Beasley-Stansberry** ("recommend her for election in District 5") |
| 350 Bay Area Action, California Environmental Voters, East Bay Young Dems, Housing Action Coalition, YIMBY Action, Contra Costa Dems, El Cerrito Dems (already guides) | various | Their existing source pages | Picks for CD8 and/or AD11 only (already in their data via Contra Costa) | n/a | n/a | n/a | No Solano local picks. I loaded yimbyaction.org, 350bayareaaction.org, envirovoters.org and ebyd.org live on 2026-10-09: zero lines naming a Solano city or county |
| Bay Rising Action, Greenbelt Alliance, UNITE HERE Local 2 (already guides) | advocacy / union | Their existing source pages | Loaded live (Greenbelt in a browser): **no Solano content** | n/a | n/a | n/a | n/a |

### Business

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Vacaville Chamber of Commerce (`vacaville-chamber`) | business (no such type in the repo; see decisions) | Own page **not found** (https://www.vacavillechamber.com/ has no "endorse" text). Reported by the Times-Herald/Reporter, 9/17: https://www.timesheraldonline.com/2026/09/17/vacaville-chamber-announces-endorsements-for-mayor-and-council-seats/ | **Verified as reported** | Short shared rationale | HTML (news) | None | Vacaville mayor Stockton; D2 Chalk; D4 Vogel; D6 Wylie |
| Vallejo Chamber of Commerce PAC, ValPAC (`vallejo-chamber`) | business | Own page **not checked** (`vallejochamber.com` returns a 1 KB script shell to curl). Reported by the Times-Herald, 10/3: https://www.timesheraldonline.com/2026/10/03/vallejo-chamber-of-commerce-committee-announces-endorsements-for-election/ | **Verified as reported** | No | HTML (news) | None | Vallejo D2 Matulac ("Matulace"), D4 Palmares, D5 Truemper; Vallejo USD "District 1" Lerner, "District 3" Reynolds |
| Fairfield-Suisun Chamber, Benicia Chamber | business | `ffscc.com` does not resolve; https://www.beniciachamber.com/ has no "endorse" text | **None found** | n/a | n/a | n/a | n/a |

### Civic (Leagues don't endorse candidates)

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| League of Women Voters of Solano County | civic | https://my.lwv.org/california/solano-county | **Not published.** The site lists candidate forums (Benicia council, 9/30) and a "Pondering Propositions" pros-and-cons forum (https://my.lwv.org/california/solano-county/article/pondering-propositions), but no measure recommendations | n/a | HTML | None | n/a |
| LWV California (already a guide) | civic | https://lwvc.org/ballot-recommendations/ | Yes | Yes | HTML (`manual: true`) | n/a | Props |

### Counts

Guides with any Nov 2026 Solano pick, local or district (statewide-only guides excluded):
- **Published, new:** 6 with their own pages: solano-dems, solano-gop, northern-solano-dems, napa-solano-labor, sierra-club-redwood and reform-california. Plus 3 known only from news articles: solano-orderly-growth, vacaville-chamber and vallejo-chamber (9 if those count; see decisions).
- **Published, existing and should be widened:** 8 with Solano local or BOE 1 picks: seiu-1021, pp-norcal-action, ifpte-21, eqca, bay-area-reporter, ca-wfp, east-bay-dsa, courage-california.
- **District picks only (CD8/AD11), widen optional:** 350-bay-area-action, envirovoters, housing-action-coalition, yimby-action. Not widened: contra-costa-dems and el-cerrito-dems (Contra Costa clubs).
- **Statewide only, widen by precedent:** lwv-ca.
- **Not published or not found:** Times-Herald, The Reporter, Daily Republic, Vallejo Sun, LWV Solano, United Democrats of Southern Solano and other clubs, Building Trades, Fairfield-Suisun and Benicia chambers. Benicia Herald is unreachable (500).

---

## 2. Ballot contests

### Sources

- Notice of Election (dated 7/8/2026), offices on the ballot: https://www.solanocounty.gov/2026-november-general-election-notice-election
- Notice of Extensions (8/7/2026): https://www.solanocounty.gov/notice-extensions-offices-november-3-2026-ballot
- Candidate Filed Log, "AS OF 8/20/2026", printed 8/27/2026, marks each contest **ON THE BALLOT** or **OFF THE BALLOT** (the file name says 7.13.26 but the content is the 8/20 version): https://content.solanocounty.gov/sites/default/files/2026-07/CANDIDATE_FILED_LOG_Nov_3_2026_7.13.26.pdf
- Notice of Measures (8/5/2026): https://content.solanocounty.gov/sites/default/files/2026-08/Notice_of_Measures.pdf
- Correction for Benicia X, Y, Z (8/10/2026): https://content.solanocounty.gov/sites/default/files/2026-08/Corrected_Notice_of_Measures_Benicia_XYZ.pdf
- County Voter Information Guides, one PDF per ballot type, `SOLA1103100N_-_VIG_N_ES.pdf` for N = 1 to 48 (VIG 33 is not linked), listed at https://www.solanocounty.gov/government/registrar-voters/current-election-information . They contain candidate statements and measure texts but not the printed ballot page.
- SoS Certified List of Candidates (8/27/2026), already in `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`.

Machine-readability: everything is HTML or text-layer PDF and fetches with curl. The county also runs an Omniballot lookup (https://ca.omniballot.us/sites/06095/default/app/home); I did not use it.

### State and federal districted contests

The Notice of Election lists exactly these. All 47 published VIGs carry CD8 and AD11 and no other Congress or Assembly district.

| Contest | Candidates (SoS) | In `ballot.yml`? | Proposed change |
|---|---|---|---|
| U.S. Representative, District 8 | John Garamendi (D), Rudy Recile (R) | Yes, `us-rep-8`, `within: Contra Costa` | Add `{ level: county, name: Solano }` to `within` |
| State Assembly, District 11 | Lori D Wilson (D), Jenny Leilani Callison (NPP) | Yes, `assembly-11`, `within: Contra Costa` | Add Solano to `within` |
| Board of Equalization, District 1 | Nelson Esparza (D), Shannon Grove (R) | **No** | New `board-of-equalization-1`, within Solano. Solano is in BOE **1**, not BOE 2 like every county so far. The Notice of Election says "1st Board of Equalization", and the VIG party table lists Esparza and Grove |
| 1st District Court of Appeal (11 retentions) | Same justices as the existing contest | Yes, `court-of-appeal-1` | Add Solano to `within`. The SoS list's First Appellate District county list includes Solano |
| State Senate | None | n/a | No State Senate contest. The Notice of Election lists none, and the SoS list has only even-numbered Senate districts this year |

Statewide offices, Supreme Court retention and Props 1 to 5 and 37 to 45 apply as is. **Solano is not in the Regional Transit Measure.** No VIG mentions it, and the measure notices do not list it. The `rtm` contest's `within` must not gain Solano.

### Local candidate contests on the ballot (27)

From the Candidate Filed Log (ON THE BALLOT). Names are as the log prints them; VIG statement spellings that differ are in gotchas. Coverage counts guides from section 1 with a pick in the contest. "(i)" marks an incumbent in the log.

| # | Contest | Seats | Candidates | Guides with picks |
|---|---|---|---|---|
| 1 | Board of Supervisors, District 4 | 1 | Michael "Mike" Silva, John Carli | Silva: Dems, NSDC, NSCLC, SEIU, IFPTE, PP, Sierra Redwood, Orderly Growth. Carli: GOP (recommended) |
| 2 | Solano County Board of Education, TA6 | 1 | Tamika Hamilton, Kathryn Kedarisetty | Kedarisetty: Dems, NSDC, NSCLC |
| 3 | Solano Community College, TA4 | 1 | Denis Honeychurch (i), Tony Yang | Yang: Dems, NSDC, NSCLC |
| 4 | San Joaquin Delta Community College, TA4 (cross-county, filed in San Joaquin) | 1 | Charles R. Jennings (i), Tony Shah | n/a |
| 5 | Benicia USD, TA1 | 1 | Dan Smith, Barbara Jones | Smith: Dems |
| 6 | Dixon USD (at large) | 3 | Jewel Fink (i), Julian Y. Cuevas (i), John Gabby (i), Phil Lockwood, Michael Ceremello Jr., Cheryl Sommers, Michael Monson | Dems, NSDC: Cuevas, Fink. NSCLC: Cuevas. GOP (recommended): Ceremello, Lockwood. Reform: Lockwood |
| 7 | River Delta USD, TA1 | 1 | Dan Mahoney (i), Michael A Mimiaga | n/a |
| 8 | Vallejo City USD, TA1 | 1 | Clarence John Martin Jr, Judith Lerner, Reba Jill Brown | Lerner: Dems, NSCLC, Vallejo Chamber |
| 9 | Vallejo City USD, TA3 | 1 | Rizal "Mr. Riz" V. Aliga, Irene Reynolds | Reynolds: NSCLC, Vallejo Chamber |
| 10 | Benicia City Council | 2 | Terry Scott (i), Kari Birdseye (i), Justin Zollars | Scott, Birdseye: Dems, Sierra Redwood, Orderly Growth. Scott only: NSCLC. Zollars: GOP, Reform |
| 11 | Dixon City Council, D1 | 1 | Jim Ernest (i), Emily Schroeder | Schroeder: NSCLC, Orderly Growth |
| 12 | Dixon City Council, D2 | 1 | Thom Bogue (i), Christina M. Cerna | Cerna: Dems, NSDC, NSCLC, Orderly Growth. Bogue: GOP, Reform |
| 13 | Dixon Elected City Clerk (uncontested) | 1 | Lupe Ruiz | n/a |
| 14 | Fairfield Mayor | 1 | Pam Bertani, Scott Tonnesen, Nikila Walker Gibson, George Kennedy | Tonnesen: SEIU, NSCLC. Walker Gibson: NSDC, Orderly Growth. Reform: "No Endorsement" |
| 15 | Fairfield City Council, D1 | 1 | K. Patrice Williams (i), Nora Dizon | Williams: Dems, NSDC, NSCLC, SEIU |
| 16 | Fairfield City Council, D3 | 1 | Doug Carr (i), Robert Marin, Susan Bush | Carr: Dems, NSDC, NSCLC, SEIU. Marin: GOP, Reform |
| 17 | Fairfield City Council, D5 | 1 | Doriss Panduro (i), Lynda Davis-Robinson | Panduro: Dems, NSDC, NSCLC, SEIU |
| 18 | Rio Vista City Council | 2 | Rick Dolk (i), Robert Butler, Gloria J. Thibeaux, Leslie Codling-Dichet | Dolk: Sierra Redwood, Orderly Growth, GOP (rec), Reform. Butler: GOP (rec), Reform |
| 19 | Suisun City Mayor | 1 | Alma Hernandez (i), Chauncey Banks, Michael Jefferson, Lilia Dardon, Amit Pal | Hernandez: Dems, NSDC, NSCLC, SEIU. Jefferson: GOP, Reform |
| 20 | Suisun City Council | 2 | Princess Washington (i), Jenalee Dawson (i), Xenia Tom, Katrina Garcia | Washington: Dems, NSDC, NSCLC, SEIU, Sierra Redwood, Orderly Growth. Dawson: Dems, NSDC, NSCLC, SEIU. Garcia: Sierra Redwood, Orderly Growth, GOP (rec), Reform |
| 21 | Vacaville Mayor | 1 | Sarah Chapman, Roy Stockton | Chapman: Dems, NSDC, NSCLC, Sierra Redwood, Orderly Growth. Stockton: Vacaville Chamber, GOP (rec), Reform |
| 22 | Vacaville City Council, D2 | 1 | Gregory Ritchie II (i), Tom Chalk | Chalk: Vacaville Chamber, GOP, Reform |
| 23 | Vacaville City Council, D4 | 1 | John Vogel, Davonna Finley | Finley: Dems, NSDC. Vogel: Vacaville Chamber, GOP, Reform |
| 24 | Vacaville City Council, D6 | 1 | Jeanette Wylie (i), Kevin Puett | Wylie: Dems, NSDC, NSCLC, Sierra Redwood, Orderly Growth, Vacaville Chamber |
| 25 | Vallejo City Council, D2 (uncontested) | 1 | Diosdado "JR" Matulac (i) | Matulac: NSCLC, PP, Sierra Redwood, Orderly Growth, Vallejo Chamber |
| 26 | Vallejo City Council, D4 | 1 | Charles Palmares (i), Brianna Rogers, Chris Platzer | Rogers: Dems, NSCLC, SEIU, PP, WFP. Palmares: Sierra Redwood, Orderly Growth, Vallejo Chamber |
| 27 | Vallejo City Council, D5 | 1 | Tara Beasley Stansberry, Tanya Hall, Rebekah Truemper | Truemper: Dems, NSCLC, SEIU, PP, Sierra Redwood, Orderly Growth, Vallejo Chamber. Beasley-Stansberry: EQCA, B.A.R. |

Breakdown: 1 supervisor, 1 county board of education, 2 college (1 cross-county), 5 school, 18 city (2 uncontested). **24 of 27 have at least one guide pick** (none for San Joaquin Delta TA4, River Delta USD TA1 or the Dixon clerk).

Not on the ballot per the log (OFF THE BALLOT, mostly one filer for one seat): Solano County BOE TA3 and TA4; Yolo County BOE TA2 and TA5; Solano CC TA1, TA2, TA6; Benicia USD TA4, TA5; Fairfield-Suisun USD TA4, TA5, TA7; River Delta USD TA3; Travis USD TA1, TA2; Vacaville USD TA1, TA3, TA5; Vallejo City USD TA5; Winters JUSD TA2, TA3; Cordelia Fire Protection District; Rural North Vacaville Water District; Solano Irrigation District Divisions 1 and 5. That is 25 contests. Board of Supervisors District 3 was decided in June (the Solano Dems list Wanda Williams under "Already Decided"). Picks for off-ballot seats seen in guides: Reform's Solano CC TA6 Cargo-Reed; NSDC's Dunn (Vacaville USD) and Eusebio (Fairfield-Suisun USD), both stamped "ELECTED!".

### Local measures (11)

| Letter | Jurisdiction | Short title (Notice of Measures / correction) | Vote | Guides with positions |
|---|---|---|---|---|
| B | Winters Joint USD (cross-county, filed in Yolo) | $29.9M school bond | 55% | DSA Y |
| E | County of Solano | Business license tax on energy facilities and data centers | Majority (general tax wording) | Dems Y, NSCLC (listed), DSA Y |
| H | County of Solano | Transient occupancy tax 5% to 12%, unincorporated area | Majority (general tax wording) | Dems Y, NSCLC (listed), DSA Y |
| O | City of Rio Vista | Extend 0.75% general services sales tax 3 years | Majority | DSA no recommendation |
| P | City of Fairfield | Extend sales tax and raise it by up to 1 cent | Majority | SEIU Y, NSCLC (listed), DSA no recommendation |
| Q | City of Fairfield | Appointive city clerk | Majority | DSA no recommendation |
| U | Dixon USD | $49M school bond | 55% | Dems Y, DSA no recommendation |
| V | City of Vacaville | Essential services measure, additional 1-cent sales tax | Majority | Dems Y, DSA no recommendation |
| X | City of Benicia | Business license tax modernization | Majority | Dems Y, NSCLC (listed), DSA Y |
| Y | City of Benicia | Limited city charter (lets Z take effect) | Majority | Dems Y (labeled as transfer tax), NSCLC (listed), DSA Y |
| Z | City of Benicia | Real property transfer tax | Majority | Dems Y (labeled as business license tax), NSCLC (listed), DSA Y |

Vote thresholds other than the two school bonds (stated as 55% in the VIG for U) are my reading of the ballot questions and are **unverified**; the impartial analyses linked from the registrar page state them.

**9 of 11 measures have a guide position** (none on O or Q beyond DSA's explicit "no recommendation"). Vallejo, Suisun City and Dixon (city) have no measures.

### Totals

2 widened district contests (CD8, AD11), 1 new (BOE 1), 1 widened retention (Court of Appeal 1). 27 local candidate contests (25 contested) and 11 local measures. Under the San Mateo rule (add a local race only when a guide covers it), that is **24 candidate contests and 9 measures** (counting DSA's B, E, H, X, Y, Z and others' P, U, V; O and Q have only "no recommendation").

---

## 3. Proposed area structure (not implemented)

One county page, modeled on `marin`:

```yaml
id: solano
name: Solano County
kind: county
order: 80
jurisdictions:
  - { level: state, name: California }
  - { level: county, name: Solano }
  - { level: city, name: Benicia }
  - { level: city, name: Dixon }
  - { level: city, name: Fairfield }
  - { level: city, name: Rio Vista }
  - { level: city, name: Suisun City }
  - { level: city, name: Vacaville }
  - { level: city, name: Vallejo }
```

Order 80 puts it after Marin (70), the current last area. The county ballot file would be `data/2026-11/ballot/solano.yml`. If the runbook's "county file name matches an area's county" rule keys on the county name, `solano.yml` matches `{ level: county, name: Solano }`.

**No city pages.** Vallejo is the largest city, but it has three council races (one uncontested), two school seats and no measure, and every Vallejo guide is countywide or regional. Vacaville is the strongest case: a contested mayor race, three council districts, Measure V and a city-specific guide (Vacaville Chamber). Even so, its guides are the same countywide set. A Vacaville page would add little over the county page. If Sean wants one city page, Vacaville is the candidate.

Contest ids, following the Marin and Peninsula conventions: `solano-county-supervisor-4`, `solano-county-board-of-education-6`, `solano-cc-trustee-area-4`, `benicia-usd-trustee-area-1`, `dixon-usd-trustee`, `vallejo-city-usd-trustee-area-1`, `-3`, `benicia-council`, `dixon-council-1`, `-2`, `fairfield-mayor`, `fairfield-council-1`, `-3`, `-5`, `rio-vista-council`, `suisun-city-mayor`, `suisun-city-council`, `vacaville-mayor`, `vacaville-council-2`, `-4`, `-6`, `vallejo-council-2`, `-4`, `-5`; measures `solano-county-measure-e`, `solano-county-measure-h`, `fairfield-measure-p`, `dixon-usd-measure-u`, `vacaville-measure-v`, `benicia-measure-x`, `benicia-measure-y`, `benicia-measure-z`, `winters-jusd-measure-b`. School and college districts use `level: district` with `within: [{ level: county, name: Solano }]`, as Marin does. With no city pages, listing the county in `within` is enough.

Which cities each district's ballot types reach, from the VIGs (useful if city pages are added later; tagging is by city candidate statements, so it is incomplete): BOS D4 = Dixon, Vacaville and unincorporated; County BOE TA6 = Dixon, Vacaville, unincorporated; Solano CC TA4 = Fairfield, Vacaville, unincorporated; San Joaquin Delta TA4 and River Delta USD TA1 = Rio Vista and unincorporated; Dixon USD and Measure U = Dixon and unincorporated; Winters Measure B = unincorporated only.

### Guides to widen to `solano`

| Guide | Change |
|---|---|
| seiu-1021 | Add `solano`. Same page |
| pp-norcal-action | Add `solano`. Same page |
| ifpte-21 | Add `solano`. Same page (BOS D4 only) |
| eqca | Add `solano` (Vallejo D5, BOE 1) |
| bay-area-reporter | Add `solano` (Vallejo D5). Same story is already a source |
| ca-wfp | Add `solano` (Vallejo council Rogers) |
| east-bay-dsa | Add `solano` (measures, BOE 1 no position) |
| courage-california | Add `solano`; add `https://www.progressivevotersguide.com/california/2026/general/county/solano` as an `extraSource` |
| lwv-ca | Add `solano` (props, as for other counties) |
| 350-bay-area-action, envirovoters, housing-action-coalition, yimby-action | Optional: CD8 and/or AD11 picks only |

Not widened: mercury-news (no Solano editorials found), sierra-club-sf-bay (no Solano content; use the Redwood Chapter), spur, sf-chronicle, bay-rising-action, greenbelt-alliance, unite-here-2, lwv-bay-area (RTM only).

---

## 4. Gotchas

- **Solano is in BOE District 1.** Every existing county is BOE 2. `board-of-equalization-1` is a new shared contest in `ballot.yml`. Guides that already list all four BOE districts (Courage, SEIU, EQCA, DSA) will now have a BOE 1 contest to match in Solano only.
- **CD8 and AD11 already exist** with `within: Contra Costa`. Widening the `within` lists, not new contests, is what Solano needs. Per Courage's page, CD8 also spans Sacramento, San Joaquin and Yolo.
- **Napa and Solano share labor, Sierra Club and party-adjacent pages.** NSCLC's page mixes Napa and Solano and lists CD4 and AD4 (Napa districts not on any Solano ballot). It puts Vallejo USD under the Napa heading. Sierra Club Redwood mixes Napa, Sonoma, Marin and Solano; its **Sonoma County Measure H** sits beside Solano's Measure H, and Napa County Measure B (also in DSA's guide) sits beside Winters JUSD Measure B. Extraction must not alias bare letters.
- **Measure letters collide with existing ids**: O (Albany, Alum Rock, Concord, East Palo Alto), P (Albany, Alum Rock, Hercules, Marin County, Menlo Park), Q (Albany, Cambrian, Half Moon Bay, Richmond), U (Berkeley, Ross, San Mateo County, Walnut Creek), V (Berkeley, San Anselmo, SMCCCD, WCCUSD), X (Berkeley, Brisbane, Liberty UHSD, Sausalito), Y (Belmont, Berkeley, Marin CSA 27), Z (Berkeley, Cabrillo USD), E (Mountain View, Redwood City), H (San Mateo), B (Gilroy). Every Solano measure id must carry its jurisdiction.
- **Name collisions:** Fairfield (Solano) vs Fairfax (Marin). "Vallejo" appears in Napa County sections. Robert **Marin** is a Fairfield D3 candidate, and "Marin" is also a county and area id.
- **Solano Dems mislabel Y and Z.** Its page says "Measure Y — City of Benicia Real Property Transfer Tax" and "Measure Z — City of Benicia Business License Tax", copying the uncorrected 8/5 notice. The corrected notice (8/10) has Y = Limited City Charter and Z = Real Property Transfer Tax. Both are Yes, so the verdicts are unaffected, but quotes will carry the wrong titles.
- **Solano Dems call the County Board of Education seat "Area 4"**; Kedarisetty runs in TA6 (TA4 is off the ballot). NSCLC calls it "Solano County Office of Education, Area 6".
- **Solano GOP has two tiers**: "Endorsed candidates" and "Recommended candidates". Decide whether "Recommended" counts as a pick (it includes Hilton, Grove, Callison, Carli, Stockton).
- **NSDC is images only.** Mark it `manual: true` and hand-enter, like smc-dems and svgop. Three of its 19 cards are stamped "ELECTED!" and have no Nov contest.
- **NSCLC lists measures without a verdict word** ("Solano County – Measures E and H"). DSA's guide independently says "The Napa Solano Central Labor Council endorses Measure Y" and "Measure Z", which supports reading the list as Yes.
- **Reform California** lists 19 1st District justices; only the 11 in `court-of-appeal-1` are on the ballot. It lists CD4, CD7, AD4 and AD7 ("You're Doomed"), which are not on Solano ballots, and a Solano CC TA6 pick for a seat that is off the ballot.
- **Two news-only guides misspell names**: the Times-Herald writes "Matulace", The Reporter writes "Mtulac" and "Greg Richie".
- **Uncontested races on the ballot**: Vallejo D2 (Matulac) and the Dixon clerk (Ruiz) are listed ON THE BALLOT with one candidate each. Vallejo D2 has five guide picks.
- **Cross-county contests** run by other counties: San Joaquin Delta College TA4 (filed in San Joaquin County) and Winters JUSD Measure B (filed in Yolo County). River Delta USD spans other counties too (unverified which).
- **VIG 33 is missing** from the registrar's list of ballot-type guides, so district-to-city mapping from VIGs is incomplete.
- **Name variants to alias:**

| Roster name (log) | Variant | Seen in |
|---|---|---|
| Michael "Mike" Silva | Michael Silva, Dr. Michael Silva, Mike Silva | most guides |
| Gregory Ritchie II | Greg Ritchie (VIG), Greg Richie (Reporter) | VIG, news |
| Doriss Panduro | Doriss Lopez Panduro (VIG) | VIG |
| K. Patrice Williams | K Patrice Williams | Dems, NSCLC, NSDC |
| Scott Tonnesen | Scott Tonneson | SEIU, NSCLC |
| Nikila Walker Gibson | Nikila Walker-Gibson | Orderly Growth article |
| Diosdado "JR" Matulac | JR Matulac, Diosdado "J.R." Matulac, Matulace, Mtulac | NSCLC, PP, Sierra, news |
| Tara Beasley Stansberry | Tara Beasley-Stansberry | EQCA, B.A.R. |
| Lynda Davis-Robinson | Lynda Davis Robinson | VIG |
| Susan Bush | Susan M. Bush | VIG |
| Robert Marin | Bob Marin | Reform |
| Michael Ceremello Jr. | Michael J Ceremello, Jr., Michael Ceremello | VIG, GOP |
| Julian Y. Cuevas | Julian Cuevas | Dems, NSDC, NSCLC |
| Dan Mahoney | Daniel Mahoney | VIG |
| Jeanette Wylie | Jeanette Wyle | NSCLC |
| Jenny Leilani Callison | Jenny Callison, Jenny Callion | Reform, GOP |
| Sonja Shaw | Sonya Shaw | GOP |
| Rizal "Mr. Riz" V. Aliga | Rizal Aliga | VIG |

## 5. Unverified, and decisions for Sean

Unverified:
- Solano Orderly Growth, the Vacaville Chamber and ValPAC are known only from news articles. No own page was found for the first two; `vallejochamber.com` was not tried in a browser.
- Benicia Herald (HTTP 500), United Democrats of Southern Solano, other Democratic clubs, Napa/Solano Building Trades and the Fairfield-Suisun Chamber: no 2026 pages found.
- Measure vote thresholds other than the school bonds; whether River Delta USD spans other counties; whether the WFP PDF's "BRIANNA ROGERS / VALLEJO CITY COUNCIL" pairing is by order as it appears.
- The Times-Herald, Reporter and Daily Republic may still publish endorsements before Nov 3.
- The VIGs do not include the printed ballot page, so candidate names are from the filed log and VIG statements, not the ballot itself.

Decisions:
1. **News-only guides.** Add Solano Orderly Growth, Vacaville Chamber and ValPAC with a news article as `source`? Their picks are clear, but the article is a third party's report.
2. **A business type.** The repo has no `business` type. Use `advocacy` for the chambers, add a type, or leave them out.
3. **Reform California** as a guide. It is a statewide conservative guide with a page per county. If added for Solano, check whether it should cover the other areas too (not checked).
4. **Solano GOP "Recommended" tier.** Count recommended candidates as picks, or only "Endorsed"?
5. **Which local contests to add.** All 27 candidate contests and 11 measures, or the San Mateo rule (24 and 9)? Measures O and Q have only DSA's explicit "no recommendation".
6. **Source extracts.** Marin committed redacted `data/2026-11/sources/*` extracts. Commit `Solano-Candidates-Nov2026.txt` and `Solano-Measures-Nov2026.txt` from the filed log and the measure notices?
7. **Widening CD8, AD11 and court-of-appeal-1** touches `ballot.yml`, and adding BOE 1 does too. Coordinate with any other North Bay branch (Napa, Sonoma) that may also edit these lines, and with the guide-widening of shared guides (seiu-1021, pp-norcal-action, eqca, courage-california, ca-wfp, east-bay-dsa, bay-area-reporter, ifpte-21, lwv-ca) so each is widened once with `--only-areas`.

## Decisions (2026-10-09)

Sean approved these for Sonoma, Napa and Solano together.

1. Add only the local contests some guide covers, as for San Mateo and Marin.
2. Area ids and order: `sonoma` 80, `napa-county` 90, `solano` 100.
3. `press-democrat` is a new guide for Sonoma and Napa. Leave out its reprints of Bay Area News Group editorials (already counted through `mercury-news`) and its primary-era editorials.
4. Image-only guides (Sonoma GOP, Sonoma County Farm Bureau, Northern Solano Democratic Club) are added as `manual: true` and entered by hand.
5. Groups known only from news articles (Solano Orderly Growth, Vacaville Chamber, ValPAC) are skipped until they publish their own page.
6. Add Reform California, and check its pages for the counties already covered.
7. The Solano GOP's "Recommended" tier counts as a pick.
8. Skip clubs that repeat the county party's slate (Santa Rosa Democratic Club, Sonoma Valley Democrats).
9. Create Congress 4 and Assembly 4 once for all three counties. Move `sonoma-county-board-of-education-2` from `marin.yml` to the Sonoma file.
10. Commit text copies of the registrars' candidate lists and measure notices to `data/2026-11/sources/`.
11. Extraction runs on the API key (issue #63, running it on the Claude subscription, is not built yet).
