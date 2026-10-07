# Bay Ballot Contra Costa discovery: guides and ballot (Nov 3, 2026)

Researched 2026-10-07. Follows the structure of `2026-10-06-peninsula-guide-discovery.md`. Research and data scaffolding only: no extraction was run and nothing in `data/guides` or `data/2026-11/endorsements` was changed.

**Status labels**
- **Verified**: the URL was loaded on 2026-10-07 and showed Nov 3, 2026 general-election picks.
- **Unverified**: could not be confirmed. The reason is given in each case.

**Access notes** (curl with a desktop Chrome user agent)
- Every new guide page in the tables below returned 200 to curl, except the ones listed here.
- `sierraclub.org` gets stuck in a redirect loop under curl. It loads in a browser (the existing guide already uses `fetchWith: browser`).
- `ebar.com` (Bay Area Reporter) returns 403 to curl and to WebFetch. It loads in a browser.
- `richmondstandard.com` returns 403 to both curl and a browser.
- `bluevoterguide.org` is behind a Cloudflare "Just a moment" check. It would need a real browser. It may list Teamsters Joint Council 7 and other union picks.
- `eastbaytimes.com` returns 200 to curl but refuses WebFetch.
- Two sites fail outright: `ccar.com` (Contra Costa Association of Realtors) fails the TLS handshake, and `ppactionca.org` returns a Cloudflare 526.
- `contracostavote.gov` (county elections) returns 200 to curl, and so does its JSON feed.

## Traps found while researching

| Looks like | Actually |
|---|---|
| `cocodems.org` is the county Democratic Party | That is Columbia County, Wisconsin. The CoCo party is **https://contracostadems.com**. |
| `ccrp.org` / `contracostagop.org` is the county GOP | Neither is. The party is **https://cocorepublicans.org**. Its `/endorsements` link is a 404, and its picks are two PNGs linked from the homepage. |
| `cclabor.org` is the Labor Council | It doesn't resolve. The council is **https://www.cclabor.net**. |
| `wccdems.org` and `westcountydemocrats.org` are West County clubs | They are in Pennsylvania and Missouri. The CoCo club is **westcountydemocraticclub.com**. |
| `eastcountytoday.net` | A dead archive. The publisher moved to **contracosta.news**. |
| SEIU 1021's `/2026endorsements` (the guide's `previousElectionLink`) | That is the **June** page. November is **https://www.seiu1021.org/post/election-endorsements-nov-3-2026** (posted 9/28), which the endorsement file already uses as `source`. |
| East Bay Times endorsements are a separate board | The East Bay Times and Mercury News share one board (Bay Area News Group). Same editorials, same slugs; the eastbaytimes.com pages declare the mercurynews.com version as canonical. Widen `mercury-news`; don't add a second guide. |
| The East Bay Times endorsement page has CoCo picks | All of its CoCo items are from **June**: Urban Limit Line, Clerk Connelly, No on county sales tax, CCCCD Measure G, Assessor Robb, Superintendent Eaton. November has statewide picks only. |
| Guides endorsing Richmond City Council (Sierra Club: Robinson, Zepeda; 350 Bay Area: Robinson) | Richmond held its first primary on June 2. All three council seats (D2 Zepeda, D3 Robinson, D4 Bana) were won outright in June. **Only Mayor** goes to the November runoff (Jiménez vs Anderson). Ignore the council picks. |
| Guides endorsing Martinez Mayor and D4, Oakley D4, Martinez USD, Pittsburg USD, WCCUSD 4/5, EBMUD 2/4, BART 2, AC Transit 1, Stege, West County Wastewater, Ambrose | All of these are **uncontested and not on the ballot** (appointed in lieu of election). Drop those picks. |
| YIMBY Action "Moraga Mayor: Kerry Hillis" | Moraga has no elected mayor on the ballot. Hillis is a candidate for Moraga Town Council (vote for 2). Map the pick to the council race. |
| The Lamorinda Democratic Club lists candidates | Its images list **every** Democrat on the ballot. Only the names with a **green checkmark** are endorsements. |
| Bay Rising Action candidate picks | They copy CA WFP's slate. Counting both double-counts. |

---

## 1. Guide table

Abbreviations: CoCo = Contra Costa County, CCCCD = Contra Costa Community College District, EBRPD = East Bay Regional Park District, MOFD = Moraga-Orinda Fire District, MDUSD = Mt. Diablo USD. "Reasons" means the guide explains each pick. "List" means it gives picks only.

