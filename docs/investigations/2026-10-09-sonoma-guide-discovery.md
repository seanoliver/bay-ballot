# Bay Ballot Sonoma discovery: Sonoma County (Nov 3, 2026)

Researched 2026-10-09. It follows the structure of `2026-10-07-marin-guide-discovery.md`. This pass is research only. Nothing has been extracted, and the area, ballot and guide files are unchanged.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-09 and saw Nov 2026 picks.
- **Not published**: the page loads but has no Nov 2026 picks, or it is stale.
- **Unverified**: I could not confirm it. The reason is given in each case.

**Access notes**
- `sonomacounty.gov` (Registrar of Voters) returns full HTML to curl, unlike `marincounty.gov`. The measure PDFs download with curl too.
- `pressdemocrat.com` serves full editorial text in the HTML to curl. There is no endorsements-only index: `https://www.pressdemocrat.com/opinion/endorsements/` redirects to an old 1st District supervisor article. The working index is https://www.pressdemocrat.com/opinion/editorials/ (pages 1 to 3 reach back to April 2026).
- `sierraclub.org` returned a 302 to curl and loaded in the browser. (The shared Playwright browser was navigated by another session mid-read once; pages were re-read in a fresh tab.)
- `sonomacountygop.org` (sonomagop.org redirects there) is a site builder. Its voter guide is two PNG images with no text layer and no link text; the image URLs only show up in the rendered DOM.
- `conservationaction.org`, the old Sonoma County Conservation Action domain, now redirects to `thegirlonthetrain.com`, an unrelated site.
- `sonomawest.com` (Sonoma West Times) returns 404 for every path tried. `windsortimes.com` loads, but its newest post is from July 2025.
- These domains do not resolve: `lwvsonomacounty.org` (the League is at `lwvsonoma.org`), `sonomacountyalliance.com` and `.org`, `northbaydsa.org`, `sonomagreens.org`, `greenpartysonomacounty.org`, `sonomacountygreens.org`, `northcoastbuildingtrades.org`, `sonomacountyyoungdems.org`.

---

## 1. Guide table

Abbreviations: CD = Congress, SD = State Senate, AD = Assembly, BOS = Board of Supervisors, SR = Santa Rosa, RP = Rohnert Park, PJUHSD = Petaluma Joint Union High School District (guides call it "Petaluma City Schools"), SRJC = Sonoma County Junior College District. Measure letters are the Sonoma letters in section 2. "Reasons" means the guide explains each pick. "List" means it gives picks only. Proposed ids are suggestions.

### Newspapers

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| The Press Democrat (`press-democrat`) | newspaper | One editorial per race. Index: https://www.pressdemocrat.com/opinion/editorials/ (list each editorial as a source, like `smdj` and the Marin IJ) | **Verified, rolling** since 9/18 | Yes | HTML (full text to curl) | None | Measures I, H, AB, K, L (all Yes); Healdsburg D2 Lopez, D4 Herrod; SR D4 Jones-Carter; Petaluma D1 Cader Thompson, D2 Newell, D3 Nau, Mayor McDonnell; RP D2 Khoury Tams, D5 Hollingsworth Adams; Cloverdale Marquez, Parker, Carter; CD4 Thompson; Sonoma D1 Mackie. Own statewide picks: Yes 3, 40; No 4, 43, 44. Reprinted Bay Area News Group picks: Lt Gov Ma, Insurance Commissioner Allen, Treasurer Kounalakis, SPI Barrera |
| Sonoma Index-Tribune | newspaper | https://www.sonomanews.com/2026/10/09/endorsement-mackie-would-bring-new-energy-to-sonoma-city-council/ | **Not a separate guide.** It republishes Press Democrat editorials under the same slug | - | HTML | None | Same as the PD |
| Petaluma Argus-Courier | newspaper | https://www.petalumanews.com/2026/09/29/endorsement-cader-thompson-newell-nau-mcdonnell-for-petaluma-city-council/ (petaluma360.com redirects to petalumanews.com) | **Not a separate guide.** Its "Argus-Courier council endorsements" link is the PD editorial; it also carries the PD's Props 3/40 piece | - | HTML | None | Same as the PD |
| North Bay Bohemian | newspaper | https://bohemian.com/ | **Unverified.** No 2026 endorsement post on the homepage, news category or RSS feed (newest items 10/7). Its search pages render results client-side. Web search finds only 1998 to 2002 Bohemian guides | - | - | None | - |
| Sonoma West Times | newspaper | https://www.sonomawest.com/ | **Unverified**: every path returns 404 | - | - | Site down | West County, if it publishes |
| Windsor Times | newspaper | https://windsortimes.com/ | **Not published**: newest post is July 2025 | - | - | None | - |
| Healdsburg Tribune | newspaper | https://www.healdsburgtribune.com/ (print edition on Issuu: https://issuu.com/metrosiliconvalley/docs/healdsburg_tribune_october_8_2026) | **Unverified**: no endorsement post on the site; the Issuu e-edition was not read | - | - | None | - |
| Kenwood Press | newspaper | https://www.kenwoodpress.com/ is a 954-byte shell that iframes a NewsMemory e-edition | **Unverified**: e-edition not read | - | - | E-edition only | - |
| Sonoma Valley Sun | newspaper | https://sonomasun.com/ | **None found** on the homepage | - | - | None | - |

