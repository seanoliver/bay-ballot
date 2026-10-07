# Bay Ballot Santa Clara County discovery: guides and ballot (Nov 3, 2026)

Researched 2026-10-07. Follows the structure of `2026-10-06-peninsula-guide-discovery.md`, which covered Palo Alto and Mountain View. This pass covers the rest of Santa Clara County. Research only: no extraction was run, and nothing in `data/guides`, `data/2026-11/endorsements`, `data/areas` or the ballot files was changed.

**Status labels**
- **Verified**: the URL was loaded on 2026-10-07 and showed Nov 3, 2026 general-election picks.
- **Unverified**: could not be confirmed. The reason is given in each case.

**Access notes** (curl with a desktop Chrome user agent)
- Every guide page in the tables below returned 200 to curl, except the ones listed here.
- `vote.santaclaracounty.gov` and `files.santaclaracounty.gov` (the registrar) return 403 to curl. Both load in a browser, and the PDFs download from a browser page with `fetch()`.
- `svtaxpayers.org` (Silicon Valley Taxpayers Association, a Wild Apricot site) returns 403 to curl. It loads in a browser.
- `sierraclub.org` blocks curl but loads in a browser (the existing guide already uses `fetchWith: browser`).
- `bikesiliconvalley.org` returns 403 to curl. No endorsements were looked for there.
- `bluevoterguide.org` didn't finish loading in the browser within 90 seconds. It was used only as a lead, never as a source.
- `losaltosonline.com` (Los Altos Town Crier) shows a subscribe prompt but serves the full endorsement text to curl.
- `southbaylabor.org` returned 200 to curl today. The existing guide uses `fetchWith: browser`, which can stay.

## Traps found while researching

| Looks like | Actually |
|---|---|
| The "Final Qualified List of Local Eligible Candidates" is dated 9/28 | The file name says 9-28-26, but its footer says printed **8/27/2026**. It is the same file the peninsula pass used. |
| The registrar's List of Offices says "Four (4) Appellate Court Associate Justices, 6th District" | The Palo Alto and Mountain View sample ballots show **five** 6th District retention votes, which matches `court-of-appeal-6`. Keep five. |
| The List of Offices says Assembly District 24 is shared with San Mateo | The Alameda discovery lists AD24 on the Alameda ballot. Treat AD24 as Alameda + Santa Clara, and confirm with the SoS certified list before writing `within`. |
| Mercury News endorsed Genny Altwer for San Jose District 9 | That editorial is from **5/27/2026, for the June primary**. The Mercury News has no November local editorial yet. |
| Mercury News endorsed David Cohen for State Senate 10 | Also June (5/8). Cohen didn't advance. November is Sakakihara vs Price. |
| Silicon Valley Biz PAC's "2026 Endorsed Candidates" | The page isn't dated, and it still lists Karen Martinez for San Jose D5 (she lost in June; she now runs for SJECCD TA2) and 2024 races (Mayor, D6, D10). It's the June slate. Skip it until a dated November list appears. |
| Housing Action Coalition's Santa Clara picks are June picks | They sit under the "Ahead of the June 2026 primary" heading, but Cupertino council and Sunnyvale council are November-only races. Fruen, Lindskog, Tang (Cupertino) and Mehlinger (Sunnyvale D5) are November picks. Kuszmaul (Mountain View) is in the November round. |
| The SCCDP page is all November | It also holds the June 2 slate below the November one (Supervisors, San Jose D1/D3, June Measure A). Only the "November 3, 2026 General Election" block counts. |
| South Bay Labor Council's slate is all Santa Clara County | It includes Hollister council and San Benito Supervisor D5 (San Benito County), plus many seats that are off the ballot (see the gotchas). |
| San Jose has a mayor race and odd-district council races | Mayor isn't up. D1 and D3 were decided in June. Only **D5, D7 and D9** are on the November ballot. |
| Board of Supervisors D1 and D4 are on the ballot | Both were decided in June (Arenas won D1 outright; Ellenberg was unopposed in D4). **No county offices** are on the November ballot except County Board of Education TA7. |
| Morgan Hill Times / Gilroy Dispatch will endorse | Their publisher's column ("The slate is set, now it's time to vote") says: "We won't tell you which candidate deserves your vote." |
| San Jose Spotlight endorses | It doesn't. Its editor's note "Why we don't endorse political candidates" cites Institute for Nonprofit News rules. |

---

## 1. Guide table

Abbreviations: SCC = Santa Clara County, SJ = San Jose, SC = city of Santa Clara, LA = Los Altos, LAH = Los Altos Hills, MV = Mountain View, PA = Palo Alto, VW = Santa Clara Valley Water District, FHDA = Foothill-De Anza CCD, WVM = West Valley-Mission CCD, SJECCD = San Jose-Evergreen CCD, ESUHSD = East Side Union HSD, FUHSD = Fremont Union HSD, LGSUHSD = Los Gatos-Saratoga Union HSD, MVLA = Mountain View-Los Altos Union HSD, SJUSD = San Jose Unified, SCUSD = Santa Clara Unified, MHUSD = Morgan Hill Unified, ARUSD = Alum Rock Union SD, FMSD = Franklin-McKinley SD, LASD = Los Altos SD, MVWSD = Mountain View Whisman SD. "Reasons" means the guide explains each pick. "List" means it gives picks only.

### Existing guides (already cover PA and MV)

