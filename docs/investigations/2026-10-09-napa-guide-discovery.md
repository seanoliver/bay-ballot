# Bay Ballot Napa discovery: Napa County (Nov 3, 2026)

Researched 2026-10-09. It follows the structure of `2026-10-07-marin-guide-discovery.md`. This pass is research only. Nothing has been extracted, and the area files, `ballot.yml`, the county ballot files and the guide files are unchanged.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-09 and saw Nov 2026 picks.
- **Not published**: the page loads but has no Nov 2026 picks, it is stale, or the outlet said it will not endorse.
- **Unverified**: I could not confirm it. The reason is given in each case.

**Access notes**
- `napacounty.gov` (and `countyofnapa.org`, which redirects there) returns **403 to curl** for every page, even with a desktop Chrome user agent. It loads in a real browser (Playwright), and same-origin `fetch()` from an open page works, including the DocumentCenter PDFs. Everything county-side below was read that way. Only ballot data comes from there, so refresh is unaffected.
- `americancanyon.gov` also returns **403 to curl**. It loads in a browser.
- `sierraclub.org/redwood/endorsements` returns an Incapsula 302 with a 122-byte body to curl. It loads in a browser, as the existing `sierra-club-sf-bay` page does.
- `napadems.org` serves a TLS certificate for `*.web-hosting.com`, so **https fails** certificate verification. `http://napadems.org/home/` returns the full page (200, 42 KB).
- `napavalleyregister.com` (Register, St. Helena Star, Weekly Calistogan, American Canyon Eagle, all on one Lee Enterprises site) serves full article text to curl.
- `pressdemocrat.com` marks editorials "SUBSCRIBER ONLY" on index pages, but each article's full text is in the HTML returned to curl.
- `napagop.org`, `napavalleydems.org`, `lwvnapa.org`, `nbclc.org`, `350bayareaaction.org` and `progressivevotersguide.com` all return full pages to curl.

---

## 1. Guide table

"Reasons" means the guide explains each pick. "List" means it gives picks only. Proposed ids are suggestions. B, P, S and Y are the Napa measure letters (section 2).

### Newspapers

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Napa Valley Register | newspaper | https://napavalleyregister.com/opinion/column/rough-draft-election-coverage-without-the-endorsements/article_98d5e246-0401-469c-8e91-31b9c4fa702d.html (Oct 1, 2026) | **Not published, by choice.** Managing Editor Samie Hartley: "One thing you won't see in the Napa Valley Register this year is candidate endorsements." and "We won't tell you how to vote." Candidates were invited to submit statements instead | n/a | HTML | None | None |
| St. Helena Star, Weekly Calistogan, American Canyon Eagle | newspaper | https://napavalleyregister.com/star/opinion/ , https://napavalleyregister.com/calistogan/opinion/ , https://napavalleyregister.com/eagle/opinion/ | **Not published.** Their opinion indexes on 2026-10-09 show letters only, no 2026 editorials. They are sister weeklies on the Register's site. The "Star editorial: Our last word on the election" that search engines surface is from 2020-10-14 (`datePublished` in its HTML) | n/a | HTML | None | None |
| The Press Democrat (`press-democrat`) | newspaper | One editorial per race. Index: https://www.pressdemocrat.com/tag/2026-endorsements/ (list each Napa editorial as a source, like `smdj`) | **Yes, rolling** since 9/18 | Yes | HTML (full text to curl) | None | **No on American Canyon P** (9/23); **CD4 Thompson** (10/6); **Yes on Napa County B** (10/8). Statewide: Lt Gov Ma (9/29), Insurance Commissioner Allen (9/30), Treasurer Kounalakis (10/2), SPI Barrera (10/8); Props: No 4 (9/18), No 44 (9/26), Yes 3 and 40 (10/2), No 43 (10/3). The rest of the tag is Sonoma County |
| Calistoga Tribune, Yountville Sun, Napa Valley Marketplace | newspaper / magazine | No URL found | **Unverified.** No site or 2026 endorsement surfaced in web searches | n/a | n/a | n/a | n/a |