Press Democrat editorial URLs (all loaded 2026-10-09; byline in brackets where it is not the PD's own "Editorial Board"):
- https://www.pressdemocrat.com/2026/09/18/pd-endorsement-no-on-prop-4-taxpayer-dollars-should-not-support-campaigns/
- https://www.pressdemocrat.com/2026/09/18/pd-endorsement-yes-on-i-windsor-sales-tax-would-provide-lifeline-for-town/
- https://www.pressdemocrat.com/2026/09/19/endorsement-yes-on-h-keep-sonoma-county-regional-parks-funded/
- https://www.pressdemocrat.com/2026/09/21/endorsement-yes-on-ab-support-srjcs-historic-830-million-bond-with-caution/
- https://www.pressdemocrat.com/2026/09/22/endorsement-herrod-lopez-are-best-choices-for-healdsburgs-future/
- https://www.pressdemocrat.com/2026/09/23/endorsement-yes-on-k-rohnert-park-sales-tax-would-help-keep-citys-services-afloat/
- https://www.pressdemocrat.com/2026/09/24/endorsement-for-santa-rosa-city-council-district-4-jones-carter-is-best-bet/
- https://www.pressdemocrat.com/2026/09/26/endorsement-no-on-prop-44-politics-dont-belong-in-californias-community-health-clinics/
- https://www.pressdemocrat.com/2026/09/29/endorsement-cader-thompson-newell-nau-mcdonnell-for-petaluma-city-council/
- https://www.pressdemocrat.com/2026/09/29/endorsement-elect-fiona-ma-californias-lieutenant-governor/ [Mercury News East Bay Times Editorial Boards]
- https://www.pressdemocrat.com/2026/09/30/endorsement-elect-ben-allen-californias-next-insurance-commissioner-2/ [Mercury News East Bay Times Editorial Boards]
- https://www.pressdemocrat.com/2026/09/30/endorsement-rohnert-park-can-forge-strong-future-with-khoury-tams-hollingsworth-adams/
- https://www.pressdemocrat.com/2026/10/01/endorsement-santa-rosa-has-no-other-choice-than-to-approve-measure-l/
- https://www.pressdemocrat.com/2026/10/02/endorsement-elect-eleni-kounalakis-californias-next-treasurer-2/ [Mercury News East Bay Times Editorial Boards]
- https://www.pressdemocrat.com/2026/10/02/endorsement-vote-yes-on-propositions-40-and-3-so-the-wealthy-pay-a-fair-share-to-help-all-californians/
- https://www.pressdemocrat.com/2026/10/03/endorsement-prop-43-wants-to-fix-a-system-that-isnt-broken/
- https://www.pressdemocrat.com/2026/10/05/endorsement-marquez-parker-and-carter-can-steer-cloverdale-in-the-right-direction/
- https://www.pressdemocrat.com/2026/10/06/endorsement-californias-4th-congressional-district-deserves-experience-mike-thompson-will-deliver/
- https://www.pressdemocrat.com/2026/10/08/endorsement-elect-richard-barrera-californias-superintendent-of-public-instruction-november-election-california-public-schools-sonja-shaw/ [Mercury News East Bay Times Editorial Boards]
- https://www.pressdemocrat.com/2026/10/09/endorsement-mackie-would-bring-new-energy-to-sonoma-city-council/

Also published, but for Napa County: https://www.pressdemocrat.com/2026/09/23/endorsement-no-on-measure-p-american-canyon-needs-to-look-elsewhere-for-revenue-growth/ and https://www.pressdemocrat.com/2026/10/08/endorsement-yes-on-b-keep-napa-fire-resilient-and-maintain-its-open-space/ (relevant to a Napa pass).

Not yet covered by the PD for November: CD1, CD2, SD2, AD2, AD4, AD12, BOS D2 and D4, Sebastopol, Windsor, all school boards, the fire districts, and Measures D, E, G, J, M, N, O. Its June primary editorials picked McGuire for CD1 (https://www.pressdemocrat.com/2026/05/06/pd-editorial-mcguire-is-top-pick-for-new-house-district/), Connolly and Lucan (https://www.pressdemocrat.com/2026/05/08/pd-editorial-connolly-and-lucan-are-top-legislative-picks/), Schwedhelm for BOS D4 (https://www.pressdemocrat.com/2026/05/14/pd-editorial-tom-schwedhelm-stands-out-for-4th-district-supervisor/) and Lemus for BOS D2 (https://www.pressdemocrat.com/2026/05/15/pd-editorial-lemus-is-best-prepared-for-2nd-district-supervisor/). Those are primary picks, not November picks, and should not be extracted.

### Parties

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Sonoma County Democratic Party (`sonoma-dems`) | party | https://sonomademocrats.org/2026-endorsements/ (updated 10/2) | **Verified** | Candidates: list. Measures: a short description each | HTML | None | CD1 McGuire, CD2 Huffman, CD4 Thompson; SD2 Connolly; AD2 Rogers, AD4 Aguiar-Curry (no AD12 pick: two Democrats); BOS D2 Paun, D4 Bagby; Cloverdale Kern; **Cotati Moffet (no contest, see section 4)**; Healdsburg D2 Pratt, D4 Herrod; Petaluma Mayor McDonnell, D1 Cader Thompson, D2 Newell, D3 Vazquez; PJUHSD TA3 Holmes, TA5 Seitchik Sebastian; Waugh Bugbee, Pieper, Lloyd; RP D2 Khoury Tams, D5 Hollingsworth Adams; SR D2 Stapp, D4 Jones-Carter, D6 Okrepkie; SR HSD TA2 Du Fosee; SRJC TA5 Battenfeld; Sebastopol Maurer; Sonoma D1 Mackie; Sonoma Valley USD TA1 McIntosh; Windsor D1 Kubota; Windsor USD Brown, Donoho. **Yes on all 12 local measures** (D, E, G, H, I, J, K, L, M, N, O, AB). No statewide picks on this page |
| Sonoma County Republican Party (`sonoma-gop`) | party | https://www.sonomacountygop.org/ (homepage, "The Sonoma County Republican Party November 2026 Voter Guide"). Images: https://www.sonomacountygop.org/s/cc_images/teaserbox_908396352.PNG (candidates) and https://www.sonomacountygop.org/s/cc_images/teaserbox_908396353.PNG (props and measures), both uploaded 10/6 | **Verified** | List | **PNG images only** | None to curl, but image URLs appear only in the rendered DOM | CD1 Gallagher, CD2 Littau, SD2 Gibbs, AD2 Greer; Governor Hilton, Lt Gov Romero, Controller Morgan, AG Gates, Treasurer Hawks, SoS Wagner, SPI Shaw (no Insurance Commissioner pick). Props: Yes 39, 41, 42, 43; No 1–5, 37, 38, 40, 44, 45. Measures: **No on D, E, G, H, AB, I, K, L, M, O; "N/A" on J and N.** No local candidate picks |
| California Republican Party county page | (reference, not a guide) | https://vote.cagop.org/sonoma-county/ | No picks (registration page) | - | HTML | None | - |

### Democratic clubs

The county party lists its chartered clubs at https://sonomademocrats.org/about-us/local-chartered-clubs/.

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Sonoma County Asian Pacific Islander Democratic Club (`sonoma-api-dems`) | club | https://www.socoapidemclub.com/ (homepage "Endorsements" block) | **Verified** | List | HTML | None | CD1 McGuire, CD2 Huffman ("Jare Huffman"), CD4 Thompson; SD2 Connolly; **AD12 Elward**; BOS D2 Paun, D4 Bagby; SRJC TA5 Battenfeld; **PJUHSD TA3 John Garcia** (differs from the county party's Holmes), TA5 Seitchik Sebastian; Healdsburg D4 Herrod; Petaluma D3 Vazquez; RP D5 Hollingsworth Adams; SR D2 Stapp, D4 Jones-Carter; Sonoma D1 Mackie. **No on Prop 39.** Yes on AB, H, I, K, L |
| Santa Rosa Democratic Club | club | https://www.democlub.org/endorsements links https://www.democlub.org/s/2026_GenElectionEndorsements-zgp4.pdf (Squarespace static, created 9/28) | **Verified, but it is the county party's slate.** The PDF is titled "2026 General Election Sonoma County Democratic Party Endorsement" | Short measure summaries | PDF, text layer | None | Same local picks as `sonoma-dems`, plus the party's statewide picks (Becerra, Ma, Bonta, Weber, Cohen, Kounalakis, Allen, Barrera, Lieber) and props (Yes 1–5, 37, 38, 40; No 39, 41, 42, 43; the PDF's remaining pages were not read) |
| Sonoma Valley Democrats | club | https://www.svdems.org/endorsements/ | **Verified, mostly a pointer.** It links the county party and CADEM pages and says it does "not make local endorsements". Its own vote: Yes on AB | Short bios | HTML | None | Yes AB; congratulates the county party's CD1, CD2, CD4, SD2, AD2, AD4, BOS D2, D4 endorsees |
| Windsor Democratic Club | club | https://windsordemocrats.org/ | **Not published** as a list. It mentions "Endorsement labels" for door hangers but shows no slate | - | - | None | - |
| Cloverdale Democratic Club, Oakmont Democratic Club, Wine Country Young Democrats | club | https://www.clodems.com/ , https://www.oakmontdemclub.org/ , https://winecountryyoungdemocrats.com/ | **None found** | - | - | None | - |
| Democratic Club of Southern Sonoma County (Petaluma), Jewish Democratic Club, Redwood Coast Democratic Club | club | Facebook pages only on the county party's list | **Unverified** (Facebook not read) | - | - | - | - |

### Labor

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| North Bay Labor Council (already a guide, `nbclc`) | union | https://www.nbclc.org/2026endorsements ("SONOMA COUNTY" section) | **Verified** | List | HTML (Wix) | None | CD1 McGuire, CD4 Thompson, CD2 Huffman; SD2 Connolly; AD2 Rogers, AD4 Aguiar-Curry, AD12 Elward; BOS D2 Paun, D4 Bagby; RP D2 Linda Khoury Tams, D5 "Susan Adams"; Petaluma D1 Cader Thompson, D2 Newell, D3 Vazquez, Mayor McDonnell; SR D2 Stapp, D4 Jones Carter; Healdsburg D2 Lopez, D4 Herrod; Sonoma D1 Mackie; Windsor Mayor Potter, D1 Fortino Dickson; Cloverdale Carter; Sebastopol Woodruff; Sonoma BOE TA2 Quinn; SRJC Battenfeld; PJUHSD TA5 Seitchik Sebastian; SR City Schools TA2 "Shaun Du Fosse". Yes K, L, H, AB, I. **Not on the ballot:** SRJC Maggie Fishman and Ezrah Chabaan, Roseland SD Anthony Mendoza |
| SEIU 1021 (already a guide) | union | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 ("NORTH COAST" and "SONOMA COUNTY" sections) | **Verified** | List | HTML | None | CD1 McGuire, CD4 Thompson; AD2 Rogers, AD12 Elward; SD2 Connolly; BOS D2 Paun, D4 Bagby; Sonoma BOE "District 2" Quinn; SR D2 Stapp, D4 Jones-Carter; RP D5 Hollingsworth Adams; Petaluma D1 Cader Thompson, D2 Newell, D3 Vazquez; Healdsburg D4 Herrod. Yes H, K, L |
| UNITE HERE Local 2 (already a guide, `unite-here-2`) | union | https://www.unitehere2.org/2026/09/november-2026-election-endorsements/ | **Verified** | List | HTML | None | BOS D2 Paun, D4 Bagby; SR D4 Jones-Carter; Petaluma D3 "Eric Vasquez"; Sonoma D1 Mackie |
| Sonoma County Deputy Sheriffs' Association | union | https://www.sonomacountydsa.org/political-action.html | **Not published**: a PAC request form only | - | - | None | - |
| North Bay Jobs with Justice | advocacy | https://www.northbayjwj.org/ | **None found** | - | - | None | - |
| North Coast Building Trades | union | No site found (`northcoastbuildingtrades.org` does not resolve) | **Unverified** | - | - | - | - |

### Advocacy

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| Indivisible Sonoma County (`indivisible-sonoma`) | advocacy | https://indivisiblesoco.org/voting-resources-clonedisc-2026-midterm-voting-guide/ (published 10/6). Printable PDF: https://drive.google.com/file/d/1gKyzFsbFhdWy6gbCbcPjb3a0rhWsseag/view ; detailed PDF: https://drive.google.com/file/d/1C857Rqxv_4esEmXCQDDHirfbJ_UcQdeI/view ; props: https://indivisiblesonomacounty.substack.com/p/indivisible-sonoma-county-recommends | **Verified** | Yes | HTML + PDF (text layer) + Substack | None (Drive serves the PDFs to curl via `uc?export=download`) | CD1 McGuire, CD4 Thompson (endorsed); "encourages a vote for" CD2 Huffman; Insurance Commissioner **Jane Kim**; SPI Barrera; AD12 Elward; BOS D2 Paun, D4 Bagby; SR D4 Jones-Carter. Yes H, D, AB. Props on Substack: Yes 1, 2, 3, 4, 5, 37; No 38, 39 (rest not read) |
| Sonoma County Farm Bureau (`sonoma-farm-bureau`) | advocacy (no business type in the repo) | https://sonomafb.org/advocacy-2/ ; image https://sonomafb.org/wp-content/uploads/2026/10/SCFB-Voter-Guide-1.png | **Verified** | List | **PNG image** | None to curl (page also loads in a browser) | CD4 Thompson, **CD1 Gallagher**, **AD12 Lucan**, **BOS D2 Lemus**, **BOS D4 Schwedhelm**, **SR council Terry Sanders** (D4), Insurance Commissioner Allen; Oppose Prop 40; Support Props 43, 45. The page's two other 2026 images are the California Farm Bureau statewide guide |
| Sonoma County Conservation Action | advocacy | Old domain https://conservationaction.org/ redirects to an unrelated site | **Unverified**. It does endorse in 2026: the PD's Healdsburg editorial says Scott Pratt is "endorsed by Sonoma County Conservation Action". No current web list found | - | - | Domain lapsed | - |
| Sierra Club Sonoma Group (Redwood Chapter) | advocacy | https://www.sierraclub.org/redwood/sonoma/political | **Not published**: newest linked slate is 2020 | - | HTML | 302 to curl; browser OK | - |
| Sierra Club SF Bay Chapter (already a guide) | advocacy | https://www.sierraclub.org/sfbay/2026-endorsements | Verified for its own counties; **no Sonoma picks** (Sonoma is in the Redwood Chapter) | - | - | Incapsula | - |
| Latino PAC of Sonoma County | advocacy | No site found. The PD's SR D4 editorial says it backs Jones-Carter | **Unverified** | - | - | - | - |
| Generation Housing | advocacy | https://generationhousing.org/endorsements/ | **Not a guide**: housing project endorsements only | - | - | None | - |
| Sonoma County Bicycle Coalition | advocacy (c3) | https://www.bikesonoma.org/bike-the-vote-2026/ | **Not published**: "As a 501(c)3 nonprofit organization, SCBC cannot endorse candidates"; questionnaires only | - | - | None | - |
| 350 Sonoma | advocacy | https://350sonoma.org/ | **None found** | - | - | None | - |
| Santa Rosa Metro Chamber, North Bay Leadership Council | business | https://www.santarosametrochamber.com/ , https://www.northbayleadership.org/ | **None found** | - | - | None | - |
| Sonoma County Alliance | business | Domains do not resolve | **Unverified** | - | - | - | - |
| North Bay / Sonoma DSA, Sonoma Green Party | advocacy / party | Domains tried do not resolve (`sonomacountydsa.org` is the Deputy Sheriffs' Association) | **Unverified** | - | - | - | - |

### Civic

| Guide (proposed id) | Type | Nov 2026 URL | Published? | Reasons? | Format | Bot block | Contests covered |
|---|---|---|---|---|---|---|---|
| League of Women Voters of Sonoma County | civic | https://lwvsonoma.org/ | **None found**: pros and cons videos and candidate forums only; no measure positions on the site | - | - | None | - |
| Bay City News "Local News Matters" county guide | (reference) | https://localnewsmatters.org/sonoma-county-november-3-2026/ | No endorsements | - | - | None | - |

### Existing guides to widen to Sonoma

Evidence is the guide's own page, loaded 2026-10-09.

| Guide | Sonoma picks seen | Notes |
|---|---|---|
| nbclc | See Labor above (about 30 picks) | Same source. Skip SRJC Fishman, Chabaan and Roseland Mendoza (not on the ballot) |
| seiu-1021 | See Labor above | Same source |
| unite-here-2 | BOS D2, D4; SR D4; Petaluma D3; Sonoma D1 | Same source |
| ca-wfp | AD2 Rogers; Healdsburg Herrod; Petaluma Vazquez; "Petaluma City Schools" Seitchik Sebastian; SR Jones-Carter; BOS Bagby, Paun; "Sonoma County Office of Education" Quinn (http://caworkingfamilies.org/voter-guide-general-election-2026.pdf) | Its council and school lines give no district number |
| pp-norcal-action | AD2 Rogers, AD4 Aguiar-Curry; "Sonoma County" section: BOS D2 Paun, D4 Bagby, SR D4 Jones-Carter | Same source |
| 350-bay-area-action | "Sonoma County" section: BOS D2 Paun, D4 Bagby, Healdsburg D2 Lopez, D4 Herrod; AD12 Elward | Same source |
| eqca | CD1 McGuire, CD4 Thompson, AD2 Rogers, AD4 Aguiar-Curry, **RP D2 Michael DeSimone** | `fetchFrom: local` already |
| envirovoters | CD1 McGuire, AD2 Rogers (plus CD2, SD2, AD12 already in via Marin) | Same source |
| yimby-action | CD1 McGuire, AD2 Rogers, AD4 Aguiar-Curry (plus AD12 Lucan via Marin YIMBY) | No Sonoma local picks |
| courage-california | CD2, AD2, AD4, AD12, SD2; **CD4 "No Recommendation"**; no CD1 entry on the Sonoma page; no local races | Add https://www.progressivevotersguide.com/california/2026/general/county/sonoma as an `extraSource` |
| greenbelt-alliance | "Vote Yes on Measure H for Parks for All in Sonoma County" | `fetchWith: browser` already |
| lwv-ca | Props only | Widen by precedent |

Not widened: bay-rising-action and ifpte-21 (no Sonoma mention on their pages), sierra-club-sf-bay (no Sonoma picks), mercury-news (the PD reprints its statewide editorials; see section 4).

### Counts

Guides with any Nov 2026 Sonoma pick, local or district (statewide-only guides excluded):
- **Verified, new:** 6. These are press-democrat, sonoma-dems, sonoma-gop, sonoma-api-dems, indivisible-sonoma and sonoma-farm-bureau. Two more clubs are verified but repeat the county party (Santa Rosa Democratic Club, Sonoma Valley Democrats).
- **Verified, existing and should be widened:** 11. These are nbclc, seiu-1021, unite-here-2, ca-wfp, pp-norcal-action, 350-bay-area-action, eqca, envirovoters, yimby-action, courage-california and greenbelt-alliance. Plus lwv-ca by precedent.
- **Not published or not a guide:** Index-Tribune and Argus-Courier (PD reprints), Windsor Times, Sonoma Valley Sun, Sierra Club Sonoma Group, Generation Housing, Bike Coalition, 350 Sonoma, LWV Sonoma County, Deputy Sheriffs, North Bay JwJ, Windsor, Cloverdale and Oakmont clubs, Wine Country Young Dems, chambers.
- **Unverified:** Sonoma County Conservation Action, North Bay Bohemian, Sonoma West Times, Healdsburg Tribune, Kenwood Press, Latino PAC, Sonoma County Alliance, building trades, DSA, Green Party, three Facebook-only Democratic clubs.

---

## 2. Ballot contests

### Sources

- Candidates on the ballot (all offices, with ballot designations): https://sonomacounty.gov/administrative-support-and-fiscal-services/registrar-of-voters/elections/november-3-2026-general-election-candidates-on-the-ballot
- Props and measures on the ballot, with one County Guide PDF per measure: https://sonomacounty.gov/administrative-support-and-fiscal-services/registrar-of-voters/elections/november-3-2026-general-election-props-and-measures-on-the-ballot
- Local measures that were filed (filing order, lead-county notes; updated 8/7/26): https://sonomacounty.gov/administrative-support-and-fiscal-services/registrar-of-voters/elections/november-3-2026-general-election-local-measures-that-were-filed
- Offices up for election: https://sonomacounty.gov/administrative-support-and-fiscal-services/registrar-of-voters/elections/november-3-2026-general-election-offices-up-for-election
- Local candidates who filed (unofficial, updated 8/17/26): https://sonomacounty.gov/administrative-support-and-fiscal-services/registrar-of-voters/elections/november-3-2026-general-election-local-candidates-who-filed
- SoS Certified List of Candidates (8/27/2026): `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`.

Machine-readability: all county pages are server-rendered HTML that curl reads. The measure ballot questions are in PDFs with a text layer, at `https://sonomacounty.gov/Main%20County%20Site/Administrative%20Support%20%26%20Fiscal%20Services/Registrar%20of%20Voters/Documents/Elections/2026/11-03-2026/SoCo_Nov2026GenElec_<n>_Meas<X>_..._EN.pdf` (for example `..._9451_MeasH_SoCoRegParks_SalesTax_EN.pdf`). No source extract was committed in this research pass; a redacted `Sonoma-Candidates-Nov2026.txt` and `Sonoma-Measures-Nov2026.txt` would follow the Marin pattern.

### State and federal districted contests

The county's candidates page lists exactly these voter-nominated contests. Candidates match the SoS certified list.

| Contest | Candidates | In ballot.yml? | Proposed change |
|---|---|---|---|
| U.S. Representative, District 1 | Mike McGuire (D), James Gallagher (R) | **No** | New `us-rep-1`, within Sonoma |
| U.S. Representative, District 2 | Jared Huffman (D), Robin Littau (R) | Yes (`us-rep-2`, within Marin) | Add Sonoma to `within` |
| U.S. Representative, District 4 | Mike Thompson (D), Eric Jones (D) | **No** | New `us-rep-4`, within Sonoma |
| State Senate, District 2 | Damon Connolly (D), Tief Gibbs (R) | Yes (`state-senate-2`, within Marin) | Add Sonoma |
| State Assembly, District 2 | Chris Rogers (D), Michael Greer (R) | **No** | New `assembly-2`, within Sonoma |
| State Assembly, District 4 | Cecilia M. Aguiar-Curry (D), unopposed | **No** | New `assembly-4`, within Sonoma (one candidate, but printed on the ballot) |
| State Assembly, District 12 | Eric Lucan (D), Jackie Elward (D) | Yes (`assembly-12`, within Marin) | Add Sonoma |
| Board of Equalization, District 2 | Sally J. Lieber, John Pimentel | Yes | Add Sonoma to `within` |
| Court of Appeal, First District (11 retentions on Sonoma's list) | Smiley, Wilson, Banke, Stewart, Desautels, Rodriguez, Petrou, Brown, Chou, Simons, Burns | Yes (`court-of-appeal-1`) | Add Sonoma (the SoS lists Sonoma among the First District counties). The existing contest is titled "11 justices", matching Sonoma's list |

No State Senate 3 contest is on Sonoma's list. Statewide offices, Supreme Court retentions and Props 1–5 and 37–45 are already in `ballot.yml`. **Sonoma is not in the Regional Transit Measure** (it is not on the county's measures list), so `rtm` must not gain Sonoma.

Which cities each district covers was not mapped. Since this proposal has no Sonoma city pages, `within: [{ level: county, name: Sonoma }]` is enough for all of them.

### Local candidate contests on the ballot (38)

Coverage counts guides from section 1 with a pick in the contest. Names are as printed (the county prints them in capitals). "Inc" marks a ballot designation of "Incumbent" or "Appointed Incumbent" only; other incumbents may use other designations.

| # | Contest | Seats | Candidates | Guides with picks |
|---|---|---|---|---|
| 1 | Sonoma County Board of Education, Trustee Area 2 (also on some Marin ballots; already in `marin.yml`) | 1 | Jonathan Lenz, Caitlin Quinn | NBCLC, SEIU, WFP (all Quinn) |
| 2 | SRJC (Sonoma County Junior College District), Trustee Area 5 | 1 | Leticia Contreras, Dorothy Battenfeld | Dems, NBCLC, API (Battenfeld) |
| 3 | SRJC, Trustee Area 7 | 1 | Kateliyn Rutkowski, Michael Valdovinos | - |
| 4 | Calistoga Joint Unified SD | 2 | Irene Pena, Rebecca Sager, Cecilia Ramirez, Laurel Rios (inc) | - |
| 5 | Cotati-Rohnert Park Unified SD, Trustee Area 1 | 1 | Angela Marie Scardina, Leff Brown (inc), Nathan Toister | - |
| 6 | Sonoma Valley Unified SD, Trustee Area 1 | 1 | Amanda Radzik, Susan Joyce McIntosh | Dems |
| 7 | Windsor Unified SD | 3 | Rich Carnation (inc), Stephanie Ahmad (inc), Patricia "Trish" Donoho, Michael Brown | Dems |
| 8 | City of Santa Rosa High SD, Trustee Area 2 | 1 | Shaun A. Du Fosee (appointed inc), Teresa A. Medina | Dems, NBCLC |
| 9 | Petaluma Joint Union HSD, Trustee Area 3 (also on some Marin ballots) | 1 | Laura Holmes, John Garcia | Dems (Holmes), API (Garcia) |
| 10 | Petaluma Joint Union HSD, Trustee Area 5 | 1 | John La Bare, Sarah Seitchik Sebastian | Dems, NBCLC, WFP, API |
| 11 | West Sonoma County Union HSD, Trustee Area 5 | 1 | Dani Sheehan-Meyer, Lewis Buchner (inc) | - |
| 12 | Harmony Union SD | 3 | Jacquelyn Wilson, Michael Podshadley, Tiffany Danielle Monroe, Jasmin Tokatlian | - |
| 13 | Monte Rio Union SD, Full Term | 2 | Mike Wilder, Craig Baker, Melissa Frost | - |
| 14 | Twin Hills Union SD | 3 | Rebecca Houghton (inc), Jeff Harding (inc), Anna-Maria Guzman, John Moise (inc) | - |
| 15 | Two Rock Union SD | 3 | Nicolas Noyes (inc), Joel Ruiz, Laura B. Gutierrez, Mauricio Gutierrez, John C. Martin | - |
| 16 | Waugh SD | 3 | Christine D. Pieper (inc), Dylan Lloyd, Denise Bugbee (inc), Kevin Gushue | Dems |
| 17 | County Supervisor, District 2 | 1 | Joanna Paun, Sylvia Lemus | Dems, NBCLC, SEIU, WFP, PP, UH2, 350, Indivisible, API (Paun); Farm Bureau (Lemus) |
| 18 | County Supervisor, District 4 | 1 | Tom Schwedhelm, Melanie Bagby | Dems, NBCLC, SEIU, WFP, PP, UH2, 350, Indivisible, API (Bagby); Farm Bureau (Schwedhelm) |
| 19 | Cloverdale City Council | 3 | Steve Kawa, Kimberly Kern, Will Carter, Chris Parker, Jenn Neylon, Colleen Shields, Kelly Spagnola, Marjorie A Morgenstern (inc), Andrés Marquez (appointed inc) | PD (Marquez, Parker, Carter), Dems (Kern), NBCLC (Carter) |
| 20 | Cloverdale City Treasurer | 1 | "There are no candidates for this office." | - |
| 21 | Healdsburg City Council, District 2 | 1 | Alex Wood, Scott Pratt, Mathew Lopez | PD, NBCLC, 350 (Lopez); Dems (Pratt) |
| 22 | Healdsburg City Council, District 4 (uncontested) | 1 | Chris Herrod | PD, Dems, NBCLC, SEIU, WFP, 350, API |
| 23 | Petaluma Mayor | 1 | John Hanania, Kevin McDonnell, Shelina Moreda | PD, Dems, NBCLC (McDonnell) |
| 24 | Petaluma City Council, District 1 | 1 | Janice Cader Thompson, Alan W. LaPierre, Nate Martin | PD, Dems, NBCLC, SEIU |
| 25 | Petaluma City Council, District 2 | 1 | Brent Newell, John Shribbs (inc) | PD, Dems, NBCLC, SEIU (Newell) |
| 26 | Petaluma City Council, District 3 | 1 | Karen Nau (inc), Eric Vazquez | PD (Nau); Dems, NBCLC, SEIU, WFP, UH2, API (Vazquez) |
| 27 | Rohnert Park City Council, District 2 | 1 | Paul Carey, Michael DeSimone, Linda (Khoury) Tams | PD, Dems, NBCLC (Khoury Tams); EQCA (DeSimone) |
| 28 | Rohnert Park City Council, District 5 | 1 | Susan Hollingsworth Adams (inc), Arlene G. Linder, Mauricio Barreto | PD, Dems, NBCLC, SEIU, API |
| 29 | Santa Rosa City Council, District 2 (uncontested) | 1 | Mark Stapp | Dems, NBCLC, SEIU, API |
| 30 | Santa Rosa City Council, District 4 | 1 | Melanie Jones-Carter, Terry Sanders | PD, Dems, NBCLC, SEIU, WFP, PP, UH2, Indivisible, API (Jones-Carter); Farm Bureau (Sanders) |
| 31 | Santa Rosa City Council, District 6 (uncontested) | 1 | Jeff Okrepkie | Dems |
| 32 | Sebastopol City Council | 3 | Ian Hoff, James Woodruff, Kyreen Jorgensen, Brandie L. Solovay, Jill McLewis (inc), Sandra Maurer (inc), Erin Mitchell | Dems (Maurer), NBCLC (Woodruff) |
| 33 | Sonoma City Council, District 1 | 1 | Peggy Hutton, Julian Mackie, Michael L. Menefee | PD, Dems, NBCLC, UH2, API (Mackie) |
| 34 | Windsor Mayor | 1 | Tanya Potter, Rick Massell | NBCLC (Potter) |
| 35 | Windsor Town Council, District 1 | 1 | Evan Kubota, Gina Fortino Dickson | Dems (Kubota), NBCLC (Fortino Dickson) |
| 36 | Windsor Town Council, District 4 (uncontested) | 1 | Meredith Rennie | - |
| 37 | Gold Ridge Fire Protection District | 4 | David Warburg, Domenico Carinalli Jr, Steve E Petrucci, Doug Jones, Tara Daniels, Shannon J Shaffer-Killey, Robert Gloeckner, Kathleen Molloy Gilbraith, Christina Gibbs | - |
| 38 | Sonoma County Fire District | 3 | Steve Klick, Richard H. Alpert, Gary So, Robert M. Briare | - |

Breakdown: 16 school (including the county board of education and SRJC), 2 county supervisor runoffs, 18 city or town (4 uncontested, 1 with no candidates), 2 fire districts. **26 of 38 have at least one guide pick.**

Not on the ballot: Cotati and Calistoga canceled their council elections because only as many candidates filed as seats (https://www.pressdemocrat.com/2026/08/21/pd-editorial-cotati-calistoga-residents-deserve-an-election/). Cotati City Council has no contest, so the county party's "Cotati City Council – Kimberlyn Moffet" pick has nothing to attach to. Calistoga is in Napa County. No county row offices (Superintendent of Schools, Auditor-Controller-Treasurer-Tax Collector, Clerk-Recorder-Assessor) appear on the November candidates page; the offices page lists them only among contests decided by the June primary.

### Local measures (12)

| Letter | Jurisdiction | Subject (from the county's ballot question PDFs) | Vote | Guides with positions |
|---|---|---|---|---|
| D | Coast Life Support District (Mendocino is lead county) | Emergency medical services parcel tax | 2/3 | Dems Y, Indivisible Y, GOP N |
| E | Waugh SD | $16M school bond | 55% | Dems Y, GOP N |
| G | West Sonoma County Union HSD | Parcel tax renewal, $79/parcel, 8 years | 2/3 | Dems Y, GOP N |
| H | County of Sonoma | Parks sales tax, continue 1/8 cent "until ended by voters", ~$15.5M/yr | 2/3 | PD Y, Dems Y, NBCLC Y, SEIU Y, Greenbelt Y, Indivisible Y, API Y, GOP N |
| I | Town of Windsor | New 1% sales tax, ~$5.7M/yr | Majority | PD Y, Dems Y, NBCLC Y, API Y, GOP N |
| J | Windsor Unified SD | $96M school bond | 55% | Dems Y; GOP "N/A" |
| K | City of Rohnert Park | New half-cent sales tax, ~$5.5M/yr | Majority | PD Y, Dems Y, NBCLC Y, SEIU Y, API Y, GOP N |
| L | City of Santa Rosa | Reauthorize the sales tax at 1 cent, ~$46M/yr | Majority | PD Y, Dems Y, NBCLC Y, SEIU Y, API Y, GOP N |
| M | Harmony Union SD | Parcel tax, $75/yr, 4 years | 2/3 | Dems Y, GOP N |
| N | Schell-Vista Fire Protection District | Appropriations limit (Ordinance 2026-01) | Majority | Dems Y; GOP "N/A" |
| O | Old Adobe Union SD | $48M school bond | 55% | Dems Y, GOP N |
| AB | Sonoma County Junior College District (Sonoma is lead; also on Marin and Mendocino ballots) | $830M facilities bond | 55% | PD Y, Dems Y, NBCLC Y, Indivisible Y, API Y, Sonoma Valley Dems Y, GOP N |

**All 12 measures have a guide position**, because the county party took a position on every one. The county skipped the letter F, and the Coast Life Support (D) and SRJC (AB) letters are shared with Mendocino and Marin (filed-measures page).

### Totals

4 new district contests (CD1, CD4, AD2, AD4) plus 5 widened (CD2, SD2, AD12, BOE 2, Court of Appeal 1). 38 local candidate contests (37 with candidates, 33 contested) and 12 local measures. Under the San Mateo rule (add a local race only when a guide covers it), that is **26 candidate contests and 12 measures**.

---

## 3. Proposed area structure (not implemented)

One county page, modeled on `marin`:

```yaml
id: sonoma
name: Sonoma County
kind: county
order: 80
jurisdictions:
  - { level: state, name: California }
  - { level: county, name: Sonoma }
  - { level: city, name: Cloverdale }
  - { level: city, name: Cotati }
  - { level: city, name: Healdsburg }
  - { level: city, name: Petaluma }
  - { level: city, name: Rohnert Park }
  - { level: city, name: Santa Rosa }
  - { level: city, name: Sebastopol }
  - { level: city, name: Sonoma }
  - { level: city, name: Windsor }
```

`order: 80` puts it after Marin (70). If a Napa or Solano area is added in the same round, agree the order numbers across branches first (two areas with the same order sort by id).

The nine incorporated places are the cities and towns that appear on the county's candidate, measure and filing pages (Cotati appears only in the canceled-election editorial). Windsor is a town; the repo's `level: city` is used for towns elsewhere (Marin's Corte Madera, Fairfax, Ross, San Anselmo, Tiburon).

**No city pages.** Santa Rosa is the only plausible candidate (the largest city in the North Bay), but it has three council seats, two of them uncontested, and one measure (L). Every guide that covers it is a countywide guide; the Santa Rosa Democratic Club republishes the county party's slate. Petaluma has more contests (mayor, three council seats) but also no guide of its own. A city page would add little over the county page, unlike Palo Alto and Mountain View.

Contest ids, following the Marin convention: `us-rep-1`, `us-rep-4`, `assembly-2`, `assembly-4`, `sonoma-county-supervisor-2`, `sonoma-county-supervisor-4`, `srjc-trustee-area-5`, `petaluma-juhsd-trustee-area-3`, `petaluma-juhsd-trustee-area-5`, `santa-rosa-hsd-trustee-area-2`, `sonoma-valley-usd-trustee-area-1`, `windsor-usd-trustee`, `waugh-sd-trustee`, `cloverdale-council`, `healdsburg-council-2`, `healdsburg-council-4`, `petaluma-mayor`, `petaluma-council-1` to `-3`, `rohnert-park-council-2`, `-5`, `santa-rosa-council-2`, `-4`, `-6`, `sebastopol-council`, `sonoma-council-1`, `windsor-mayor`, `windsor-council-1`. Measures: `coast-life-support-measure-d`, `waugh-sd-measure-e`, `west-sonoma-uhsd-measure-g`, `sonoma-county-measure-h`, `windsor-measure-i`, `windsor-usd-measure-j`, `rohnert-park-measure-k`, `santa-rosa-measure-l`, `harmony-usd-measure-m`, `schell-vista-fire-measure-n`, `old-adobe-usd-measure-o`, `srjc-measure-ab`. The city named Sonoma needs care: `sonoma-council-1` is the City of Sonoma, and every countywide id should say `sonoma-county-`.

### Guides to widen to `sonoma`

| Guide | Change |
|---|---|
| nbclc | Add `sonoma` |
| seiu-1021 | Add `sonoma` |
| unite-here-2 | Add `sonoma` |
| ca-wfp | Add `sonoma` |
| pp-norcal-action | Add `sonoma` |
| 350-bay-area-action | Add `sonoma` |
| eqca | Add `sonoma` |
| envirovoters | Add `sonoma` |
| yimby-action | Add `sonoma` |
| courage-california | Add `sonoma`; add `.../county/sonoma` as an `extraSource` |
| greenbelt-alliance | Add `sonoma` |
| lwv-ca | Add `sonoma` (props, by precedent) |

Not widened: mercury-news. The PD reprints four Bay Area News Group statewide editorials (Ma, Allen, Kounalakis, Barrera), so widening mercury-news to Sonoma and also adding the PD would count one editorial board twice in Sonoma. The PD's own statewide editorials (Props 3, 4, 40, 43, 44) are by its own Editorial Board.

---

## 4. Gotchas

- **Contests shared with Marin.** Sonoma County Board of Education TA2 is already in `marin.yml` with `within` Marin only. Sonoma is its home county, so per the runbook ("a district whose first `within` place is in it") it should move to the Sonoma file with `within: [Sonoma, Marin]`, keeping its id `sonoma-county-board-of-education-2` and the existing picks (nbclc, ca-wfp, seiu-1021). Petaluma JUHSD TA3 and SRJC Measure AB were left out of Marin because no Marin guide covered them; both now have guide positions and would go in the Sonoma file with Marin in `within`.
- **Multi-county districts with Napa, Solano and Mendocino.** CD4 (Thompson) and AD4 (Aguiar-Curry) cover Napa and Solano too; CD1 covers counties far north; Coast Life Support District (Measure D) is Mendocino-led; Calistoga JUSD is in a Napa city. If a Napa or Solano pass runs in parallel, the new `us-rep-4` and `assembly-4` must be created once in `ballot.yml`, not on two branches. The PD also endorses on Napa measures (American Canyon P, Napa B).
- **The PD reprints Bay Area News Group statewide editorials** (byline "Mercury News East Bay Times Editorial Boards"), with the same `-2` reprint slugs the Marin IJ used for Allen and Kounalakis. The Index-Tribune and Argus-Courier in turn republish PD editorials under identical slugs. Count only the PD.
- **PD primary editorials look like November picks.** The May editorials for McGuire, Connolly, Lucan, Lemus and Schwedhelm sit in the same editorials index. They are June picks. Only list the 9/18 onward "endorsement-" URLs as sources.
- **Measure letters collide across counties.** Sonoma has D, E, G, H, I, J, K, L, M, N, O and AB. SF has Prop H; Alameda, San Mateo County and Cupertino have a Measure L; Marin has N and O; Napa's American Canyon has P. NBCLC's page lists "Rohnert Park Measure K" in its Sonoma section next to Marin's measures; SEIU lists bare "Measure K - Vote YES" and "Measure L - Vote YES" under a SONOMA COUNTY heading. Contest ids must carry the jurisdiction.
- **"Sonoma" is both the county and a city.** "Sonoma City Council, District 1" (Mackie) is the City of Sonoma. "Sonoma County Office of Education" (WFP) is the County Board of Education TA2 contest.
- **Name collisions and variants to alias:**
  - NBCLC writes "Susan Adams" for Rohnert Park D5 (Susan Hollingsworth Adams) **and** for Fairfax Town Council in Marin (Susan Denise Adams), on the same page.
  - "Thompson" is both Mike Thompson (CD4) and Janice Cader Thompson (Petaluma D1); surname matching will cross them.
  - Linda (Khoury) Tams = "Linda Khoury Tams" (NBCLC, Dems), "Khoury Tams" (PD), "Linda Khouty Tams" (Santa Rosa Dem Club PDF).
  - Melanie Jones-Carter = "Melanie Jones Carter" (NBCLC), "Melanie Jone Carter" (API club).
  - Eric Vazquez = "Eric Vasquez" (UNITE HERE 2).
  - Shaun A. Du Fosee = "Shaun Du Fosse" (NBCLC).
  - Sarah Seitchik Sebastian = "Sarah Seitchik" (WFP, name split across lines).
  - Mathew Lopez = "Mathew López" (PD).
  - Sandra Maurer = "Sandra Murer" (Santa Rosa Dem Club PDF).
  - Patricia "Trish" Donoho = "Trish Donoho" (Dems).
  - Janice Cader Thompson = "Janice Cader-Thompson" (club PDF).
  - Susan Joyce McIntosh = "Susan McIntosh"; Christine D. Pieper = "Christine Pieper" / "Christin Pieper"; Cecilia M. Aguiar-Curry = "Cecilia Aguiar-Curry"; Jared Huffman = "Jare Huffman" (API club).
- **Label variants.** Guides call PJUHSD "Petaluma City Schools", the City of Santa Rosa High SD "Santa Rosa City Schools", and SRJC "Santa Rosa College District" or "Sonoma County College District". SEIU calls the County Board of Education seat "District 2"; WFP calls it "Sonoma County Office of Education". The API club spells Rohnert Park "Ronhnert" and Petaluma "Petuluma".
- **Picks with no contest.** NBCLC: SRJC Maggie Fishman and Ezrah Chabaan, Roseland SD Anthony Mendoza. County party: Cotati City Council Kimberlyn Moffet (election canceled).
- **NBCLC's council lines omit district numbers for Cloverdale and Sebastopol** (at-large, fine) but WFP's omit them for Healdsburg, Petaluma and Santa Rosa, which have districts. The candidate names resolve them.
- **Image-only guides.** sonoma-gop (two PNGs, no link text) and sonoma-farm-bureau (one PNG) need `manual: true` or hand entry, like smc-dems and svgop.
- **The county party's statewide picks are not on its web page.** They appear only in the Santa Rosa Democratic Club's copy of the slate (PDF). CADEM's statewide picks are the usual fallback.
- **The Santa Rosa Democratic Club PDF has small errors in its measure summaries** (Measure J "$92 million", the county says $96,000,000; Measure M "$50/year", the county says $75). Its picks are unaffected.

## 5. Unverified, and decisions for Sean

Unverified:
- Sonoma County Conservation Action's 2026 slate exists (the PD cites one endorsement) but no current website was found.
- North Bay Bohemian, Sonoma West Times (site down), Healdsburg Tribune and Kenwood Press (e-editions not read), Latino PAC of Sonoma County, Sonoma County Alliance, building trades, DSA, Green Party and three Facebook-only Democratic clubs.
- Which Sonoma cities each CD, SD and AD covers (not needed without city pages).
- Whether Two Rock Union SD, Calistoga JUSD or other school districts have voters in Marin or Napa; only the Marin cross-county items listed in `Marin-Candidates-Nov2026.txt` and the measure lead-county notes were checked.
- The remaining pages of the Santa Rosa Democratic Club PDF and of Indivisible's Substack props post (both read in part).

Decisions:
1. **Which local contests to add.** All 38 candidate contests and 12 measures, or only the 26 and 12 that some guide covers (the San Mateo rule, as for Marin)?
2. **Move `sonoma-county-board-of-education-2` out of `marin.yml`** into the Sonoma file with `within: [Sonoma, Marin]`, and add PJUHSD TA3 and SRJC Measure AB with Marin in `within`.
3. **Duplicate club slates.** Skip the Santa Rosa Democratic Club and Sonoma Valley Democrats as guides (they republish the county party), or use the Santa Rosa club's PDF as an `extraSource` for `sonoma-dems` to capture the party's statewide picks?
4. **Sonoma County Farm Bureau** as a guide: it is an industry group with one image, and the repo has no business type (advocacy is closest).
5. **Indivisible Sonoma County** as a guide, following the `indivisible-marin` precedent. Its sources are spread over a web page, two Drive PDFs and a Substack post.
6. **Area order and coordination** with any Napa or Solano branch for `us-rep-4`, `assembly-4` and area `order` numbers, and with the guide-widening pass (twelve shared guides gain `sonoma`; expect conflicts on their `areas:` lines).
7. **The PD as a rolling source.** Like the Marin IJ, new editorials need adding to its `extraSources` as they appear (CD1, AD12 and the supervisor runoffs are still to come).

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