| Guide | Source | Published? | Reasons? | Format | Rest-of-county picks |
|---|---|---|---|---|---|
| `sccdp` Santa Clara County Democratic Party | https://sccdp.org/index.php/voter-resources/endorsements/2026-endorsements/ | **Yes** (undated block headed "November 3, 2026 General Election") | List | HTML | **The broadest local slate.** Councils: Campbell D3 Furtado; Cupertino Fruen, Lindskog, Tang; Gilroy D4 Sanchez Bentz, D5 C. Tovar, D6 Armendáriz; LA D2 van Deursen; Los Gatos Moore, Raspe, Suzuki; Milpitas Chuan, Kanani; Morgan Hill Mayor Africa, D-B Martinez Beltran, D-D Alvarado; SJ D5 Ortiz, D7 Doan, D9 Chester; SC D2 Williams; Saratoga Bromley. Special: Midpen W1 Gleason; VW D6 Balinton. Measures: No D; Yes M, N, O, P, Q, R (plus E, F, J, RTM already in). Schools: County BOE TA7 Lari; FHDA TA4 Wilson; Gavilan TA3 Gutierrez; WVM TA3 Kepner, TA7 Fish; ESUHSD TA1 Curry Nuñez, TA4 Chavez; ARUSD TA5 Ludwig; Berryessa Boac, Brewer, Jaug; Campbell Union SD TA4 Miller, TA5 **dual** Chandra/Krow-Lucal; Evergreen Reyna, Wright; FMSD Rodriguez; Gilroy USD TA3 Nelson, TA4 Stevens; Milpitas USD Yip-Chuan; MHUSD TA1 Amezcua, TA2 Horner, TA3 Northrup Gadus, TA4 Ortiz; Oak Grove TA2 Ramirez, TA3 Freestone; Orchard Phillips; SJUSD TA2 **dual** Hall/Magaña, TA4 Grunthaner; Sunnyvale SD TA3 Kushner. |
| `south-bay-labor` South Bay AFL-CIO Labor Council | https://www.southbaylabor.org/2026_endorsements | **Yes** ("November 2026 General Election Endorsements") | List | HTML | Federal/state: CD17 Khanna, CD18 Lofgren, CD19 Panetta, SD10 Sakakihara, AD24 Lee, AD25 Kalra, AD26 Ahrens, AD28 Pellerin, AD29 Rivas. Councils: Cupertino Fruen, Lindskog, Tang; Gilroy D4–D6 (same as SCCDP); Los Gatos Suzuki, Moore; Milpitas Mayor **Lien**, council Chuan, Kanani; Morgan Hill D-B **dual** Hayes/Martinez Beltran, D-D Alvarado; SJ D5 Ortiz, D7 Doan (Van Le "Open"), D9 Chester; SC Mayor **Ferraris**, D2 **dual** Williams/Inciarte, D3 Madej; Saratoga Bromley; Sunnyvale D1 Sell, D3 Srinivasan, D5 Mehlinger. Special: VW D1 Varela, D6 Balinton. Schools: FHDA TA4 Wilson; Gavilan TA3 Gutierrez; WVM TA3 **dual** Kepner/Glaves, TA7 Robb (Fish "Open"); County BOE TA7 Lari is "Open"; ESUHSD TA1 Curry Nuñez, TA4 **dual** Chavez/Lam; ARUSD TA3 Oseguera (Quintero "Open"), TA5 Ludwig; Berryessa Jaug; Campbell Union SD TA5 Chandra (TA4 Vora "Open"); Evergreen Wright, Diener, Fernández (Reyna "Open"); Gilroy USD TA3, TA4; MHUSD TA1 Altman(-Palm), TA2 Winter, TA3 Cohen (Northrup Gadus "Open"), TA4 Webb; Oak Grove TA2 Ramirez, TA3 Freestone, TA5 Chun; Orchard Phillips; SJUSD TA2 Magaña, TA4 **dual** Grunthaner/Melillo; SCUSD Yassin (labeled TA3; see gotchas). No measures beyond MV E/F, PA J and RTM. |
| `svgop` Santa Clara County Republican Party | https://www.svgop.com/voter-guide (JPG card, `manual: true`) | **Yes** ("2026 General Election Endorsed Candidates") | One-line rationale per prop and RTM | **JPG image** | CD17 Tandon, CD18 Lewis, CD19 Verbica, SD10 Price, AD24 Hsia, AD25 Bainiwal, AD26 Gorsulowsky, AD28 Pefley, AD29 Sanchez; Milpitas USD Norwood; LGSUHSD TA2 Prasad; ARUSD TA5 Línda Lo Chávez; FMSD Marc Cooper; Milpitas council Jennie Ha Phan. Props and RTM (No) already entered. |
| `scclcv` Santa Clara County LCV | https://www.scclcv.org/scclcv-endorsements/ | **Yes** ("November 2026 Election") | List | HTML | Campbell D4 Fields; Cupertino Fruen, Lindskog, Tang; Gilroy D4 Fred Tovar, D5 Joseph Garcia **and** Christina Tovar (dual); LA van Deursen; Sunnyvale D1 Sell, D3 Srinivasan. Names are misspelled on the page (see gotchas). |
| `sierra-club-loma-prieta` | https://www.sierraclub.org/loma-prieta/november-3-2026-sierra-club-california-and-loma-prieta-chapter-general-election | **Yes** (read in browser) | List | HTML (browser) | CD17 Khanna, CD18 Lofgren, CD19 Panetta; AD25 Kalra, AD26 Ahrens, AD28 Pellerin; Midpen W1 Gleason (W2 Kishimoto and W5 Holman are off the ballot); FHDA TA4 **Chao**; LA D2 Lynette (Lee) Eng; SC Mayor **Watanabe**; Cupertino **Kosolcharoen**; Saratoga Li, Bromley; Los Gatos Moore. No local measures. |
| `sv-at-home` SV@Home Action Fund | https://siliconvalleyathome.org/action-fund/2026-election-voter-guide/ | **Yes** | **Yes** | HTML | Adds **No on LA D** to what it already has. Nothing else local. |
| `greenbelt-alliance` | https://www.greenbelt.org/voter-guide-26/ | **Yes** | **Yes** (blog post per measure) | HTML (browser) | **Yes on Cupertino L**, **No on LA D**. |
| `yimby-action` | https://yimbyaction.org/endorsements/november-2026-california-general | **Yes** | List | HTML | SD10 Sakakihara; AD24 Lee, AD25 Kalra, AD26 Ahrens, AD29 Rivas; SJ D9 Chester. (MV Kuszmaul and RTM already in.) |
| `seiu-1021` | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 ("Peninsula & South Bay" and "Santa Clara County" sections) | **Yes** | List | HTML | SD10 Sakakihara; AD24 Lee, AD25 Kalra, AD26 Ahrens; SJ D5 Ortiz, D9 Chester; Milpitas Kanani. |
| `ca-wfp` CA Working Families Party | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf | **Yes** | Props: yes; candidates: list | PDF | CD17 Khanna; AD24 Lee, AD25 Kalra; Berryessa Jaug; ESUHSD Curry Nuñez; Gilroy council Armendáriz; Milpitas Kanani; SJ council Ortiz, Chester (no districts on the PDF); SJUSD Melillo; "Santa Clara City Council" **Kevin Park** (he runs for **Mayor**). Also ESUHSD Montes and FHDA Gvatua, both off the ballot. |
| `courage-california` | https://www.progressivevotersguide.com/california/2026/general/county/santaclara (already an `extraSource`) | **Yes** | **Yes** | HTML | CD18 Lofgren, CD19 Panetta; AD24–26, AD28, AD29; SD10 Sakakihara; SJ D5 Ortiz. **No CD17 entry.** |
| `housing-action-coalition` (`manual: true`) | https://housingactioncoalition.org/news/nov-2026-endorsements | **Yes** | List | HTML | Cupertino Fruen, Lindskog, Tang; Sunnyvale D5 Mehlinger; MV Kuszmaul (November round). AD23–AD29 from its June list (incumbents; their November races are the same contests). Its June pick for SD10 (Cohen) didn't advance. |
| `mercury-news` | https://www.mercurynews.com/opinion/endorsements/ | Statewide only (Ma, Allen, Kounalakis, and Barrera on 10/7). **No November Santa Clara local, district or measure picks yet.** | Yes | HTML | none yet |
| `pa-daily-post` | existing sources | Yes | Yes | HTML | Nothing beyond PA and VW D7. Its election hub was updated 10/7 with no new editorials. |
| `bay-rising-action` | https://bayrisingaction.org/voterguide/ | Yes | Yes | HTML | RTM only (via Silicon Valley Rising Action). |
| `green-foothills` | existing source | Yes | Yes | HTML | Props only; its one local measure is in Half Moon Bay. |
| `lwv-ca`, `spur`, `sf-chronicle`, `bay-area-reporter` | existing sources | Yes | Yes | — | Props, statewide and RTM only. |