Press Democrat editorial URLs relevant to Napa (all loaded 2026-10-09, byline "Editorial Board"):
- https://www.pressdemocrat.com/2026/09/23/endorsement-no-on-measure-p-american-canyon-needs-to-look-elsewhere-for-revenue-growth/
- https://www.pressdemocrat.com/2026/10/06/endorsement-californias-4th-congressional-district-deserves-experience-mike-thompson-will-deliver/
- https://www.pressdemocrat.com/2026/10/08/endorsement-yes-on-b-keep-napa-fire-resilient-and-maintain-its-open-space/
- Statewide: https://www.pressdemocrat.com/2026/09/29/endorsement-elect-fiona-ma-californias-lieutenant-governor/ , https://www.pressdemocrat.com/2026/09/30/endorsement-elect-ben-allen-californias-next-insurance-commissioner-2/ , https://www.pressdemocrat.com/2026/10/02/endorsement-elect-eleni-kounalakis-californias-next-treasurer-2/ , https://www.pressdemocrat.com/2026/10/08/endorsement-elect-richard-barrera-californias-superintendent-of-public-instruction-november-election-california-public-schools-sonja-shaw/ , https://www.pressdemocrat.com/2026/09/18/pd-endorsement-no-on-prop-4-taxpayer-dollars-should-not-support-campaigns/ , https://www.pressdemocrat.com/2026/09/26/endorsement-no-on-prop-44-politics-dont-belong-in-californias-community-health-clinics/ , https://www.pressdemocrat.com/2026/10/02/endorsement-vote-yes-on-propositions-40-and-3-so-the-wealthy-pay-a-fair-share-to-help-all-californians/ , https://www.pressdemocrat.com/2026/10/03/endorsement-prop-43-wants-to-fix-a-system-that-isnt-broken/

Not yet covered by the Press Democrat: AD4, every Napa school, college and city race, and Measures S and Y.

### Parties

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Napa County Democratic Party (`napa-dems`) | party | http://napadems.org/home/ (the homepage carries the results; **http only**, see access notes) | **Yes.** City races voted Aug 24, school and college races voted Sep 14 (60% threshold; bold and `*` mark endorsees) | List (with vote shares) | HTML | TLS cert mismatch on https | NVC TA2 Dodd; NVC TA3 Servente; NVC TA4 **no endorsement** (Iverson 50%, Johnson 50%); NVUSD TA1 Jankiewicz; NVUSD TA6 Gonzalez-Mares; NVUSD TA7 Dooley; American Canyon council Oro; Napa council Luros (D3), DeNatale (D1); Yountville mayor Mohler; Yountville council McKee; St. Helena mayor Schoch; St. Helena council Pedersen. Also NVC TA5 Cosca, NVUSD TA3 Shelton, Calistoga mayor Eisenberg and council Richardson, **all four not on the ballot** (section 2). **No CD4, AD4 or measure picks** on the page |
| Napa County Republican Party (`napa-gop`) | party | https://napagop.org/2026-election-endorsements/ | **Yes** (page headed "Endorsements for National Election Nov 2, 2026", sic) | List | HTML table | None | Governor Hilton, Lt Gov Romero, AG "Matt Gates" (Michael Gates), SoS Wagner, Treasurer Hawks, Controller Morgan, SPI Shaw. Props: Yes 39, 41, 42, 43, 45; No 1, 2, 3, 4, 5, 37, 38, 40, 44. **No on "Measure B City of Napa"** (the only Measure B in Napa is the countywide one). Also lists CD1 Gallagher, State Senate 4 Duarte and BOE 1 Grove, **none of which are on Napa ballots** (section 2). No CD4 or AD4 pick |

### Democratic and other clubs