### Newspapers

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage | Paywall |
|---|---|---|---|---|---|---|---|
| East Bay Times / Mercury News (existing `mercury-news`) | newspaper | https://www.eastbaytimes.com/opinion/endorsements/ (same list as https://www.mercurynews.com/opinion/endorsements/) | **Statewide only.** Lt Gov Ma (9/25), Insurance Commissioner Allen (9/26), Treasurer Kounalakis (9/29), Superintendent Barrera ([10/7](https://www.mercurynews.com/2026/10/07/endorsement-elect-richard-barrera-californias-superintendent-of-public-instruction-november-election-california-public-schools-sonja-shaw/)). No RTM, props, Congress, Assembly or local picks yet. | Yes | HTML | statewide | Metered |
| ContraCosta.news (publisher Mike Burkholder) | newspaper | [Brentwood](https://contracosta.news/2026/10/05/editorial-bishop-mello-and-zickuhr-give-brentwood-the-reset-it-needs/), [Pittsburg](https://contracosta.news/2026/10/05/editorial-pittsburg-must-look-at-the-big-picture-not-a-pixel/), [Antioch](https://contracosta.news/2026/10/05/editorial-the-antioch-endorsements-i-never-thought-id-make/) (all 10/5) | **Yes, rolling.** Brentwood D2 Zickuhr, D4 Bishop-Mello. Pittsburg council: Adams and Croskey; the third seat is a "coin flip" between Kobata and Johnson, so record no pick for it. Antioch D1 Torres-Walker, D4 M. Wilson. | Yes (long) | HTML | East County | None |
| SF Chronicle (existing `sf-chronicle`) | newspaper | https://www.sfchronicle.com/projects/2026/california-sf-election-endorsements/ | Partial: RTM Yes, statewide offices, some props. BOE D2 "It's complicated". No CoCo district or local picks. | Yes | HTML | RTM, statewide | Metered |
| Bay Area Reporter (existing `bay-area-reporter`) | newspaper | [Council picks](https://www.ebar.com/story/170347/Opinion/Editorial/Editorial%3A%20B.A.R.%20endorses%20city%20council%20candidates) (9/16), [RTM](https://www.ebar.com/story/170564/Opinion/Editorial/Editorial%3A%20B.A.R.%20endorses%20SF%2C%20regional%20measures) (9/23), props https://www.ebar.com/story/170969/ (10/7) | Yes. **Concord D3 Kuslits** (it says "more soon"), RTM Yes, props, statewide. | Yes | HTML | Concord D3, RTM | None; **403 to curl** |

Checked, no 2026 endorsements:
- DanvilleSanRamon.com endorsed in 2020 and 2022, then became a nonprofit in 2024. No 2026 endorsements so far.
- Richmondside is a nonprofit and publishes no editorials.
- Lamorinda Weekly has no editorial section.
- The Press (Brentwood) has a published policy of not endorsing.
- No endorsements at: Contra Costa Herald, Claycord, Martinez Tribune, Walnut Creek Patch, Grandview Independent, Diablo Gazette, CC Pulse.
- theorindanews.org doesn't resolve.
- Richmond Standard: blocked (403), unverified.

### Parties

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage |
|---|---|---|---|---|---|---|
| Democratic Party of Contra Costa County | party | https://contracostadems.com/endorsements/ | **Yes** (no date). Every Dem district candidate. Countywide: Board of Ed 2, CCCCD 1 and 3, EBRPD 7, EBMUD 3 and 7. About 40 city, school and special-district picks across West, Lamorinda/San Ramon Valley, East and Central county. **Richmond Mayor: Ahmad Anderson.** Yes on RTM, O, Q, S, T, V, W, X. No position on M, N, P, R, U. No state props. | List; each measure links an "Our Position" Google Doc | HTML (+ Google Docs) | Broadest local coverage found |
| Contra Costa Republican Party | party | https://cocorepublicans.org/ homepage, which links [combined guide PNG](https://irp.cdn-website.com/0af916fd/files/uploaded/combined_guide_2.png) and [local recs PNG](https://irp.cdn-website.com/0af916fd/files/uploaded/Local+Recommendations+-+Nov+2026-7f4e9d7b.png) | **Yes** (no date). Statewide and Republican district candidates. No on RTM; prop picks. Local: CCCCD 3 Tanovitz, Board of Ed 2 West, Danville, Acalanes 1, Diablo CSD, Antioch, Brentwood D2/D4, Brentwood Union, Liberty UHSD 4, Knightsen. **No** on every Supreme Court and 1st District retention. No city-measure positions. | List | **PNG images only** | Statewide, district, some local |
| CA Working Families Party (existing `ca-wfp`) | party | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf (14 MB) | Yes. BOE2 Lieber; Antioch D1/D4; Antioch USD 5; CCCCD 1 and 3; Concord D5; Pinole Lam-Julian; Richmond Mayor Jiménez (plus Pittsburg USD, which is off-ballot). Props. No RTM found. | List | PDF | Local |
| Peace and Freedom Party | party | https://www.peaceandfreedom.us | No CoCo slate | — | — | none |

### Clubs

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage |
|---|---|---|---|---|---|---|
| Democrats of Rossmoor | club | https://democratsofrossmoor.org/endorsements/ | **Yes** ("recommendations for November 2026"). Walnut Creek council Khaund, Moran; Walnut Creek SD Gatty, King; Board of Ed 2 Butler; Yes on W, T, RTM; no recommendation on U; props. (It also lists EBMUD Ward 2, which is off-ballot.) | One-line description per item, and shows the LWV position next to it | HTML table | Walnut Creek |
| El Cerrito Democratic Club | club | [Statewide slate](https://ecdclub.org/november-3-election-endorsements/) (7/25); [local and measure vote results](https://ecdclub.org/endorsements-vote-results/) (8/31) | **Yes.** El Cerrito council: Wysinger only (the 60% bar). Yes on V and RTM; props. CD8 Garamendi and statewide offices. | Vote tallies only | HTML | El Cerrito |
| West County Democratic Club | club | https://www.westcountydemocraticclub.com/endorsements | **Yes** ("November 3, 2026"). CCCCD 1 **Donoso** (the county party picked Sasai); EBRPD 7; El Cerrito, Hercules, Pinole, San Pablo councils; Richmond Mayor **Anderson** (mislabeled "City Council"); EBMUD Young (mislabeled "Area 1"; it is Ward 3); John Swett; Yes on V and Prop 4. | Short paragraphs on V and Prop 4 only | HTML (Wix) | West County |
| Lamorinda Democratic Club | club | https://ldclub.org/2026-voter-guides/ (city pages /orinda/, /moraga/, /danville/, /walnut-creek/, /lafayette/, /martinez/, /pleasant-hill/, /alhambra/, /briones-hills/) | **Yes** (images uploaded October 2026). Checkmarked: Board of Ed 2 Butler, EBMUD 3 Young, Acalanes 1 Iyengar, Orinda council Malkani, Orinda USD Collins Coleman, MOFD 3 Donnelly and 4 Stevens, Moraga council Hillis, RTM Yes, W Yes. The Lafayette, Martinez, Pleasant Hill, Alhambra and Briones Hills images were **not read**. | List | **JPG images only** | Lamorinda, Central |
| Contra Costa Jewish Democrats | club | https://www.ccjewishdems.org/endorsements | **Probably** November: there is no election label, but every pick matches a November race. Richmond Mayor Anderson; CCCCD 3; MDUSD 2; Board of Ed 2; MOFD 3; Moraga; Orinda; El Cerrito; Yes on W. | List | HTML | Mixed |
| East Bay DSA | club | https://vote.eastbaydsa.org/simple-guide.html (no-JS version of https://vote.eastbaydsa.org) | **Yes.** Richmond Mayor Jiménez. Yes on N, O, Q, S, V, W, X. RTM Yes and Props 3 and 40 come from CA DSA. | **Yes** | HTML | Richmond, measures |
| Richmond Progressive Alliance | club | https://www.richmondprogressivealliance.net | **Unverified.** The site has no endorsements page (/endorsements, /voter-guide and /news are all 404). Its endorsement of Jiménez is reported only in news coverage. | — | — | — |

Checked, nothing for Nov 2026:
- Diablo Valley Dems (dvdems.org) still shows its 2024 list.
- srvdems.org and deltademocrats.org don't resolve.
- No endorsements on the sites of: East Contra Costa Democratic Club, Kensington Dems, Marsh Creek Dems, Contra Costa Young Dems, Indivisible East Bay, Green Party of California.
- No Republican clubs were found.

### Labor

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage |
|---|---|---|---|---|---|---|
| Contra Costa Labor Council, AFL-CIO | union | https://www.cclabor.net/2026 (printable version: Google Drive PDF linked from the page) | **Yes** (no date). Props. Councils in 13 cities, including **Richmond Mayor Jiménez**. CCCCD, Board of Ed, school boards, EBRPD, EBMUD, MOFD. Yes on RTM, O, Q, S, V, W, X. Includes many off-ballot seats. Concord D3: Acosta Beere. CCWD 2: dual endorsement (Fitzpatrick or Picard). | List | HTML; **federal, state and legislative picks are headshot images** | Broad |
| SEIU 1021 (existing `seiu-1021`) | union | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 (9/28) | **Yes**; the page has a Contra Costa section. AD11, AD14, AD16; BOE2; RTM Yes; Richmond Mayor Jiménez; El Cerrito; Antioch D1/D4 and Antioch USD 5; **Concord D3 dual (Kuslits and Acosta Beere)**; Concord D5; San Ramon D4; CCCCD 1 and 3; EBMUD 3; San Pablo **S Yes**. | List | HTML | Local |
| IFPTE Local 21 | union | https://ifpte21.org/endorsements/ | **Yes** ("2026 General Election"). Richmond Mayor Jiménez; EBMUD 3 and 7 (and the off-ballot Wards 2 and 4); AD16; BOE2; RTM Yes; props. | List | HTML | Thin |
| UNITE HERE Local 2 | union | https://www.unitehere2.org/2026/09/november-2026-election-endorsements/ | **Yes** (Sept). Concord D5 Nakamura, Richmond Mayor Jiménez, RTM Yes. | List | HTML | Thin |

No site or no 2026 slate was found for:
- Contra Costa Building Trades: no site; its only trace is DeSaulnier's campaign site.
- Teamsters JC7: listed only on bluevoterguide, which blocks bots.
- United Teachers of Richmond and Mt. Diablo Education Association.
- IAFF Local 1230 (domain doesn't resolve) and Richmond Local 188.
- CNA.

### Advocacy

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage |
|---|---|---|---|---|---|---|
| Contra Costa Taxpayers Association (CoCoTax) | advocacy | https://cocotax.org/ballot-positions/ (announced 8/16) | **Yes.** The **only guide that covers every CoCo local measure.** Oppose RTM (it sponsors the No campaign), M, O, P, Q, R, S, T, V, W, X. Support N. No position on U. Props. | List (rationale for RTM only) | HTML table | All measures |
| Sierra Club SF Bay (existing `sierra-club-sf-bay`) | advocacy | https://www.sierraclub.org/sfbay/2026-endorsements | **Yes.** CD10; AD16; RTM Yes; CCCCD 3; EBMUD 3 and 7; EBRPD 7; Concord D3 Kuslits and D5 Nakamura; El Cerrito; San Ramon D4; Richmond Mayor Jiménez; props. CoCo items are mixed into each category (no CoCo heading). | Yes, on the existing explanations page | HTML (browser) | Local |
| Courage California (existing `courage-california`) | advocacy | https://www.progressivevotersguide.com/california/2026/general/county/contracosta (updated 9/14) | **Yes.** CD8/9/10; AD11, 14, 16; **AD15 "No Recommendation"**; BOE2; statewide; props; Richmond Mayor Jiménez. **No RTM.** | Yes | HTML | District, Richmond |
| YIMBY Action (existing `yimby-action`) | advocacy | the existing source URL | **Yes.** AD11 Wilson, AD14 Wicks, RTM Yes (names CoCo), Moraga Hillis (listed as "Mayor"), props. No position on Walnut Creek U. | Partial | HTML | Thin |
| Greenbelt Alliance (existing `greenbelt-alliance`) | advocacy | https://www.greenbelt.org/voter-guide-26/ | **Yes**: Walnut Creek **U Yes**, RTM Yes, props | Yes | HTML | U, RTM |
| Bay Rising Action (existing `bay-rising-action`) | advocacy | https://bayrisingaction.org/voterguide/ | **Yes**: RTM Yes, San Pablo **S Yes**, props; candidate picks copied from CA WFP | Partial | HTML | S, RTM |
| Housing Action Coalition (existing `housing-action-coalition`) | advocacy | https://housingactioncoalition.org/news/nov-2026-endorsements | June-round picks that still apply: AD11, AD14, AD15 | List | HTML | District only |
| Equality California | advocacy | https://www.eqca.org/our-endorsements/ | **Yes.** CD8/9/10; AD11, AD14, AD15, AD16; BOE2; Governor; Concord D3 Kuslits; El Cerrito Quinto; San Ramon D4 Rubio; props | List | HTML | District, some local |
| Planned Parenthood NorCal Action Fund | advocacy | https://www.plannedparenthoodaction.org/planned-parenthood-northern-california-action-fund/endorsements | **Yes.** AD11, AD14, AD15, AD16; Antioch D1/D4; Concord D1 Bagley; San Ramon D4; Walnut Creek Khaund, Moran | List | HTML | Local |
| 350 Bay Area Action | advocacy | https://350bayareaaction.org/electoral/endorsements-2026 (props, joint with 350 Contra Costa: https://350contracostaaction.org/california-ballot-propositions-2026-our-guide/) | **Yes, but June and November are mixed on the page.** November: CD8, CD10, AD16; Antioch D1/D4; Concord D1/D3/D5; Pittsburg council Shephard; San Ramon D2 Adler, D4 Rubio; Orinda Malkani; CCCCD 1 Sasai. Drop the June items (Measure A, Supervisors Gioia and Carlson, EBMUD 2) and the Richmond D3 pick. | Yes ("Read more") | HTML | Local |
| California Environmental Voters | advocacy | https://envirovoters.org/2026-endorsements/ | **Yes**: CD8/9/10, AD16, BOE2, statewide | List | HTML | District only |
| Bike East Bay | advocacy | https://bikeeastbay.org/election2026/ | **Yes**: RTM Yes, Props 43 and 45 No. A 501(c)(3), so it endorses no candidates. | Yes | HTML | RTM only |
| East Bay Housing Organizations | advocacy | https://ebho.org/2026-campaign-endorsements/ (8/13) | Yes: RTM, Props 1 and 43. No CoCo city picks. | List | HTML | RTM only |
| Lift Up Contra Costa Action | advocacy | https://liftupcocoaction.com/ | **Announced, not published.** It is a coalition of ACCE Action, CBE Action, the CC Labor Council, SEIU 1021 and others. Its process opened 8/7, and its "Our Candidates" page is empty. | — | — | Watch: could become the main progressive CoCo slate |

Checked, nothing for CoCo:
- East Bay YIMBY: "No current endorsements".
- YIMBY Action has no CoCo chapter.
- LCV East Bay looks dormant (newest page 2016).
- Save Mount Diablo: no CoCo positions for November.
- Sunflower Alliance: Prop 45 only.
- Contra Costa Climate Leaders runs a scorecard, not endorsements.
- Seamless Bay Area: RTM support, no guide.
- TransForm: none found.
- Walk Bike CC: DNS fails.
- ACCE Action: endorsements page is a 404. It co-leads the Measure S campaign.
- Reproductive Freedom for All: federal picks only.
- Moms Demand: 404.
- CCSA Advocates: nothing for CoCo.

### Civic (Leagues don't endorse candidates)

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | CoCo coverage |
|---|---|---|---|---|---|---|
| LWV Bay Area | civic | https://my.lwv.org/sites/default/files/2026_nov_regional_transit_measure_vwtl.pdf | **Yes: RTM Support** (the PDF is undated). A separate pros/cons PDF is impartial. | Yes | PDF | RTM only |
| LWV Diablo Valley | civic | https://my.lwv.org/california/diablo-valley (lwvdv.org is the old domain) | **Pending.** It reposts the LWVC props. Its October newsletter says the board "discussed proposed endorsements" on Walnut Creek **U** and Acalanes **W**. | — | HTML | Watch |
| LWV West Contra Costa | civic | my.lwv.org page (lwvwcc.org doesn't resolve) | No November positions | — | — | none |
| LWV California (existing `lwv-ca`) | civic | https://lwvc.org/ballot-recommendations-nov-3-2026/ | Yes (props) | Yes | HTML | props |
| SPUR (existing `spur`) | civic | the existing source URL | Yes (RTM and props) | Yes | HTML | RTM, props |

Not guides:
- Bay Area Council leads the RTM campaign.
- The Richmond Chamber says it doesn't endorse.
- No posted PAC picks: the Concord, San Ramon, Antioch and Pittsburg chambers, and the East Bay Leadership Council.
- The Walnut Creek Chamber's and Contra Costa Council's domains don't resolve.
- The Walnut Creek City Council considered positions on W, T and RTM on 10/6. It is a government body, not a guide.

### Counts

| | Count |
|---|---|
| New guides with Nov 2026 CoCo picks (published) | **20**: CoCo Dems, CoCo GOP, CC Labor Council, ContraCosta.news, CoCoTax, Democrats of Rossmoor, El Cerrito Dem Club, West County Dem Club, Lamorinda Dem Club, CC Jewish Dems, East Bay DSA, IFPTE 21, UNITE HERE 2, Equality California, PP NorCal Action Fund, 350 Bay Area Action, CA Environmental Voters, Bike East Bay, EBHO, LWV Bay Area |
| Existing guides to widen to `contra-costa` | **13**: sierra-club-sf-bay, seiu-1021, ca-wfp, courage-california, yimby-action, greenbelt-alliance, bay-rising-action, housing-action-coalition, lwv-ca, spur, mercury-news (East Bay Times), sf-chronicle, bay-area-reporter |
| Guides with CoCo **local** picks (city, school, special district or local measure) | **24** of the 33 above |
| Pending or announced | **4**: Lift Up Contra Costa Action, LWV Diablo Valley (U, W), East Bay Times local picks, more ContraCosta.news cities. Plus RPA (unverified). |
| Image-only, needing manual entry | CoCo GOP (PNG), Lamorinda Dem Club (JPG, checkmarks), CC Labor Council (federal and state headshots) |

**Richmond Mayor split.** Anderson: CoCo Dems, West County Dem Club, CC Jewish Dems. Jiménez: Labor Council, SEIU 1021, CA WFP, East Bay DSA, IFPTE 21, UNITE HERE 2, Sierra Club, Courage California (RPA unverified). This is the most-endorsed CoCo local race.

---

## 2. Ballot contests

Full redacted extracts are in `data/2026-11/sources/CCC-Candidate-List-0827.txt` (name and ballot designation only) and `data/2026-11/sources/CCC-Measures-Nov2026.txt`.

### Sources and machine-readability

**Contra Costa County Clerk-Recorder-Elections** (curl 200, no bot wall)
- Election page: https://www.contracostavote.gov/election/november-3-2026-general-election/ (election ID 66).
- Its "List of candidates and measures" tab loads a JSONP feed:
  - `https://www.contracostavote.gov/ce/mobile/seam/resource/rest/election/getElection?eid=66&lang=en&callback=cb`
  - plus `getOfficeCandidates?eoid=<id>` and `getQuestion?qid=<id>` on the same path.
  - It is the easiest machine source, but see the discrepancies below.
- PDFs, linked from https://www.contracostavote.gov/elections/candidates-campaigns-measures/:
  - `8-27-26_candidatelist_detail_final.pdf`: "Contest/Candidate Proof List", contests on the ballot with designations, printed 8/27/2026. **Authoritative for names.**
  - `8-14-26_candidatelist_summary_final.pdf`: every local filing, including contests that are off the ballot, printed 8/14/2026.
  - `26Nov03_Measure-Wording-List-1.pdf`: measure wording, updated 8/10/26.
  - `26Nov03_PositionsUpForElection.pdf` (2/11/26) and the extension list (8/11/26).
  - `26Jun02_PositionsUpForElection_OfficeOnly.pdf`: shows Richmond Mayor and D2–4 on the June ballot.
- State: https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf (8/27/2026). It is byte-identical to `data/2026-11/sources/CA-Certified-Candidates-Nov2026.pdf`.

**Discrepancies in county data**
- The JSON feed labels **San Ramon Mayor** as "City of Richmond, Mayor" (office ID 1623). The PDF has it right.
- Name spellings differ between the feed and the 8/27 PDF. Use the PDF:
  - Matty vs Matt Avery
  - Watson-Alavarado vs Watson-Alvarado
  - Matthews vs Mathews Alappat
  - Stacy vs Stacey Schweppe
  - Pabon-Alvarado vs Pabon Alvarado
  - Steven vs Steve Lichliter
- Arthur Webb (AD15) is "Democratic" in the county feed but **No Party Preference** on the SoS certified list. The SoS list is authoritative.
- **Livermore Valley JUSD Area 3** (Brady vs Gibson) is on the county PDF but not the county website. Alameda County administers it. Unverified whether any CoCo voter gets it.

### State and federal districted contests

| Contest | Candidates | Existing id? |
|---|---|---|
| CD8 | Garamendi (D) vs Recile (R) | new |
| CD9 | Harder (D) vs McBride (R) | new |
| CD10 | DeSaulnier (D) vs Frese (R) | new |
| AD11 | Lori D. Wilson (D) vs Jenny Leilani Callison (NPP) | new |
| AD14 | Buffy Wicks (D) vs Rendon (Green) | new |
| AD15 | Anamarie Ávila Farías (D) vs Arthur Webb (NPP) | new |
| AD16 | Rebecca Bauer-Kahan (D) vs Rubay (R) | new |
| BOE D2 | Lieber vs Pimentel | `board-of-equalization-2`: add CoCo to `within` |
| 1st District Court of Appeal (11 justices) | retention | `court-of-appeal-1`: add CoCo to `within` |
| RTM | Connect Bay Area transit tax, lettered **RTM** on the CoCo ballot | `rtm`: add CoCo to `within` |

- **State Senate:** none. The county's June list says no CoCo Senate districts are up in 2026.
- **BART:** only D2 is up, and Foley is unopposed, so it's off the ballot.
- **AC Transit:** only Ward 1 (short term) is up, and Sandhu is unopposed, so it's off the ballot.

Statewide contests and Props 1–5 and 37–45 are already in `ballot.yml`, keyed to `level: state`.

### Local contests on the CoCo ballot (58)

There are **no county offices** on the November ballot. Supervisors D1 and D4, Assessor, Auditor, Clerk-Recorder, Treasurer and Superintendent of Schools were all decided in June, with no runoffs. DA and Sheriff move to 2028.

| Category | Contests |
|---|---|
| City (30) | Antioch D1, D4. Brentwood D2, D4. Clayton (vote 2). Concord D1, D3, D5, Treasurer. Danville (2). El Cerrito (2). Hercules (2). Martinez D1. Moraga (2). Orinda (3). Pinole (3). Pittsburg council (3; 11 candidates), Clerk, Treasurer. Pleasant Hill D3, D4. **Richmond Mayor** (Jiménez vs Anderson). San Pablo council (2), Clerk, Treasurer. San Ramon Mayor, D2, D4. Walnut Creek council (2), Treasurer. |
| School (16) | County Board of Ed 2 (West, Butler, Minighini). CCCCD Ward 1 (Donoso vs Sasai), Ward 3 (Barrett vs Tanovitz). Antioch USD 5. John Swett USD (2). MDUSD 2, 4. San Ramon Valley USD 5. Acalanes UHSD 1. Liberty UHSD 4. Brentwood Union (3). Knightsen (2). Oakley Union ESD 4. Orinda Union (3). Walnut Creek SD (3). Livermore Valley JUSD 3 (unverified, see above). |
| Special district (12) | Central San Div 2. Contra Costa Water District Div 2. Diablo CSD (3). Dublin San Ramon Services District Div 2. EBMUD Ward 3, Ward 7. EBRPD Ward 7. Ironhouse Sanitary (2). MOFD Div 3, Div 4. Mt. View Sanitary. Pleasant Hill Rec & Park (3). |

- 52 of the 58 are contested.
- Six are uncontested but still printed on the ballot: the Concord, Pittsburg, San Pablo and Walnut Creek Treasurers, the San Pablo Clerk, and Walnut Creek council (2 candidates for 2 seats).
- **Off the ballot:** 61 uncontested contests, plus two with no filers (Canyon ESD and Rodeo Sanitary). Moraga SD (2 filers for 3 seats) is off as well. Lafayette and Oakley have no city contests on the ballot.

### Local measures (12 + RTM)

| Letter | Jurisdiction | Summary | Threshold |
|---|---|---|---|
| M | Clayton | 1% sales tax | Majority |
| N | Clayton | Landscape maintenance special tax ($354.45) | 2/3 |
| O | Concord | Business license tax update | Majority |
| P | Hercules | 1% sales tax | Majority |
| Q | Richmond | $120M fire facilities bond | 2/3 |
| R | San Pablo | Temporary ½¢, then ¼¢, sales tax | Majority |
| S | San Pablo | Rent stabilization | Majority |
| T | Walnut Creek | Make the City Treasurer appointive | Majority |
| U | Walnut Creek | Senior housing rezoning (developer-sponsored) | Majority |
| V | West Contra Costa USD | Parcel tax renewal | 2/3 |
| W | Acalanes UHSD | $168 parcel tax | 2/3 |
| X | Liberty UHSD | $165M bond | 55% |

There are no county measures.

**Ballot size for a `contra-costa` page:** about 16 state/federal contests, 2 retention items, 14 props, RTM, 58 local contests and 12 local measures.

Under the existing naming, the new contest ids would be like `concord-council-3`, `richmond-mayor`, `cccd-ward-1`, `ebmud-ward-3`, `walnut-creek-measure-u`, `wccusd-measure-v` and `us-rep-10`. No collision with existing ids or area ids was found.

---

## 3. Proposed area structure

**Recommendation: one county area, `contra-costa` ("Contra Costa County", kind `county`), and no separate city pages yet.**

- Jurisdictions:
  - `{ level: state, name: California }`
  - `{ level: county, name: Contra Costa }`
  - one `city` entry for each of the 19 cities: Antioch, Brentwood, Clayton, Concord, Danville, El Cerrito, Hercules, Lafayette, Martinez, Moraga, Oakley, Orinda, Pinole, Pittsburg, Pleasant Hill, Richmond, San Pablo, San Ramon, Walnut Creek.
- This is the same pattern as `san-mateo`. District contests (CD, AD, CCCCD, EBMUD, EBRPD, MOFD, etc.) carry `within: [{ level: county, name: Contra Costa }]`.
- **Richmond doesn't merit its own page yet.** It has one candidate contest (Mayor) and two measures (Q; V is WCCUSD-wide). Mayor is the most-endorsed local race, but the county page's place filter covers it. Revisit if Lift Up Contra Costa or RPA publish deep Richmond slates.
- Walnut Creek is the next densest: council, Treasurer, T, U and Walnut Creek SD, with Rossmoor, Lamorinda, Greenbelt, CoCoTax and PP covering it. It still doesn't need its own page.
- **Cross-county districts:** EBMUD, EBRPD and CCCCD wards, and BOE D2, span Alameda or other counties. Alameda County is not on the site, so `within: [Contra Costa]` alone is fine for now.
- **Not researched:** ZIP routing for CoCo. 94507 (Alamo), 94595 (Rossmoor/Walnut Creek) and unincorporated areas have no city contests.

---

## 4. Gaps, unverified items and decisions for Sean

1. **Decision: which minor guides to include.**
   - Measure- or RTM-only guides: Bike East Bay, EBHO, LWV Bay Area.
   - Low-volume unions: IFPTE 21, UNITE HERE 2.
   - CC Jewish Dems: the page carries no election label.
   - Suggested floor: include a guide if it has at least one CoCo local pick, or has a pick on RTM or a prop that the site isn't already getting from a bigger guide.
2. **Decision: CoCoTax.** It is the only guide covering every local measure, and it is a single-viewpoint anti-tax group. The type is `advocacy`, and the description should say so plainly.
3. **Decision: ContraCosta.news** is one publisher's signed "my vote" editorials, not a board. Type `newspaper` with a description that says this, or `advocacy`?
4. **Image-only guides** need `manual: true`:
   - CoCo GOP (2 PNGs)
   - Lamorinda Dem Club (about 36 JPGs; only checkmarked names count; 5 cities unread)
   - CC Labor Council (federal and state headshots; the local list is text)
5. **Off-ballot picks.** Many guides endorse uncontested seats (Martinez Mayor/D4, Oakley D4, EBMUD 2/4, WCCUSD 4/5, Pittsburg USD, Stege, BART 2, AC Transit 1) or Richmond council seats already decided in June. Extraction must not create contests for these. Consider `rejectedQuotes`, or a note in the extraction prompt.
6. **June/November mixing:** East Bay Times and 350 Bay Area Action. SEIU 1021's `previousElectionLink` is the June page; its endorsement file's `source` is already the November `/post/` URL.
7. **Dual endorsements:** SEIU 1021 Concord D3 (Kuslits and Acosta Beere), and Labor Council CCWD Div 2 (Fitzpatrick or Picard).
8. **Unverified:**
   - Richmond Progressive Alliance (no endorsements page).
   - Richmond Standard (403).
   - bluevoterguide union listings (Cloudflare).
   - Livermore Valley JUSD Area 3 on CoCo ballots.
   - CC Jewish Dems' election label.
   - The 1st District Court of Appeal retention names on the CoCo ballot. The county's contest list matches the 11 names already in `court-of-appeal-1`.
9. **Watch list** (re-check about weekly):
   - Lift Up Contra Costa Action
   - LWV Diablo Valley (U, W)
   - East Bay Times local editorials
   - ContraCosta.news (more cities)
   - Bay Area Reporter ("more soon")
   - Diablo Valley Dems
   - DanvilleSanRamon.com
10. **Existing-file gaps when widening:**
    - No existing endorsement file has keys for `us-rep-8/9/10` or `assembly-11/14/15/16`, so adding the contests changes what a re-extract can return.
    - Per the runbook, after widening run `extract --force-extract` and review quote diffs for contests outside CoCo.
    - Courage California needs the CoCo county page added as an `extraSource`.

---

## Decisions (2026-10-07)

- **Inclusion:** include any guide whose endorsements are clearly for Nov 3, 2026, however few contests it covers. RTM-only and props-only guides (Bike East Bay, EBHO, LWV Bay Area) are in. Undated guides wait until they're dated: Contra Costa Jewish Democrats is skipped for now.
- **CoCoTax:** included, type `advocacy`. Its description says plainly that it is a taxpayers' association.
- **ContraCosta.news:** type `newspaper`.
- **Image-only guides** (CoCo GOP, Lamorinda Dem Club, and the Labor Council's federal and state picks) are `manual: true` and entered by hand from the images, the same as the existing manual guides.
- **Uncontested or June-decided seats** are not in the ballot, which lists only contested November contests. Guides' picks for those seats are never recorded.
- **Areas:** one `contra-costa` county area. No Richmond page.

## What each shared guide needs for Contra Costa

These guides are shared with the other county branches, so this branch does not edit them. They will be widened once for all counties after the ballot split.

For every guide below, add `contra-costa` to `areas` in `data/guides/<id>.yml`. "Sources" lists only URLs to add to `data/2026-11/endorsements/<id>.yml`; each guide's current `source` stays.

| Guide | Sources to add | CoCo picks to expect | Notes |
|---|---|---|---|
| sierra-club-sf-bay | none; CoCo picks are on the current `source` and the explanations page | CD10, AD16, RTM, CCCCD 3, EBMUD 3 and 7, EBRPD 7, Concord D3 and D5, El Cerrito, San Ramon D4, Richmond Mayor | Keep `fetchWith: browser`. Richmond council picks (Robinson, Zepeda) are for June-decided seats and have no contest. |
| seiu-1021 | none; the current `source` (the `/post/election-endorsements-nov-3-2026` page) has a Contra Costa section | AD11, AD14, AD16, BOE2, RTM, Richmond Mayor, El Cerrito, Antioch D1/D4, Antioch USD 5, Concord D3 (dual: Kuslits and Acosta Beere) and D5, San Ramon D4, CCCCD 1 and 3, EBMUD 3, San Pablo S | Concord D3 is a dual endorsement. |
| ca-wfp | none; the current PDF covers CoCo | BOE2, Antioch D1/D4, Antioch USD 5, CCCCD 1 and 3, Concord D5, Pinole, Richmond Mayor | Its Pittsburg USD pick is for an off-ballot seat. |
| courage-california | https://www.progressivevotersguide.com/california/2026/general/county/contracosta | CD8/9/10, AD11, AD14, AD16, BOE2, Richmond Mayor | AD15 says "No Recommendation". The page has no RTM pick. |
| yimby-action | none | AD11, AD14, RTM, Moraga council (Hillis) | The page labels Hillis "Moraga Mayor"; the contest is Moraga Town Council. Needs a contest alias or a manual check. |
| greenbelt-alliance | none | Walnut Creek U (Yes), RTM | Keep `fetchWith: browser`. |
| bay-rising-action | none | RTM, San Pablo S | Its candidate picks copy CA WFP's. |
| housing-action-coalition | none | AD11, AD14, AD15 | `manual: true`, so the three picks must be entered by hand. |
| lwv-ca | none | props only | `manual: true`. The props are statewide contests and already entered, so widening only changes `areas`. |
| spur | none | RTM, props | The current `extraSources` already include the RTM page. |
| mercury-news (becomes the Bay Area News Group guide) | https://www.mercurynews.com/2026/10/07/endorsement-elect-richard-barrera-californias-superintendent-of-public-instruction-november-election-california-public-schools-sonja-shaw/ (10/7, Superintendent: Barrera) | statewide only so far | East Bay Times pages use the mercurynews.com version as canonical, so keep the mercurynews.com URLs. The CoCo items on https://www.eastbaytimes.com/opinion/endorsements/ are all from June. Add CoCo editorials as they appear. |
| sf-chronicle | none | RTM, statewide, props | Keep `fetchFrom: local`. |
| bay-area-reporter | https://www.ebar.com/story/170347/Opinion/Editorial/Editorial%3A%20B.A.R.%20endorses%20city%20council%20candidates (9/16, Concord D3 Kuslits) and https://www.ebar.com/story/170969/ (10/7, props) | Concord D3, RTM, statewide, props | Keep `fetchWith: browser` (403 to curl). The council editorial says "more soon". |

The other existing guides (SF clubs, Peninsula and South Bay groups, sierra-club-loma-prieta, sflcv) have no Contra Costa content.