### New guides

| Guide | Type | Nov 2026 URL | Published? | Reasons? | Format | Curl | SCC coverage |
|---|---|---|---|---|---|---|---|
| Los Altos Town Crier | newspaper | https://www.losaltosonline.com/opinion/town-crier-endorsements/article_cddcbc6a-6f71-4a55-b19d-0aa447cdc306.html (updated 10/7) and [Measure D editorial](https://www.losaltosonline.com/opinion/town-crier-measure-d-is-a-mistake/article_5baa06a9-1a33-4188-9113-43ebcf443a8d.html) (9/29) | **Yes.** LA D2 van Deursen, D4 Lang; LAH council Waschura, Pombra; MV council Sylvester, Donahue, Cox; LASD Stroy, Sirkay, Johnson; VW D7 Dailey; No on D, Yes on E, Yes on F. MVLA TA3: declines to endorse ("all three candidates are qualified"). | List page; reasons only in the D editorial | HTML (subscribe prompt; body served) | 200 | LA, LAH, MV |
| LWV Los Altos-Mountain View | civic | https://lwvlamv.org/ (homepage, "Prepare for the November 3rd Election") | **Yes: opposes LA Measure D**, with linked analysis and explanation | Yes | HTML | 200 | LA |
| Silicon Valley DSA | club | https://siliconvalleydsa.org/voters-guide/ , which links the published Google Doc https://docs.google.com/document/d/e/2PACX-1vQAtAN3xtKSl7Pkx34nNpJyypPlm_Zga45PZHEYVk6jNpwxcp0GDBFrLsU9wjTjliya6ZP0OrMkljEt/pub ("2026 General Election Voter Guide") | **Yes.** About 50 SCC contests: CD17, CD18, AD24–26, AD28; County BOE TA7 Lari; Midpen W1 (joint, both candidates); VW D6 Balinton, D7 (against Eisenberg); Campbell D3 Brenner; Cupertino Fruen, Tang, Lindskog; Gilroy D6; LA D2 van Deursen; Los Gatos Moore, Suzuki; Milpitas Mayor Lien, council Kanani; Morgan Hill D-D Alvarado; MV Poicon, Sylvester, Kuszmaul; PA **Goins**; SJ D5 Ortiz, D9 Chester; FHDA TA4 Wilson; WVM TA3 (joint), TA7 Robb; ESUHSD TA1, TA4; FUHSD TA3 Kim, TA4 (joint); Gilroy USD TA3, TA4; Milpitas USD Norwood; MHUSD all four; MVLA TA3 Cornes; PAUSD Henigin; SJUSD TA2 Hall, TA4 Melillo; SCUSD (against Canova); ARUSD TA3, TA5; Berryessa Brewer, Jaug; Campbell Union SD TA5; Evergreen Reyna, Wright; LASD Poll; MVWSD Conley, Subbarayan; Oak Grove TA2, TA3, TA5; Orchard Phillips; Saratoga Union SD Goldberg, Drexel, Vineet; Sunnyvale SD TA3 Kushner. Measures: No B, No D, Yes F, Yes K, Yes L, Yes S, Yes RTM, and "Yes on all school bond measures and parcel taxes" (M–R). Many explicit "no recommendation" races. Also covers SMC (Redwood City E, Menlo Park, EPA, SMC J and U, Sequoia UHSD, Menlo Park City SD) and Alameda (CD14, Fremont, Newark DD, Union City II). | **Yes** (a paragraph per race) | Google Doc | 200 | Countywide, plus SMC and Alameda |
| Silicon Valley Taxpayers Association | advocacy (anti-tax) | https://www.svtaxpayers.org/ (homepage "VOTER GUIDE - November 3, 2026 Election") | **Yes. No** on RTM, Gilroy B, MV F, PA J, Milpitas K, M, N, O, P, Q, R. **Also No on 16 SMC measures** (R, Z, M, T, K, V, W, Y, X, D, O, BB, N, EE, G, H). No candidates. | One-line description per measure | HTML | **403** (browser OK) | Every SCC tax measure; SMC |
| Cupertino for All | advocacy (housing) | https://www.cupertinoforall.org/2026-election ("Our Endorsements for 2026") | **Yes**: Fruen, Tang, Lindskog (the "Cupertino Together" slate) | **Yes** | HTML | 200 | Cupertino council |
| Equality California (new in the Contra Costa pass) | advocacy | https://www.eqca.org/elections/ | **Yes**: CD16 Liccardo, CD17 Khanna, CD18 Lofgren, CD19 Panetta; AD23–26, AD28, AD29. Its SJ D3 Tordillos pick is June. | List | HTML | 200 | District only |
| California Environmental Voters (new in the Contra Costa pass) | advocacy | https://envirovoters.org/2026-endorsements/ | **Yes**: CD16–19, SD10 Sakakihara, AD23–26, AD28, AD29, BOE2 Lieber | List | HTML | 200 | District only |
| LWV Bay Area (new in the Contra Costa pass) | civic | https://my.lwv.org/sites/default/files/2026_nov_regional_transit_measure_vwtl.pdf | **Yes: RTM Support.** LWV San Jose/Santa Clara's "We Recommend" page points to this and to LWVC's props. | Yes | PDF | — | RTM |