| Guide | Type | URL | Published? | Notes |
|---|---|---|---|---|
| Democrats of Napa Valley (chartered club) | club | https://napavalleydems.org/candidates-endorsements/ | **Not published.** The page is headed "2025 Elected Officials". The Aug 17 agenda (https://napavalleydems.org/wp-content/uploads/Agenda-August-17-2026-Meeting.pdf) and Sep 21 agenda (https://napavalleydems.org/wp-content/uploads/Agenda-September-21-2026-Meeting.pdf) show endorsement votes on city, school and college candidates, but no results are posted | Results may appear later as a page or as a letter to the Register. Next meeting Oct 8 (props) |
| Progressive Women of Napa Valley | club | No site found. Past slates ran as Register letters (2020: https://napavalleyregister.com/opinion/letters/progressive-women-of-napa-valley-announce-2020-endorsements/article_89bf736d-3b6a-5e77-a1ab-dbf1f412ff53.html) | **Unverified.** No 2026 slate found | A letter-to-the-editor guide would need a stable URL per letter |
| Indivisible Napa | advocacy | None found | **Unverified.** Searches found no Napa chapter guide | Unlike Indivisible Marin, which has a PDF |

### Labor

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| North Bay Labor Council (existing `nbclc`) | union | https://www.nbclc.org/2026endorsements | **Yes** | List | HTML (Wix) | None | **CD4 Thompson, AD4 Aguiar-Curry.** The page has Sonoma, Marin, Mendocino and Lake sections but **no Napa County section**. Napa is not in its stated jurisdiction (the guide file says "Sonoma, Lake, Mendocino and Marin") |
| Napa and Solano Counties Central Labor Council | union | https://unionhall.aflcio.org/nsclc | **Not published.** The newest item is "March 2020 Endorsements"; `/nsclc/endorsements` returns 404 | n/a | HTML | None | None |
| SEIU 1021 (existing `seiu-1021`) | union | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 | **Yes** | List | HTML | None | **CD4 Thompson, AD4 Aguiar-Curry; Napa council D3 Luros; NVC TA2 Eddy Ruiz, TA3 Pastula, TA4 Johnson.** The NVC picks sit under the **SOLANO COUNTY** heading, after Vallejo, not under NAPA COUNTY |
| Napa Valley Educators Association, Napa firefighters | union | None found | **Unverified.** Searches found no 2026 list | n/a | n/a | n/a | n/a |

### Advocacy

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Sierra Club Redwood Chapter (`sierra-club-redwood`) | advocacy | https://www.sierraclub.org/redwood/endorsements | **Yes** | List | HTML | **Incapsula** (browser OK) | **CD4 Thompson; Yes on Napa County B**; BOE 2 Lieber; SoS Weber, Controller Cohen, Treasurer Kounalakis, AG Bonta, Insurance Commissioner Allen, SPI Barrera; Props: support 1, 4, 5, oppose 39, 43, 45. No AD4 pick (it points to Sierra Club California for legislative races). No Napa local candidates. Also CD1, CD2, CD8, SD2, AD2, AD12 and Solano/Sonoma locals. Napa is in the Redwood Chapter (Napa Group), not the SF Bay Chapter |
| 350 Bay Area Action (existing `350-bay-area-action`) | advocacy | https://350bayareaaction.org/electoral/endorsements-2026 (Napa County section) and https://350bayareaaction.org/napa_county_wildfire_preparedness_act | **Yes** | Yes (Measure B page: "is a clear Yes for us. Please Vote Yes.") | HTML | None | **Yes on Napa County B** only. Napa Climate NOW! (https://napa.350bayarea.org/) is its local group |
| Greenbelt Alliance (existing `greenbelt-alliance`) | advocacy | https://www.greenbelt.org/voter-guide-26/ | **Yes** | Yes (summary per item) | HTML | browser (existing `fetchWith`) | **Yes on Napa County B** ("Vote Yes on Measure B To Fund Wildfire Preparedness in Napa"). The same page still has the June SMART "Measure B" item |
| Courage California (existing `courage-california`) | advocacy | https://www.progressivevotersguide.com/california/2026/general/county/napa | **Yes** | Yes | HTML | None | **AD4 Aguiar-Curry; CD4 "No Recommendation"** ("this is a safe Democratic district"); BOE 2 Lieber; statewide offices and props. No local races |
| YIMBY Action (existing `yimby-action`) | advocacy | https://yimbyaction.org/endorsements/november-2026-california-general | **Yes** | List | HTML | None | **AD4 Aguiar-Curry.** No Napa local picks |
| Equality California (existing `eqca`) | advocacy | https://www.eqca.org/our-endorsements/ | **Yes** | List | HTML | runner wall (existing `fetchFrom: local`) | **CD4 Thompson, AD4 Aguiar-Curry.** No Napa local picks |
| Planned Parenthood NorCal Action Fund (existing `pp-norcal-action`) | advocacy | https://www.plannedparenthoodaction.org/planned-parenthood-northern-california-action-fund/endorsements | **Yes** | List | HTML | None | **AD4 Aguiar-Curry; Napa City Council D3 Luros.** No CD4 pick |
| California Environmental Voters (existing `envirovoters`) | advocacy | https://envirovoters.org/2026-endorsements/ | Yes | List | HTML | None | **No Napa picks.** No CD4 or AD4 entry; statewide only |
| California Working Families Party (existing `ca-wfp`) | party (minor) | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf | Yes | List | PDF | None | **No Napa picks** (no "Napa", "Thompson" or "Aguiar" in the text layer) |
| Land Trust of Napa County | advocacy (c3, proponent) | https://napalandtrust.org/2026/09/03/an-ounce-of-prevention-why-measure-b-is-a-smart-investment-for-napas-future/ | Yes, but it is the **measure's sponsor**, not a guide | Yes | HTML | None | Yes on B. The Press Democrat names it and Napa FireWise as the measure's backers |
| Napa County Farm Bureau | advocacy (business) | https://www.napafarmbureau.org/news-and-research/measure-b-position | **No position.** "the Napa County Farm Bureau will remain neutral in the campaign" on B | n/a | HTML | None | None |
| Napa County Taxpayers Association | advocacy | No site found. KQED lists its president, Tom Orlando, as a Measure B opponent: https://www.kqed.org/voterguide/napa/measure-b | **Unverified** as a guide | n/a | n/a | n/a | Possibly No on B |
| Napa Chamber of Commerce | business | https://napachamber.com/ (WordPress posts API, searched "endorse" and "measure") | **Not published.** Newest endorsement posts are from Oct 2024 (Measure G, Measure U, 2024 council) | n/a | HTML | None | None |
| Bay Rising Action, UNITE HERE Local 2, IFPTE 21 (existing) | various | Their existing source URLs | Yes | n/a | HTML | None | **No Napa picks** found on 2026-10-09 |

### Civic (Leagues don't endorse candidates)

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| League of Women Voters of Napa County | civic | https://www.lwvnapa.org/ , https://www.lwvnapa.org/voter-information | **Not published.** No measure positions on the site. Its "The Voter October 2026" post links a newsletter whose URL is a literal placeholder (`https://mailchi.mp/[xxxxxx]/...`) | n/a | HTML (Wix) | None | None |
| LWV California (existing `lwv-ca`) | civic | https://lwvc.org/ballot-recommendations/ | Yes | Yes | HTML (`manual: true`) | n/a | Props |

### Counts

Guides with any Nov 2026 Napa pick, local or district (statewide-only guides excluded):
- **Published, new:** 4. These are napa-dems, napa-gop, sierra-club-redwood and press-democrat.
- **Published, existing and should be widened:** 8. These are nbclc, seiu-1021, courage-california, yimby-action, eqca, pp-norcal-action, 350-bay-area-action and greenbelt-alliance.
- **Statewide only, widen by precedent:** lwv-ca.
- **Statewide only, not widened:** envirovoters, ca-wfp, mercury-news, sf-chronicle, spur.
- **Not published:** Napa Valley Register (declined to endorse), St. Helena Star, Weekly Calistogan, American Canyon Eagle, Democrats of Napa Valley, Napa-Solano CLC, LWV Napa County, Napa Chamber. Farm Bureau is neutral. The Land Trust is the measure's sponsor.
- **Unverified:** Calistoga Tribune, Yountville Sun, Napa Valley Marketplace, Progressive Women of Napa Valley, Indivisible Napa, Napa Valley Educators Association, Napa firefighters, Napa County Taxpayers Association.

---

## 2. Ballot contests

### Sources

- Roster of qualified candidates, "GENERAL ELECTION - 11/3/2026", contests 3110 to 5501, printed 8/13/2026, PDF modified 8/21/2026: https://www.napacounty.gov/DocumentCenter/View/46087/November-3-2026---List-of-Qualified-Candidates (linked from https://www.napacounty.gov/2328/Qualified-List-of-Candidates and https://www.napacounty.gov/3326/Candidate-Information). Each contest says "On Ballot: Yes" or "On Ballot: No".
- Candidate Guide (offices, incumbents, terms): https://www.napacounty.gov/DocumentCenter/View/45805/
- Local measures list: https://www.napacounty.gov/2319/Local-Measures , with pages for B (https://www.napacounty.gov/2471/County-of-Napa---Measure-B), P (https://www.napacounty.gov/2470/City-of-American-Canyon---Measure-P), S (https://www.napacounty.gov/2330/City-of-St-Helena---Measure-S) and Y (https://www.napacounty.gov/2472/Town-of-Yountville---Measure-Y). The county hosts only B's documents; P, S and Y link to the city and town sites.
- June 2, 2026 primary results, one PDF per contest on Napa ballots: https://www.napacounty.gov/4186/June-2-2026-Election-Results
- SoS Certified List of Candidates (8/27/2026), already in `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`.

Machine-readability: the roster is a text-layer PDF (Crystal Reports) that `pdftotext -layout` reads cleanly, but every napacounty.gov URL needs a browser. Names are printed in capitals with ballot designations, mailing addresses and phone numbers; a committed extract should keep contest, seats, names and the incumbent marker only, like the Marin extract.

### State and federal districted contests

The June 2 primary result list for Napa has exactly one contest of each districted type: "US Representative in Congress, District 4", "Member of State Assembly, District 4" and "State Board of Equalization, District 2", and **no State Senate contest** (https://www.napacounty.gov/4186/June-2-2026-Election-Results). So the whole county is in each district below.

| Contest | Candidates (SoS) | In ballot.yml? | Proposed change |
|---|---|---|---|
| U.S. Representative, District 4 | Eric Jones (D), Mike Thompson (D) | **No** | New `us-rep-4`, within Napa. Prop 50 lines; the Register reported in 2025 that Napa stays in the 4th (https://napavalleyregister.com/news/napa-politics-elections-mike-thompson-proposition-50/article_7629c14f-6837-43f9-b423-eedd355fd508.html) |
| State Assembly, District 4 | Cecilia M. Aguiar-Curry (D), **unopposed** | **No** | New `assembly-4`, within Napa |
| Board of Equalization, District 2 | Sally J. Lieber, John Pimentel | Yes, Napa not in `within` | Add Napa to `within` on `board-of-equalization-2` |
| 1st District Court of Appeal retentions | Same justices as the existing contest | Yes, Napa not in `within` | Add Napa to `within` on `court-of-appeal-1`. The SoS list names Napa among the First Appellate District counties |
| State Senate | none | n/a | **No State Senate contest in Napa.** Napa is in SD3 (Christopher Cabaldon, per https://napavalleydems.org/candidates-endorsements/), which is not up in 2026 |

Statewide offices, Supreme Court retentions and Props 1 to 5 and 37 to 45 apply as is. **Napa is not in the Regional Transit Measure**; `rtm`'s `within` must not gain Napa.

There are no county offices on the ballot. Supervisor Districts 1 and 3 were decided in June (https://localnewsmatters.org/2026/06/03/napa-county-incumbents-supervisor-superintendent-races/), and the Candidate Guide says Auditor-Controller, Assessor-Recorder-County Clerk, Treasurer-Tax Collector, District Attorney and Sheriff-Coroner moved to the March 2028 cycle.

### Local candidate contests on the ballot (14)

Names are the roster's, in title case. Guide coverage counts guides from section 1 with a pick in the contest.

| # | Contest | Seats | Candidates | Guides with picks |
|---|---|---|---|---|
| 1 | Napa Valley College, Trustee Area 2 | 1 | Jeff Dodd (inc per Candidate Guide), Heriverto Ruiz | Dems (Dodd), SEIU (Ruiz) |
| 2 | Napa Valley College, Trustee Area 3 | 1 | Emily Pastula, Elizabeth L Goff, Karina Servente | Dems (Servente), SEIU (Pastula) |
| 3 | Napa Valley College, Trustee Area 4 | 1 | Cindy Johnson, William "Kyle" Iverson (inc per Candidate Guide) | SEIU (Johnson). Dems: no endorsement |
| 4 | Napa Valley USD, Trustee Area 1 | 1 | Robin Jankiewicz (inc), Matthew McMann | Dems |
| 5 | Napa Valley USD, Trustee Area 6 | 1 | Elba Gonzalez-Mares (inc per Candidate Guide), Tyrone Navarro | Dems |
| 6 | Napa Valley USD, Trustee Area 7 (**2-year term**, seat vacant) | 1 | David Hildebrandt, Jason M. Dooley, John Houser, Gabriel Champagne Affonso | Dems (Dooley) |
| 7 | Calistoga Joint USD | 2 | Cecilia Ramirez, Laurel Rios (inc), Irene Pena, Rebecca Sager | none |
| 8 | American Canyon City Council | 2 | Jason Kishineff, Sindy Biederman, Robert Cole, Jim Giron, David Oro | Dems (Oro) |
| 9 | Napa City Council, District 1 (**unopposed**, roster says On Ballot: Yes) | 1 | Christopher Denatale (appointed inc) | Dems |
| 10 | Napa City Council, District 3 | 1 | Mary Luros, Jim Hinton | Dems, SEIU, PP (all Luros) |
| 11 | St. Helena Mayor | 1 | Bonnie Schoch, Patrick Kenealy | Dems (Schoch) |
| 12 | St. Helena City Council | 2 | Kate Spadarotto (appointed inc), Joshua Parke, Daniel Hale, John Pedersen, Scott Diaz (appointed inc) | Dems (Pedersen) |
| 13 | Yountville Mayor | 1 | Marjorie Mohler, Joe Tagliaboschi | Dems (Mohler) |
| 14 | Yountville Town Council | 2 | Robin McKee (inc), Jessi Bugden, Matthew Chrzanowski, Hillery Bolt Trippe, Jill Turner | Dems (McKee) |

Breakdown: 3 community college, 4 school district, 7 city/town (1 uncontested). **13 of 14 have at least one guide pick**; only Calistoga JUSD has none.

Not on the ballot (roster "On Ballot: No", uncontested): Napa County Board of Education TA1, TA2, TA4; Napa Valley College TA5 (Lotte Cosca); Napa Valley USD TA3 (Katherine Hyde Shelton); St. Helena USD; Pope Valley Union SD; Calistoga Mayor (Kevin Eisenberg) and City Council (Lana Richardson, Scott Cooper); Circle Oaks, Congress Valley, Los Carneros and Spanish Flat water districts; Regional Park and Open Space District Wards 1 and 5. The Napa Dems' picks for Cosca, Shelton, Eisenberg and Richardson therefore have no contest. Howell Mountain Elementary SD (4 seats, per the Candidate Guide) does not appear on the roster at all.

### Local measures (4)

| Letter | Jurisdiction | Subject | Vote | Guides with positions |
|---|---|---|---|---|
| B | County of Napa (citizen initiative) | "Napa County Wildfire Preparedness, Watershed Protection and Open Space Preservation Act of 2026": 1/2% countywide sales tax, Apr 1, 2027 to Mar 31, 2045, split 50/50 between the County and the Regional Park and Open Space District (ballot title: https://www.napacounty.gov/DocumentCenter/View/40594/Measure-B---Ballot-Title-and-Summary---Napa-County-PDF) | Majority ("simple majority (50% plus one vote)", impartial analysis: https://www.napacounty.gov/DocumentCenter/View/46097/Measure-B---Impartial-Analysis---Napa-County-PDF) | Sierra Redwood Y, 350 Y, Greenbelt Y, Press Democrat Y, GOP N |
| P | City of American Canyon | City services sales tax, 1%, about $3.7M a year, "until ended by voters" (ballot language: https://www.americancanyon.gov/Work/Elections-Central/Measure-P) | Majority (general tax; the city page does not state the threshold) | Press Democrat **N** |
| S | City of St. Helena | "St. Helena City Services Measure": 1/2 cent sales tax, about $2M a year, until ended by voters (https://www.cityofsthelena.gov/985/Measure-S---Ballot-Question) | Majority (general tax; not confirmed on the city page) | none |
| Y | Town of Yountville | Appropriations (Gann) limit update for four years (https://www.townofyountville.gov/659/Measure-Y-Town-Appropriations-Limit) | Majority (not stated on the town page) | none |

**2 of 4 measures have a guide position.** Napa (city) and Calistoga have no measures.

### Totals

2 new district contests (CD4, AD4) plus 2 widened (BOE 2, Court of Appeal 1). 14 local candidate contests (13 contested) and 4 measures. Under the San Mateo rule (add a local race only when a guide covers it), that is **13 candidate contests and 2 measures**.

---

## 3. Proposed area structure (not implemented)

One county page. The id should not be bare `napa`, because the City of Napa is also a jurisdiction on this page and a `napa` id would read as the city (see section 4):

```yaml
id: napa-county
name: Napa County
kind: county
order: 80
jurisdictions:
  - { level: state, name: California }
  - { level: county, name: Napa }
  - { level: city, name: American Canyon }
  - { level: city, name: Calistoga }
  - { level: city, name: Napa }
  - { level: city, name: St. Helena }
  - { level: city, name: Yountville }
```

`order: 80` puts it after Marin (70). If the Sonoma and Solano passes add areas, agree one order among the three. Yountville is a town; the repo already uses `level: city` for towns (Fairfax, Ross). The roster spells "St Helena" without a period; the city's own site uses "St. Helena".

The county ballot file would be `data/2026-11/ballot/napa.yml` (county slug). `us-rep-4` and `assembly-4` go in `ballot.yml`, within `[{ level: county, name: Napa }]`.

**No city pages.** The City of Napa (largest city) has two council seats, one unopposed, and no measure, and every guide that covers it is countywide. No city has a local guide of its own.

Contest ids, following the existing patterns: `us-rep-4`, `assembly-4`, `napa-valley-college-trustee-area-2`, `-3`, `-4`, `napa-valley-usd-trustee-area-1`, `-6`, `-7`, `calistoga-jusd-trustee`, `american-canyon-council`, `napa-council-1`, `napa-council-3`, `st-helena-mayor`, `st-helena-council`, `yountville-mayor`, `yountville-council`, `napa-county-measure-b`, `american-canyon-measure-p`, `st-helena-measure-s`, `yountville-measure-y`. School and college districts use `level: district` with `within: [{ level: county, name: Napa }]`.

### Guides to widen to `napa-county`

| Guide | Change |
|---|---|
| nbclc | Add area. CD4 and AD4 only; no Napa local section |
| seiu-1021 | Add area. Watch the NVC picks under the Solano heading |
| courage-california | Add area; add `https://www.progressivevotersguide.com/california/2026/general/county/napa` as an `extraSource`. Its CD4 entry is "No Recommendation" |
| yimby-action | Add area. AD4 only |
| eqca | Add area. CD4, AD4. Keep `fetchFrom: local` |
| pp-norcal-action | Add area. AD4, Napa D3 Luros |
| 350-bay-area-action | Add area; add `https://350bayareaaction.org/napa_county_wildfire_preparedness_act` as an `extraSource` for the reason |
| greenbelt-alliance | Add area. Measure B only |
| lwv-ca | Add area (statewide props, by precedent) |

Not widened: envirovoters and ca-wfp (no Napa district picks), sierra-club-sf-bay (Napa is the Redwood Chapter's territory), mercury-news (no Bay Area News Group paper covers Napa), sf-chronicle and spur (statewide only, Peninsula precedent).

---

## 4. Gotchas

- **Napa is a city and a county.** "Napa County Measure B", the Napa GOP's "Measure B City of Napa", the City of Napa council and the county area all share the word. Area ids and contest ids must say which (`napa-county`, `napa-county-measure-b`, `napa-council-3`). The Napa GOP's label is wrong: there is no City of Napa measure (https://www.napacounty.gov/2319/Local-Measures).
- **Measure letters collide.** Napa B collides with June SMART Measure B on the same Greenbelt page, with `gilroy-measure-b`, and with the 2024 NVUSD Measure B in old Register results. American Canyon P collides with `marin-county-measure-p`, `menlo-park-measure-p`, `hercules-measure-p`, `albany-measure-p`, `alum-rock-sd-measure-p`, and with Fairfield Measure P on the same SEIU page. St. Helena S collides with `larkspur-measure-s`, `san-pablo-measure-s` and others. Yountville Y collides with `marin-csa-27-measure-y`, `berkeley-measure-y` and `belmont-measure-y`. Contest ids must carry the jurisdiction, and extraction must not alias bare letters.
- **Multi-county districts.** CD4 under Prop 50 also covers parts of Sonoma, Lake, Colusa, Placer, Sutter and Yuba (Courage's CD4 page). AD4 and BOE 2 also span other counties. If a Sonoma or Solano area is added, `us-rep-4`, `assembly-4`, `board-of-equalization-2` and `court-of-appeal-1` need those counties in `within` too; coordinate with those branches so each shared contest is edited once. Calistoga Joint USD is a "Joint" district and may reach into Sonoma (unverified). Courage says CD4 includes "parts of" Napa; the June result list and the Register say all of Napa, which I take as correct.
- **Guides list districts that are not on Napa ballots.** The Napa GOP lists CD1, State Senate 4 and BOE 1; NBCLC and SEIU list CD1, CD2 and AD12 alongside CD4. Napa ballots carry only CD4, AD4 and BOE 2.
- **Picks for races not on the ballot.** The Napa Dems endorsed Cosca (NVC TA5), Shelton (NVUSD TA3), Eisenberg (Calistoga mayor) and Richardson (Calistoga council), all "On Ballot: No". Do not record them.
- **NVC TA3's incumbent is running elsewhere.** The Candidate Guide lists Jason Kishineff as the Area 3 trustee; he is now an American Canyon council candidate, so TA3 is an open seat.
- **CD4 is Democrat vs Democrat.** Courage takes no position; the Napa Dems page has no CD4 pick. The Republican runner-up endorsed Jones (https://calmatters.org/politics/2026/09/california-congressional-race-thompson-jones/).
- **Press Democrat statewide editorials may be shared copy.** Its Allen slug ends in `-2` exactly like the Marin IJ's Bay Area News Group reprint, and the Ma, Allen and Kounalakis titles match. I did not confirm whether the Press Democrat wrote or reprinted them.
- **Name variants to alias:** William "Kyle" Iverson = "Kyle Iverson" (Dems, DONV). Heriverto Ruiz = "Heriverto (Eddy) Ruiz" (Dems) = "Eddy Ruiz" (SEIU). Jason M. Dooley = "Jason Dooley". Elizabeth L Goff = "Elizabeth Goff". Katherine Hyde Shelton = "Katherine Shelton" (DONV). Hillery Bolt Trippe = "Hillery Trippe" (DONV). Christopher Denatale (roster capitals "DENATALE") = "Christopher DeNatale" (Dems). Robin Jankiewicz = "Robin Jankiewitz" (DONV typo). Marjorie Mohler = "Margorie Mohler" (DONV typo). Michael Gates = "Matt Gates" (Napa GOP). Sonja Shaw is spelled that way by both the GOP and the Press Democrat.
- **napadems.org works over http only.** A fetch that forces https fails certificate verification. The page is the party's homepage, so unrelated homepage edits (meeting notices) will trip the refresh line diff.
- **The Register's no-endorsement column will look like an election page.** It names Thompson, Jones and props. Do not add it as a source.

## 5. Unverified items and decisions for Sean

Unverified:
- Whether Napa City Council District 1 (Denatale, unopposed) actually prints. The roster says "On Ballot: Yes" and the City of Napa notice lists Districts 1 and 3 (https://www.cityofnapa.org/DocumentCenter/View/15780/Notice-of-Election_2026-PDF, not opened).
- Vote thresholds for P, S and Y. The city and town pages give the ballot question but not the threshold; "majority" is inferred from their being general taxes or a Gann limit.
- Whether Calistoga Joint USD reaches into Sonoma County, and why Howell Mountain ESD is absent from the roster.
- Democrats of Napa Valley results (votes held Aug 17 and Sep 21), Progressive Women of Napa Valley, NVEA, firefighters, the Taxpayers Association, Indivisible Napa, Calistoga Tribune and Yountville Sun. Any may still publish.
- The full text of the Measure B arguments: the county's argument PDFs are scans with no text layer.
- Whether the Press Democrat's statewide editorials are its own.

Decisions:
1. **Area id.** `napa-county` (recommended, avoids the city collision) or `napa` (matches `marin`).
2. **Which local contests to add.** All 14 candidate contests and 4 measures, or the 13 and 2 that a guide covers (the San Mateo rule). Only Calistoga JUSD, St. Helena S and Yountville Y would be left out.
3. **The Press Democrat as a guide.** It is the only newspaper endorsing in Napa, but it is a Sonoma paper and most of its tag is Sonoma races. Add it with `areas: [napa-county]` now and widen it if a Sonoma area is added. Also decide whether to keep its statewide picks (possible shared copy).
4. **Sierra Club Redwood Chapter** as a new guide separate from `sierra-club-sf-bay`. Its Napa picks are CD4, BOE 2, Measure B, statewide offices and props.
5. **NBCLC for Napa.** Its page covers CD4 and AD4 but has no Napa section, and Napa is formally in the Napa-Solano council's territory. Widen it for the two district picks, or leave it out.
6. **Coordination with the Sonoma and Solano passes** on the shared contests (`us-rep-4`, `assembly-4`, BOE 2, Court of Appeal 1), on area order numbers, and on widening the same multi-county guides (nbclc, seiu-1021, courage-california, yimby-action, eqca, pp-norcal-action, 350-bay-area-action, greenbelt-alliance, lwv-ca) once.

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