### Checked: no November 2026 endorsements

- **Newspapers:** Morgan Hill Times and Gilroy Dispatch say they won't endorse. San Jose Spotlight doesn't endorse (stated policy). Metro Silicon Valley and San Jose Inside had no endorsement posts. Silicon Valley Voice (Santa Clara) has explainers (Measure C on 10/7, a mayoral candidates piece), no endorsements. Los Gatan has candidate coverage only. Saratoga News, Los Gatos Weekly, Cupertino Courier, Sunnyvale Sun and Campbell Reporter are Bay Area News Group papers; their editorials are the Mercury News's.
- **Leagues:** LWV San Jose/Santa Clara has no local positions (it relays LWVC's props and the LWV Bay Area RTM support). LWV Cupertino-Sunnyvale publishes pros and cons for Sunnyvale G, H, I, Cupertino L and RTM, with no positions.
- **Clubs:** The Democratic Club of Sunnyvale says it won't hold endorsement votes. Livable Sunnyvale posted no endorsements. Dean Democratic Club appears only on Blue Voter Guide, with June picks. `svyd.org/endorsements` returns 404. No sites were found for the Silicon Valley Stonewall Democrats, DAWN or a Silicon Valley Young Democrats endorsement page.
- **YIMBY chapters:** South Bay YIMBY and San Jose YIMBY both say "No current endorsements"; their only 2026 entries are the June primary. National YIMBY Action covers SCC (above).
- **Business:** San Jose Chamber ChamberPAC (`/chamberpac` is a 404); SV Biz PAC (June slate, see traps); SVLG (no endorsements on its site); Santa Clara County REALTORS (none posted).
- **Labor and other:** Santa Clara & San Benito Building Trades Council (no site found); Working Partnerships USA (a 501(c)(3); no endorsements); Silicon Valley Rising Action (its RTM pick is on Bay Rising Action's page); Planned Parenthood Advocates Mar Monte (only a 2024 guide is posted); Better Cupertino (2024 posts only).
- **Unverified:** the Los Gatos Community Alliance. Its site (`lgca.town`) doesn't resolve. News coverage says it supports Stump and Badame for Los Gatos council.

### Counts

| | Count |
|---|---|
| New guides with Nov 2026 SCC picks (published) | **5 SCC-specific**: Los Altos Town Crier, LWV Los Altos-Mountain View, Silicon Valley DSA, Silicon Valley Taxpayers Association, Cupertino for All. **3 more** already proposed by the Contra Costa pass: Equality California, California Environmental Voters, LWV Bay Area. |
| Existing guides to widen | **18**: sccdp, south-bay-labor, svgop, scclcv, sierra-club-loma-prieta, sv-at-home, greenbelt-alliance, yimby-action, seiu-1021, ca-wfp, courage-california, housing-action-coalition, mercury-news, pa-daily-post, bay-rising-action, green-foothills, lwv-ca, spur. Plus sf-chronicle and bay-area-reporter if they get a county page for RTM and statewide picks. |
| Pending or announced | Mercury News local editorials (the main paper for San Jose; nothing yet); Planned Parenthood Advocates Mar Monte (2026 guide not posted); Palo Alto Weekly / Mountain View Voice (from the peninsula pass). |
| Image-only (manual) | svgop (existing, `manual: true`). No new image-only guides. |

---

## 2. Ballot contests

Redacted extracts (contest, candidate names and measure titles only) are in `data/2026-11/sources/`:
- `SCC-Candidate-List-0827.txt`: the 129-contest local list, with "On Ballot" flags.
- `SCC-State-Candidates-0828.txt`: state and federal contests.
- `SCC-Measures-Nov2026.txt`: the 20 measures.

### Sources

- Resources page: https://vote.santaclaracounty.gov/november-3-2026-general-election-resources
- Final Qualified List of Local Eligible Candidates: https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf?VersionId=CM6jbwAVTLFIjLakj6hJku2l9KPAIxli (printed 8/27; text layer; CFMR009 format)
- Final Qualified List of State Eligible Candidates: https://files.santaclaracounty.gov/exjcpb1296/2026-08/qualified-state-8.28.2026-qualified-state-v2.pdf?VersionId=JdB0.vgbC5DbHd657pQtExZjVdSHBAHy (printed 8/28)
- Unofficial list of local write-in candidates (9/22): https://files.santaclaracounty.gov/exjcpb1296/2026-09/writeincandidates_09222026.pdf?VersionId=JaOEeCylOnErqYfJrEZ7T4w1FRV30ssO (not extracted)
- List of Local Measures: https://vote.santaclaracounty.gov/list-local-measures-4
- List of Offices: https://vote.santaclaracounty.gov/november-3-2026-general-election-list-offices
- Per-address sample ballots: the Omniballot CVIG (see the runbook's Santa Clara note). Not sampled in this pass.
- June results (Supervisors D1/D4 decided): https://en.wikipedia.org/wiki/2026_Santa_Clara_County_Board_of_Supervisors_election

### State and federal districted contests

| Contest | Candidates | In `ballot.yml`? | Other counties |
|---|---|---|---|
| CD16 | Liccardo vs Sundin Soulé | yes (`us-rep-16`, SMC + SCC) | — |
| CD17 | Ro Khanna vs Ritesh Tandon | **new** (`us-rep-17`) | Alameda (also in the Alameda pass) |
| CD18 | Zoe Lofgren vs Shane Lewis | **new** (`us-rep-18`) | Fresno, Kings, Monterey, San Benito, Santa Cruz (none on the site) |
| CD19 | Jimmy Panetta vs Peter Coe Verbica | **new** (`us-rep-19`) | Monterey, Santa Cruz, San Luis Obispo |
| SD10 | Scott Sakakihara vs Linda R. Price | **new** (`state-senate-10`?) | Alameda (also in the Alameda pass) |
| AD23 | Berman vs D. Johnson | yes (`assembly-23`, SMC + SCC) | — |
| AD24 | Alex Lee vs Max Hsia | **new** (`assembly-24`) | Alameda (see traps) |
| AD25 | Ash Kalra vs Himat Singh Bainiwal | **new** (`assembly-25`) | none |
| AD26 | Patrick Ahrens vs Tim Gorsulowsky | **new** (`assembly-26`) | none |
| AD28 | Gail Pellerin vs Carol Pefley | **new** (`assembly-28`) | Santa Cruz |
| AD29 | Robert Rivas vs Dennis P. Sanchez | **new** (`assembly-29`) | Monterey, San Benito, Santa Cruz |
| BOE D2 | Lieber vs Pimentel | yes, SCC already in `within` | — |
| 6th District Court of Appeal | 5 retention votes | yes (`court-of-appeal-6`) | — |
| RTM | | yes, SCC already in `within` | — |

**8 new shared contests.** CD17, SD10 and AD24 are also on the Alameda ballot, so one branch adds each with both counties in `within`, and the other reuses the id.

### Local contests on the SCC ballot

73 local contests are printed on the ballot. 9 are already in `santa-clara.yml` (VW D7, MVWSD, LASD, PA council, PAUSD, MV council, MVLA TA3, FUHSD TA3, FUHSD TA4). 5 more have no guide position and stay out:
- SJECCD TA2 (Martinez vs Pham): SV DSA says "no one".
- Yosemite CCD TA4: a cross-county district with a sliver in SCC.
- Cambrian SD (3 seats).
- Campbell D5: Sorabji is unopposed but printed.
- Cupertino Sanitary District (2 seats).

That leaves **59 new local candidate contests**. Each has at least one guide pick:

| Group | Contests (main guides) |
|---|---|
| County and college (6) | County BOE TA7 (SCCDP, SV DSA); FHDA TA4 (SCCDP, SBLC, Sierra, SV DSA); Gavilan TA3 (SCCDP, SBLC); WVM TA3 (SCCDP, SBLC dual, SV DSA joint); WVM TA7 (SCCDP Fish vs SBLC/SV DSA Robb); Midpen Ward 1, Gleason vs To (SCCDP, Sierra, SV DSA joint) |
| Valley Water (2) | D1 Forbis vs Varela (SBLC); D6 Nguyen vs Balinton (SCCDP, SBLC, SV DSA) |
| High school and unified (13) | ESUHSD TA1 short term, TA4; LGSUHSD TA2 (SVGOP only); Gilroy USD TA3, TA4; Milpitas USD (3 seats); MHUSD TA1, TA2, TA3, TA4; SJUSD TA2, TA4; SCUSD TA1 Canova vs Yassin (SBLC, SV DSA) |
| Elementary (13) | ARUSD TA3, TA5; Berryessa (3); Campbell Union SD TA4, TA5; Evergreen (3); FMSD (3); Oak Grove TA2, TA3, TA5; Orchard (3); Saratoga Union SD (3; SV DSA only); Sunnyvale SD TA3 |
| City (25) | Campbell D3, D4; Cupertino (3); Gilroy D4, D5, D6; LA D2, **D4** (Lang unopposed; Town Crier only); LAH (2; Town Crier only); Los Gatos (3); Milpitas Mayor, council (2); Morgan Hill Mayor, D-B, D-D; SJ D5, D7, D9; SC Mayor, D2, D3; Saratoga (3); Sunnyvale **D1, D3, D5** (all unopposed but printed; SBLC, SCCLCV, HAC) |

**Off the ballot** (uncontested, appointed in lieu of election): 56 of the 129 listed contests. Among them: County BOE TA2 and TA6, FHDA TA2, Gavilan TA1, SJECCD TA4 and TA6, WVM TA5, Campbell Union HSD (all), ESUHSD TA2, FUHSD TA1, LGSUHSD TA3/TA4, MVLA TA1/TA2, ARUSD TA1, Cupertino Union SD, Los Gatos Union SD, Moreland, Mt. Pleasant, Union SD, Luther Burbank, Lakeside, Loma Prieta, North County Joint, Sunnyvale SD TA1/TA5, SCUSD TA3/TA4/TA6, Gilroy USD TA1/TA7, Monte Sereno council, VW D4, El Camino Healthcare directors, Midpen W2/W5, Open Space Authority D2/5/6/7, Saratoga Fire, Purissima Hills Water, Rancho Rinconada, Burbank Sanitary, Aldercroft Heights, South Santa Clara Valley Memorial and West Bay Sanitary. San Martin County Water, Lion's Gate CSD and Silver Creek Valley GHAD are on the List of Offices but have no qualified candidates on the list.

### Local measures (19 lettered + RTM)

| Letter | Jurisdiction | Title | Threshold | In `santa-clara.yml`? | Positions |
|---|---|---|---|---|---|
| A | Morgan Hill | City Treasurer appointive | Majority | no | **none** (stays out) |
| B | Gilroy | Transient occupancy tax | Majority | **new** | SV DSA No, SVTA No |
| C | Santa Clara | Public works charter amendment | Majority | no | **none** (stays out) |
| D | Los Altos | Parking plazas citizens' initiative | Majority | **new** | No: SCCDP, SV@Home, Greenbelt, LWV LAMV, Town Crier, SV DSA |
| E | Mountain View | Charter modernization | Majority | yes | (+ Town Crier Yes) |
| F | Mountain View | TOT | Majority | yes | (+ Town Crier Yes, SV DSA Yes, SVTA No) |
| G, H, I | Sunnyvale | Charter amendments (contracting; settlement authority; vacancies) | Majority | no | **none** (LWVCS pros and cons only; stays out) |
| J | Palo Alto | ½¢ sales tax | Majority | yes | (+ SVTA No) |
| K | Milpitas | Business tax update | Majority | **new** | SV DSA Yes, SVTA No |
| L | Cupertino | Parks/open space General Plan amendment | 2/3 | **new** | Greenbelt Yes, SV DSA Yes |
| M | Gilroy USD | $295M bond | 55% | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| N | LGSUHSD | $321M bond | 55% | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| O | Alum Rock Union SD | Parcel tax | 2/3 | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| P | Alum Rock Union SD | $100M bond | 55% | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| Q | Cambrian SD | Parcel tax | 2/3 | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| R | Orchard SD | Parcel tax | 2/3 | **new** | SCCDP Yes, SV DSA Yes, SVTA No |
| S | El Camino Healthcare District | Director term limits | Majority | yes | (+ SV DSA Yes) |

**10 new measures.** No county or San Jose measures are on the ballot. **Measure N** is a Los Gatos-Saratoga district measure that a few Palo Alto voters also see (Ballot Type 2 in `SCC-Sample-Ballots-PA-MV.txt`). Its `within` should be `{ level: county, name: Santa Clara }`, not a city.

**Total new in `santa-clara.yml`: 59 candidate contests + 10 measures = 69.** Existing naming suggests ids like `cupertino-council`, `san-jose-council-5`, `santa-clara-mayor`, `milpitas-mayor`, `morgan-hill-council-b`, `valley-water-6`, `midpen-ward-1`, `sjusd-trustee-area-2`, `esuhsd-trustee-area-1`, `county-board-of-education-7`, `fhda-trustee-area-4`, `los-altos-measure-d` and `gilroy-usd-measure-m`. No collisions with existing ids were found.

---

## 3. Proposed area structure

**Recommendation: a `santa-clara-county` county page plus a `san-jose` city page. Palo Alto and Mountain View stay as city pages.**

- `santa-clara-county` ("Santa Clara County", kind `county`): `{ level: state, name: California }`, `{ level: county, name: Santa Clara }`, and one `city` entry for each of the 15 cities: Campbell, Cupertino, Gilroy, Los Altos, Los Altos Hills, Los Gatos, Milpitas, Monte Sereno, Morgan Hill, Mountain View, Palo Alto, San Jose, Santa Clara, Saratoga, Sunnyvale. Same pattern as `san-mateo`.
  - Including PA and MV means their contests show on both the county page and their own pages. Leaving them out makes the county page "the rest of the county". See Decisions.
- `san-jose` ("San Jose", kind `city`): `{ level: state }`, `{ level: county, name: Santa Clara }`, `{ level: city, name: San Jose }`. It is the largest city in the Bay Area.
  - It has council D5/D7/D9 (SCCDP, SBLC, Courage, WFP, SEIU, YIMBY Action, SV DSA), CD16–19, AD24–26/28, SD10, VW D1/D6, County BOE TA7, ESUHSD, SJUSD, Alum Rock, Berryessa, Evergreen, FMSD, Oak Grove, Orchard and Cambrian schools, SJECCD/WVM/FHDA colleges, and Measures O, P, Q, R.
  - Most San Jose school and college districts are `district`-level contests with `within: [Santa Clara]`, so the San Jose page needs the place filter (or a `within` city entry) to pick them up. Check how `src/lib/areas.ts` maps a district contest to a city page before choosing `within`.
- **Other cities don't need pages yet.**
  - Cupertino is the strongest candidate: 7 guides on its council race, plus Measure L.
  - Los Altos has the Town Crier, LWV LAMV and 6 guides on Measure D.
  - Santa Clara city has a 6-way mayor race with 3 different picks.
  - Sunnyvale is thin (3 unopposed seats; G, H and I have no positions).
- `order`: existing areas use 10–40. Suggest 25 for `santa-clara-county` and 27 for `san-jose`, or numbers after the other counties'. Check what Contra Costa, Alameda and Marin pick so they don't collide.

---

## 4. What the shared guides need

The team lead widens these centrally; this branch doesn't edit them. "SCC areas" means `santa-clara-county` (and `san-jose` where the guide has SJ picks or a district/RTM pick on the SJ ballot). "Sources" lists only URLs to add; each guide's current `source` stays.

| Guide | Add to `areas` | Sources to add | Picks to expect | Notes |
|---|---|---|---|---|
| sccdp | both | none | ~70 contests (see table) | Duals: Campbell Union SD TA5, SJUSD TA2. Ignore the June block below. |
| south-bay-labor | both | none | ~65 contests | "Open Endorsement" = no pick. Duals: Morgan Hill D-B, SC D2, ESUHSD TA4, WVM TA3, SJUSD TA4. Drop off-ballot and San Benito picks. |
| svgop | both | none | CD17–19, SD10, AD24–29, 5 local | `manual: true`: hand-enter from the JPG. |
| scclcv | both | none | 7 contests | Needs name aliases (see gotchas). |
| sierra-club-loma-prieta | both | none | ~12 SCC contests | Keep `fetchWith: browser`. Drop Midpen W2/W5. |
| sv-at-home | both | none | + LA D | |
| greenbelt-alliance | both | https://www.greenbelt.org/blog/vote-yes-measure-l-cupertino/ and https://www.greenbelt.org/blog/vote-no-on-measure-d-to-reject-voter-approval-for-parking-plaza-development-los-altos/ (reasons; optional) | Cupertino L, LA D | |
| yimby-action | both | none | SD10, AD24–26, AD29, SJ D9 | |
| seiu-1021 | both | none | SD10, AD24–26, SJ D5/D9, Milpitas | |
| ca-wfp | both | none | CD17, AD24/25, ~9 local | Map "Kevin Park, Santa Clara City Council" to SC Mayor. SJ council picks have no district; match by name. |
| courage-california | both | none (SCC page already an `extraSource`) | CD18/19, SD10, AD24–29, SJ D5 | No CD17 entry. |
| housing-action-coalition | both | none | Cupertino (3), Sunnyvale D5, MV Kuszmaul, AD23–29 | `manual: true`: hand-enter. |
| mercury-news | both | none yet | statewide only | Add SCC editorials as they appear. Don't use the 5/27 Altwer editorial (June). |
| pa-daily-post | `santa-clara-county` | none | PA, VW D7 (existing) | Only if the county page includes PA contests. |
| bay-rising-action, green-foothills, lwv-ca, spur | both | none | RTM and/or props | |
| sf-chronicle, bay-area-reporter | optional | none | RTM, statewide | Only if they are being widened for other counties. |
| **New shared**: equality-california, envirovoters, lwv-bay-area (from Contra Costa) | both | as in the table above | district contests / RTM | Whoever adds them includes SCC. |
| **New, crosses counties**: Silicon Valley DSA, SVTA | SCC areas, plus `san-mateo` (both) and Alameda (SV DSA) | — | see guide table | Both also take positions on San Mateo County contests. SV DSA also covers Fremont, Newark and Union City (Alameda). |

---

## 5. Decisions needed

1. **County page and PA/MV:** should `santa-clara-county` list Palo Alto and Mountain View in its jurisdictions (complete county page, with duplicate contests) or leave them out (county page = rest of county)? Recommend including them, as `san-mateo` includes every city.
2. **San Jose page:** yes or no (recommended yes). Also Cupertino: no for now?
3. **SVTA:** include as `advocacy` with a plain description (single-viewpoint anti-tax group), as decided for CoCoTax? It also covers 16 SMC measures.
4. **SV DSA:**
   - It distinguishes "recommendations" (majority vote) from "endorsements" (75% vote). Count both, as decided for East Bay DSA?
   - "Recommend against X" (FMSD Cooper and Borrayo; Orchard Kasolas-Jacobson; VW D7 Eisenberg; SCUSD Canova) isn't a pick for anyone. In two-candidate races (VW D7, SCUSD TA1) it implies the other candidate. Record only explicit "we recommend" names?
   - Its blanket "Yes on all school bonds and parcel taxes": record Yes on M, N, O, P, Q, R? The verifier may reject a pick that has no measure letter on the page.
   - "Joint recommendation" (Midpen W1, WVM TA3, FUHSD TA4) = dual pick, unranked.
5. **Unopposed but printed contests** (Sunnyvale D1/D3/D5, Los Altos D4): include them when a guide picks? Contra Costa included its six printed uncontested contests. Campbell D5 has no pick and stays out either way.
6. **Town Crier MVLA TA3** "chose not to endorse": no pick.

## 6. Gotchas for extraction

- **Off-ballot picks to drop** (no contest): SBLC ARUSD TA1 Green, Campbell Union HSD TA1 Kim and TA2 Halliday, Cupertino Union SD Chiao, Gavilan TA1 Napoli, TA5 Wallace and TA7 Gonzalez (TA5/TA7 aren't on the SCC list), MVLA TA2 Kamei, SJECCD TA4 Fuentes, County BOE TA2 Zhao, WVM TA5 Lamkin, SCUSD Fairchild, Hollister D2/D3, San Benito Supervisor D5. CA WFP ESUHSD Montes and FHDA Gvatua. Sierra Midpen W2 Kishimoto and W5 Holman.
- **Mislabels:**
  - SBLC lists Kamal Yassin under "Santa Clara Unified TA 3"; he is in **TA1** (Canova vs Yassin).
  - SV DSA labels Oak Grove's Victor Ramirez "District 1"; he is in **TA2**.
  - CA WFP labels Kevin Park "Santa Clara City Council"; he runs for **Mayor**.
- **Name aliases needed** (registrar name ← guide spelling):
  - Fred Tovar ← "Fred Tover" (SCCLCV); Christina Tovar ← "Christina Tover"; Seema Sharma Lindskog ← "Seema Linskog", "Seema Lindskog"; J.R. Fruen ← "JR Freun", "J R Fruen", "JR Fruen"; Murali Srinivasan ← "Murali Srinvasan".
  - Anky van Deursen ← "Anky van Deurson" (SCCDP); Lynette Lee Eng ← "Lynette Eng" (Sierra); Claudia Ortiz ← "Claudia Sandoval Ortiz" (SCCDP); Nancy Altman-Palm ← "Nancy Altman" (SBLC).
  - Mer Curry Nuñez ← "Mer Curry Nunez", "Meredith 'Mer' Curry Nunez"; Anne J. Kepner ← "Anne Jones Kepner", "Anne Kepner"; Susan Oster Fish ← "Susan Fish"; Colin Lee Elliott Glaves ← "Colin Glaves"; Tomara Hall ← "Tomara Latreece Hall".
  - José Magaña / Jose Magana; Rebeca G. Armendáriz ← "Rebeca G Armendariz"; Línda Lo Chávez ← "Linda Chavez" (SV DSA); Jennifer "Jenny" Ludwig / Jenny Ludwig; Jasmeen Pombra ← "Jasmeen Pombra, MD"; Armando "Gary" Ferraris ← "Gary Ferraris"; Thong Quang La; Magaly Fernández ← "Magaly Fernandez"; Delia Oseguera; Andrés Quintero ← "Andres Quintero".
- **Orchard SD:** SV DSA mentions "the very recent and tragic loss of incumbent board member Lo"; Renee Lo is on the registrar's list. Unverified; the name stays on the ballot either way.
- **SCCDP's page** carries both November and June slates; the June San Jose D7 dual (Garcia, Nguyen) and Measure A must not be extracted.
- **The Mercury News endorsements index** still lists June items (CoCo ULL, Open Space Authority Measure D, Altwer, Cohen). Ignore anything dated before September.
- **Valley Water D7**: SV DSA's position is against Eisenberg, not an explicit Dailey pick.

## 7. Unverified

- Per-precinct ballot styles outside PA and MV weren't sampled. In particular: which cities' voters see each school and college trustee area, and whether any SCC voter sees Yosemite CCD TA4 or Patterson JUSD.
- Whether AD24 has a San Mateo portion (the registrar's List of Offices says so).
- The Los Gatos Community Alliance's picks (site down).
- Planned Parenthood Advocates Mar Monte's 2026 guide (not posted).
- The building trades council, ChamberPAC and police/fire unions (no posted lists found).
- Whether the Mercury News will publish SCC local editorials (it did in 2024). Re-check weekly.

## Decisions (2026-10-07)

- **Areas:** `santa-clara-county` (order 25) lists all 15 cities, Palo Alto and Mountain View included, the same way `alameda-county` includes Oakland. A `san-jose` city page (order 27). Palo Alto and Mountain View keep their pages. Each contest exists once, in `santa-clara.yml`.
- **SVTA:** included, type `advocacy`, with a description that says plainly it is a taxpayers' association (as for CoCoTax).
- **SV DSA:** a new guide owned by this branch.
  - Its "recommendations" count as picks.
  - "Joint" recommendations are duals: a list of names with `ranked: false`.
  - "Recommend against" counts as No on a measure and is ignored for candidates.
  - Its blanket "Yes on all school bond measures and parcel taxes" counts only for measures that are plainly school bonds or parcel taxes (Gilroy USD M, LGSUHSD N, Alum Rock O and P, Cambrian Q, Orchard R), each with the supporting quote.
  - Its Alameda picks are listed for central widening.
- **Unopposed seats** printed on the Nov 3 ballot are included when a guide picks them (corrected 2026-10-07, following the San Mateo precedent of Redwood City D2 and South San Francisco D1): Sunnyvale D1, D3, D5 and Los Altos D4. Races decided in June aren't on the ballot and stay out.
- **Equality California, California Environmental Voters and LWV Bay Area** are created by the Contra Costa branch. This branch only lists their Santa Clara needs.

## Data phase notes (2026-10-07)

- **New guides created here:** `los-altos-town-crier`, `lwv-lamv`, `sv-dsa`, `svta` (`fetchWith: browser`), `cupertino-for-all`.
- **`sv-dsa` Alameda picks, for central widening** (add `alameda-county` and the city pages to its `areas` once the Alameda contests exist):
  - CD14 Aisha Wahab.
  - Fremont D2 Desrie Campbell, D3 Kathy Kimberlin, D4 Aziz Akbari.
  - Newark council Matthew Jorgens; Yes on Newark DD.
  - Union City D2 Victor Pulido, D3 Cheris Crocker-Root, D4 Sarabjit Cheema; Yes on Union City II.
- **Santa Clara needs of the guides the Contra Costa branch creates:**
  - `equality-california`: CD16–19, AD23–26, AD28, AD29.
  - `envirovoters`: CD16–19, SD10, AD23–26, AD28, AD29, BOE2.
  - `lwv-bay-area`: RTM.
  - All three add `santa-clara-county` and `san-jose` (and `palo-alto`/`mountain-view` for their CD16/AD23/RTM picks).
- **`within`:** every Santa Clara district lists the cities it serves, so it stays off the San Jose, Palo Alto and Mountain View pages it doesn't cover. This includes the four existing ones (Valley Water 7, MVWSD, LASD, El Camino Measure S), which were whole-county before. The shared CD17–19, SD10 and AD24–29 entries list their Santa Clara cities from the 2021 district descriptions.
