# Bay Ballot Peninsula discovery: San Mateo County, Palo Alto, Mountain View (Nov 3, 2026)

Researched 2026-10-06. This builds on `bay-ballot-peninsula/docs/investigations/2026-10-06-bay-area-guide-discovery.md` and corrects it where it was wrong.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-06 and saw 2026 general-election picks.
- **Unverified**: I could not confirm it. The reason is given in each case.

**Access notes**
- `vote.santaclaracounty.gov` and `files.santaclaracounty.gov` return 403 to curl. Both load in a real browser (Playwright), so everything Santa Clara below was read directly from the registrar, not from cached copies.
- `sierraclub.org` blocks curl but loads in a browser. Verified that way.
- `coastsider.com` returned Cloudflare 520 (site down) to both curl and the browser.
- `livablemv.org` now redirects to an Indonesian gambling spam site. The domain has lapsed.

## Corrections to the first pass

| First-pass claim | Correction |
|---|---|
| SMC Democrats: "decided but not posted" | **Published.** The slate is a single PNG image on the homepage (https://www.smcdems.org/), titled "Our Endorsements, November 2026 Election". `/endorsements` still shows 2024. Covers BOS D5, 25 city council picks, 18 school picks, and positions on all 29 county, city and school measures plus RTM. |
| SMC GOP: "a few local picks" | It also has a **PDF** that takes a position on **every** SMC measure (county, RTM, school and city) and every state prop, each with a one-line rationale: https://smgop.org/s/SMGOP-November-2026-Election-Guide.pdf |
| Peninsula for Everyone page = 2026 general picks | The chapter page mixes **June primary** picks (Steyer, Tubbs, Corzo for D2) with general picks. Use the YIMBY Action general page for Nov picks. P4E's chapter page carries the reasons. |
| Santa Clara GOP: unverified, "vote.svgop.com does not resolve" | **Published** at https://www.svgop.com/voter-guide as a JPG slate card (https://www.svgop.com/s/SVGOP-Endorsements-2026-General-Election.jpg). No Palo Alto or Mountain View local picks. |
| LWV San Mateo County: unverified | There are **two** San Mateo County Leagues, and both take positions on SMC measures (details below). LWV Palo Alto takes a position on PA Measure J. |
| Santa Clara: mayor races in Santa Clara city and Sunnyvale | The mayor races are **Santa Clara city, Milpitas and Morgan Hill**. Sunnyvale has only D1, D3 and D5 council seats, each with one candidate. |
| vote.santaclaracounty.gov "fully bot-blocked; no candidate data" | It loads in a browser. It has a qualified-candidate PDF with a text layer, an HTML measures list, and an address-to-precinct sample-ballot app (details below). |
| SMC "12 cities with measures" | Confirmed: 17 city measures across 12 cities, plus 7 school measures, 4 county measures and RTM, for **29 measures in all**. |
| Local Mercury News picks: "not yet" | Still true. Since 9/25–9/29 it has published only statewide picks (Ma, Allen, Kounalakis). |

---

## 1. Guide table

Abbreviations: SMC = San Mateo County, PA = Palo Alto, MV = Mountain View. "Reasons" means the guide explains each pick. "List" means it gives picks only.

### Newspapers

| Guide | Type | Homepage | Nov 2026 endorsements URL | Published? | Reasons? | Format | Areas | Paywall |
|---|---|---|---|---|---|---|---|---|
| San Mateo Daily Journal | newspaper | https://www.smdailyjournal.com/ | Running roundup: https://www.smdailyjournal.com/opinion/editorials/daily-journal-endorsements-for-the-san-mateo-county-november-election/article_9e726e39-e27e-4b9b-ba42-5addaf7dab5b.html (2026 content verified). Index: https://www.smdailyjournal.com/opinion/editorials/ | **Yes, rolling.** So far: Nagales (BOS D5), Guingona (SMCCCD TA2), Johnson (County BOE TA2), Harris and Proctor (SMUHSD), Hsieh and Richardson (SSFUSD), Shiran (Sequoia), Lipkin, Chawla and Tripathi (San Carlos SD), Venkat (Foster City D1), Nicolas (SSF D3), Nash, Newsom and Sahae (San Mateo D1/D3/D5), Yes on D (Burlingame), Yes on I (HMB), No on E (Redwood City) | Yes (one editorial per race) | HTML | SMC | **Metered** ("Subscription to continue" in the page) |
| Palo Alto Daily Post | newspaper | https://padailypost.com/ | Election hub: https://padailypost.com/2026/10/02/your-november-election-guide/ . Editorials: [council](https://padailypost.com/2026/10/03/daily-post-editorial-elect-chang-lauing-veenker-to-council/) (Chang, Lauing, Veenker); [PAUSD](https://padailypost.com/2026/10/05/daily-post-editorial-wang-and-craig-for-school-board/) (Wang, Craig); [Valley Water D7](https://padailypost.com/2026/09/29/daily-post-editorial-elect-pete-dailey-to-valley-water-board/) (Dailey); [Menlo Park P](https://padailypost.com/2026/10/03/daily-post-editorial-vote-yes-on-p-to-save-downtown/) (Yes) | **Yes, rolling** | Yes | HTML | PA, MV (Valley Water D7), SMC (Menlo Park) | **None** (says so on the hub page) |
| Palo Alto Weekly / Palo Alto Online | newspaper (nonprofit) | https://www.paloaltoonline.com/ | Voter guide hub: https://www.paloaltoonline.com/election/voter-guide-2026/ | **Not yet.** No 2026 editorial endorsements on the opinion or election pages. The Weekly's candidate forum is Oct 7. | — (it historically gives reasons; unverified for 2026) | HTML | PA | None observed |
| Mountain View Voice | newspaper (nonprofit) | https://www.mv-voice.com/ | Voter guide hub: https://www.mv-voice.com/election/voter-guide-2026/ (Q&As and comparison grids) | **Not yet.** It is unverified whether the Voice still endorses at all. | — | HTML | MV | None observed |
| The Almanac | newspaper (nonprofit) | https://www.almanacnews.com/ | https://www.almanacnews.com/election/voter-guide-2026/ | **Not yet.** Guest opinions on Measure P only. | — | HTML | SMC (Menlo Park, Atherton, Woodside, Portola Valley) | None observed |
| Redwood City Pulse | newspaper (nonprofit) | https://www.rwcpulse.com/ | https://www.rwcpulse.com/election/ | **Not yet** | — | HTML | SMC (Redwood City) | None observed |
| Los Altos Town Crier | newspaper | https://www.losaltosonline.com/ | Editorials index: https://www.losaltosonline.com/opinion/editorials . 2026 general so far: [Measure D is a mistake](https://www.losaltosonline.com/opinion/town-crier-measure-d-is-a-mistake/article_5baa06a9-1a33-4188-9113-43ebcf443a8d.html) (9/29; Los Altos) | Partial. Los Altos D only. In 2024 it also endorsed an MV measure (G). | Yes | HTML | Los Altos (MV adjacent); MV picks possible later | Subscription prompts; body text loaded |
| Half Moon Bay Review | newspaper | https://www.hmbreview.com/ | https://www.hmbreview.com/opinion/editorials/ | **Not yet** | — | HTML | SMC coast | Unverified |
| Coastsider | news site | https://coastsider.com/ | — | **Unverified.** Site down (520). It historically endorses in HMB and coast races. | — | — | SMC coast | — |
| Mercury News | newspaper | https://www.mercurynews.com/ | https://www.mercurynews.com/opinion/endorsements/ | Statewide only (Ma, Allen, Kounalakis, 9/25–29). No PA, MV or SMC local picks yet. | Yes | HTML | (would cover PA, MV, SMC) | Paywalled |
| SF Chronicle (already in SF set) | newspaper | — | RTM editorial (see first pass) | RTM only | Yes | HTML | RTM in all 3 areas | Paywalled |

### Parties

| Guide | Type | Homepage | Nov 2026 URL | Published? | Reasons? | Format | Areas | Paywall |
|---|---|---|---|---|---|---|---|---|
| San Mateo County Democratic Party | party | https://www.smcdems.org/ | https://www.smcdems.org/ (homepage block). Image: https://assets.nationbuilder.com/smcdcc/pages/116/attachments/original/1788916751/unnamed.png | **Yes** (voted 9/3) | List | **PNG image only** (needs OCR or manual entry) | SMC | No |
| San Mateo County Republican Party | party | https://smgop.org/ | https://smgop.org/voter-guide and https://smgop.org/s/SMGOP-November-2026-Election-Guide.pdf | **Yes** | One-line rationale per prop and measure; candidates are list-only | HTML + PDF (text layer) | SMC | No |
| Santa Clara County Democratic Party | party | https://sccdp.org/ | https://sccdp.org/index.php/voter-resources/endorsements/2026-endorsements/ | **Yes.** PA council: Deng, Veenker. MV council: Paymer, Poicon, Sylvester. PAUSD: Henigin. MVWSD: Conley. MVLA TA3: Cornes. Valley Water D7: Dailey. Midpen W1: Gleason. Yes on MV E, MV F, PA J and RTM. | List (names link to campaign sites) | HTML (the page also still holds the June slate below) | PA, MV | No |
| Santa Clara County Republican Party | party | https://www.svgop.com/ | https://www.svgop.com/voter-guide (JPG card) | **Yes** | One-line rationale per prop and RTM | **JPG image** | PA and MV: state, federal, props, RTM (No) only; no local picks | No |

### Democratic clubs

| Guide | Type | Homepage | Nov 2026 URL | Published? | Reasons? | Format | Areas | Notes |
|---|---|---|---|---|---|---|---|---|
| Silicon Valley Young Democrats | club | https://www.svyd.org/ | https://www.svyd.org/2026-general-endorsements | Yes, but the page **mixes June items** (Arenas D1, County Measure D) | List | HTML with image tiles | San Jose-centric; **no PA or MV picks** | Low value |
| Peninsula Young Democrats | club | Not found | bluevoterguide endorser page (403 to bots); search snippets show **2024** picks | **Unverified** | — | — | SMC, PA, MV | Gap |
| Peninsula Democratic Coalition | club/PAC | No website found (FEC PAC C00427203 only) | — | **Unverified / likely none** | — | — | SMC | Gap |
| Palo Alto, Mountain View and Menlo Park Democratic clubs | club | No active sites found (mvdems.org and paloaltodemocrats.org do not resolve) | — | **Unverified / none found** | — | — | — | Gap |

### Labor

| Guide | Type | Homepage | Nov 2026 URL | Published? | Reasons? | Format | Areas |
|---|---|---|---|---|---|---|---|
| San Mateo County Central Labor Council | union | https://www.sanmateolaborcouncil.org/ | https://www.sanmateolaborcouncil.org/endorsements . Three Word files: [/s/2026G-SMC-Ballot-Measure-Endorsements.docx](https://www.sanmateolaborcouncil.org/s/2026G-SMC-Ballot-Measure-Endorsements.docx), [/s/SMCLC-2026G-Endorsements_Slate-Card.docx](https://www.sanmateolaborcouncil.org/s/SMCLC-2026G-Endorsements_Slate-Card.docx), [/s/2026G-State-and-Federal-Endorsements.docx](https://www.sanmateolaborcouncil.org/s/2026G-State-and-Federal-Endorsements.docx), plus a flyer PNG | **Yes**. 20 local measures (all Support), about 18 city and 10 school races, all statewide offices and props | List | **.docx** (clean text with `textutil` or pandoc) + PNG | SMC |
| South Bay AFL-CIO Labor Council | union | https://www.southbaylabor.org/ | https://www.southbaylabor.org/2026_endorsements | **Yes**. PA council: Veenker, Deng (both "sole"). MV council: Poicon, Sylvester, Kuszmaul. PAUSD: Henigin. MVWSD: Conley. MVLA TA2: Kamei; TA3: Cornes. Valley Water D7: Dailey. Yes on MV E, MV F, PA J and RTM. | List (sole or open) | HTML | PA, MV |
| SEIU 1021 (already in SF set) | union | https://www.seiu1021.org/ | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 | Yes. Santa Clara section: RTM Yes; MV council: Poicon only. **No SMC section.** | List | HTML | MV (thin) |

### Advocacy

| Guide | Type | Homepage | Nov 2026 URL | Published? | Reasons? | Format | Areas |
|---|---|---|---|---|---|---|---|
| YIMBY Action (national page; chapters: Peninsula for Everyone, San Mateo Forward, Yes in Redwood City, Mountain View YIMBY, South Bay YIMBY) | advocacy | https://yimbyaction.org/ | https://yimbyaction.org/endorsements/november-2026-california-general | **Yes**. SMC: Nagales (BOS D5), Venkat (Foster City D1), Sturken (RWC D2), Patel (San Mateo D3), Loraine (San Mateo D5), Harman (San Bruno D4), No on Menlo Park P. **MV: Kuszmaul only. PA: none.** State: Yes 1, Yes 37, No 43. | List (reasons on chapter pages) | HTML | SMC, MV |
| Peninsula for Everyone | advocacy (YIMBY chapter) | https://peninsulaforeveryone.org/ | https://peninsulaforeveryone.org/endorsements/2026-endorsements/2026-endorsements/ | Yes, but the page includes stale June picks | **Yes** | HTML | SMC |
| South Bay YIMBY / San Mateo Forward (chapter sites) | advocacy | https://southbayyimby.org/ , https://sanmateoforward.org/ | Both `/endorsements/` pages say "No current endorsements". South Bay shows only "2026 South Bay Primary". | **No general page** | — | — | — |
| Palo Alto Forward | advocacy (housing/transit) | https://www.paloaltoforward.com/ | https://www.paloaltoforward.com/2026-election-center | **Yes, measures only**: Yes on PA J, RTM and Prop 1; No on Prop 43. It also comments on Menlo Park P (whether it takes a formal position is unverified). **No candidates.** | Short reasons | HTML | PA (+ RTM, props) |
| SV@Home Action Fund | advocacy (housing) | https://siliconvalleyathome.org/ | https://siliconvalleyathome.org/action-fund/2026-election-voter-guide/ | **Yes, measures only**: Yes on 1, RTM, 4, MV E, MV F; No on 39, 42, 43, 45, Los Altos D. **No position on PA J.** | **Yes** | HTML | MV, PA (props/RTM) |
| Mountain View YIMBY / Livable Mountain View | advocacy | livablemv.org has lapsed (spam); no MV YIMBY site found | MV YIMBY appears only as an endorsing chapter on YIMBY Action (e.g. AD23) | Via YIMBY Action only | — | — | MV |
| Sierra Club Loma Prieta | advocacy (environment) | https://www.sierraclub.org/loma-prieta | https://www.sierraclub.org/loma-prieta/november-3-2026-sierra-club-california-and-loma-prieta-chapter-general-election | **Yes** (read in browser). PA: Lauing, Veenker, Chang. MV: Cox, Paymer, Sylvester. Midpen W1 Gleason, W2 Kishimoto, W5 Holman. FHDA TA4 Chao. SMC: Granada CSD (Dye, Allen, Tierney), Pacifica D2 Boles, D3 Abbott, D5 Meiman, HMB D1 Gorn, D4 Ruddock, Millbrae D3 Schneider, San Mateo D1 Nash, D3 Newsom, EPA Abrica, Menlo Park Combs (D2). Props: Yes 1, 4, 5; No 39, 43, 45. **No local measures and no RTM position.** | List | HTML (curl blocked) | SMC, PA, MV |
| Santa Clara County LCV | advocacy (environment) | https://www.scclcv.org/ | https://www.scclcv.org/scclcv-endorsements/ | **Yes**. PA: Veenker. MV: Donahue, Sylvester, Paymer. Local candidates only. | List | HTML | PA, MV |
| Greenbelt Alliance | advocacy (land use) | https://www.greenbelt.org/ | https://www.greenbelt.org/voter-guide-26/ | **Yes**. SMC: Yes L (county), Yes Q (HMB), No P (Menlo Park). Also Yes RTM; No 43, 45. **Nothing PA- or MV-specific.** | **Yes** (blog post per measure) | HTML | SMC (+ RTM, props) |
| Committee for Green Foothills | advocacy (c3; measures only) | https://www.greenfoothills.org/ | https://www.greenfoothills.org/gfs-voter-guide-november-2026-election | **Yes**: Yes 1, No 43, No 45, Yes HMB Q | **Yes** | HTML | SMC (HMB) + props |
| Bay Rising Action | advocacy (progressive) | https://bayrisingaction.org/ | https://bayrisingaction.org/voterguide/ | Yes. SMC: Yes on Redwood City E, Yes RTM. Santa Clara: no PA or MV items. | **Yes** | HTML + PDF | SMC (RWC) |
| California Working Families Party | party (minor) | https://www.caworkingfamilies.org/bay-area | PDF: http://caworkingfamilies.org/voter-guide-general-election-2026.pdf (13.7 MB, text layer) | **Yes**. SMC: Daus-Magbual (Daly City), Abrica and Bello (EPA), Venkat (Foster City), Boles and Casillas (Pacifica), Sturken (RWC), Marty Medina (San Bruno), Nagales (BOS), Dana Johnson (BOE), Allyson Chan (SMFCSD), Diana Harris (SMUHSD), Pamukcu, Flores and Olson (SSF). **MV: Poicon, Sylvester.** PA: none. | Props: yes; candidates: list | PDF | SMC, MV |
| Courage California Progressive Voters Guide | advocacy | https://www.progressivevotersguide.com/ | .../california/2026/general/county/sanmateo and .../santaclara | Yes, but **only federal, state legislative and prop races**; no PA, MV or SMC city races | Yes | HTML | all 3 (state level) |
| SPUR | civic/policy | https://www.spur.org/ | https://www.spur.org/voter-guide/2026-11 | Yes. **RTM and state props only** apply here (no SMC, PA or MV local measures). | **Yes** | HTML | all 3 (RTM, props) |
| Silicon Valley Bicycle Coalition | advocacy | https://bikesiliconvalley.org/ | None found on the site (read in browser; Cloudflare blocks curl) | **No / unverified** | — | — | — |
| Housing Leadership Council SMC | advocacy | https://hlcsmc.org/ | Endorses projects, not elections | n/a | — | — | — |

### Civic (League of Women Voters; Leagues don't endorse candidates)

| Guide | Type | Homepage | Nov 2026 URL | Published? | Reasons? | Format | Areas |
|---|---|---|---|---|---|---|---|
| LWV South San Mateo County | civic | https://lwvssmc.org/ (redirects to my.lwv.org) | https://my.lwv.org/california/south-san-mateo-county/advocacy-action/vote-league | **Yes**. **No on Menlo Park P** (official opponent), Yes on Portola Valley N, Yes on county AA, J, L and U, Yes RTM. Props: Yes 1–5; No 37–39 and 41–45; Neutral 40. No position on CC, E (RWC), O or V. | **Yes** (PDF per measure) | HTML + PDFs | SMC (south) |
| LWV North & Central San Mateo County | civic | https://lwvncsmc.org/ (Google Sites) | https://sites.google.com/lwvncsmc.org/lwvncsmc/elections/vote-wthe-league | **Yes**: Yes on county U and J; links to LWVC and LWV Bay Area for props and RTM | **Yes** | HTML | SMC (north/central) |
| LWV Palo Alto | civic | https://www.lwvpaloalto.org/ | https://www.lwvpaloalto.org/content.aspx?page_id=22&club_id=366290&module_id=530740 | **Yes**: **Supports PA Measure J**, supports RTM; pros and cons | **Yes** (Google Drive PDFs) | HTML + Drive PDFs | PA |
| LWV Los Altos-Mountain View | civic | https://lwvlamv.org/ | https://lwvlamv.org/content.aspx?page_id=22&club_id=733500&module_id=690258 | Opposes **Los Altos D** (homepage). **No MV E or F position found** (education only). | Yes (D analysis) | HTML | MV (none), Los Altos |
| LWV California (already in SF set) | civic | https://lwvc.org/ | https://lwvc.org/ballot-recommendations-nov-3-2026/ | Yes (props) | Yes | HTML | all 3 |

### Counts by area

Counting guides with any Nov 2026 pick in that area, including multi-area guides. Statewide-only and RTM-only guides (LWVC, SPUR, Courage, SF Chronicle, Mercury) are excluded.

| Area | Guides found | Published with Nov local picks | With reasons |
|---|---|---|---|
| **San Mateo County** | 26 | **15**: SMDJ, SMCDems, SMGOP, SMCLC, YIMBY Action, P4E, Sierra LP, Greenbelt, Green Foothills, Bay Rising, CA WFP, LWV SSMC, LWV NCSMC, Daily Post (Menlo P), Palo Alto Forward (P comment, unverified) | **9**: SMDJ, SMGOP (one-liners), P4E, Greenbelt, Green Foothills, Bay Rising, LWV SSMC, LWV NCSMC, Daily Post |
| **Palo Alto** | 16 | **7**: Daily Post, SCCDP, SBLC, Sierra LP, SCCLCV, Palo Alto Forward, LWV PA (SCC GOP covers props and RTM only) | **3**: Daily Post, Palo Alto Forward, LWV PA |
| **Mountain View** | 16 | **9**: SCCDP, SBLC, SEIU 1021, YIMBY Action, Sierra LP, SCCLCV, SV@Home, CA WFP, Daily Post (Valley Water D7) | **2**: SV@Home (E/F), Daily Post (D7 only) |

---

## 2. Ballot contests beyond statewide

Statewide contests on every ballot:
- Governor, Lt. Gov, SoS, Controller, Treasurer, AG, Insurance Commissioner, Superintendent of Public Instruction.
- Supreme Court retention: Groban, Evans.
- Props 1, 2, 3, 4, 5, 37, 38, 39, 40, 41, 42, 43, 44 and 45 (14 props; confirmed on the SCC sample ballot).

### Sources and machine-readability

**San Mateo County ACRE**
- Election page: https://smcacre.gov/elections/november-3-2026-statewide-general-election
  - Measure list with letters and short titles is plain HTML (easy to parse).
  - Each measure links to resolution, impartial-analysis and argument PDFs via `/archival-document?document=...`.
- Roster of Candidates (qualified only, printed 9/3/2026): https://smcacre.gov/system/files/2026-09/52_candidateroster0903.pdf
  - Text-layer PDF. `pdftotext -layout` plus a regex on `^(\d{4})\s+<contest>…Vote for N…On Ballot: Yes|No` and `Qualified: n NAME` parsed **141 contests** cleanly.
  - Includes an "On Ballot" flag (uncontested at-large seats are No).
- Precinct and district info: https://smcacre.gov/elections/precinct-and-district-information

**Santa Clara County ROV** (all of these 403 to curl; they load in a browser)
- Election page: https://vote.santaclaracounty.gov/elections/november-3-2026-general-election
- Resources: https://vote.santaclaracounty.gov/november-3-2026-general-election-resources
- Final Qualified List of Local Candidates: https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf?VersionId=CM6jbwAVTLFIjLakj6hJku2l9KPAIxli
  - Text-layer PDF, same CFMR009 report format as SMC, so the same parser works. **129 contests**.
  - The file is named 9-28-26, but the footer says printed 8/27/2026.
  - It includes cross-county districts (Stanislaus BOE, Patterson, Yosemite CCD).
  - Fetch it in a browser context: `fetch()` plus base64 works.
- State candidates: https://files.santaclaracounty.gov/exjcpb1296/2026-08/qualified-state-8.28.2026-qualified-state-v2.pdf?VersionId=JdB0.vgbC5DbHd657pQtExZjVdSHBAHy
- List of Local Measures (HTML with letter, jurisdiction, title, vote threshold and full question): https://vote.santaclaracounty.gov/list-local-measures-4
- List of Offices: https://vote.santaclaracounty.gov/november-3-2026-general-election-list-offices
- **Address to sample ballot**: https://rovservices.sccgov.org/Home/IndexPost?selected=vg leads to an Omniballot (Democracy Live) CVIG at `https://ca.omniballot.us/sites/06085/site/app/cvig/vg/info?pid=<precinct>&lang=en`, then "Sample of Ballot".
  - Shows the full per-precinct ballot (contests, candidates, measure letters, ballot style).
  - JS app, but scrapeable. **This is the best per-address contest source.**

### San Mateo County (whole county)

**District contests:**
- CD15 (Mullin vs Hoelter) and CD16 (Liccardo vs Sundin Soulé)
- AD19 (Stefani vs Wing), AD21 (Papan vs Muhawieh), AD23 (Berman vs D. Johnson)
- BOE D2 (Lieber vs Pimentel)
- No State Senate race
- Court of Appeal: **1st District** retention. Names not pulled; the SCC ballot shows the 6th District, which doesn't apply here.

**County offices:**
- Board of Supervisors **D5, short term**: Mark Nagales vs Juslyn Cabrera Manalo
- County Board of Education TA2: Beverly Gerard vs Dana Johnson. TA1 (Alvaro) and TA3 (Baker) are uncontested and not on the ballot.

**County measures** (all majority vote): L, Extreme Weather Events charter amendment; AA, Affirmation of Rights; J, Extension to Call a Special Election or Appoint; U, Reapportionment of Supervisorial Districts (independent commission).

**Regional:** RTM, Public Transit Revenue Measure District sales tax. It has no letter on the SMC page.

**School measures:** R Burlingame SD bond; Z Cabrillo USD parcel tax; M Jefferson Union HSD parcel tax; T Pacifica SD parcel tax; K San Carlos SD parcel tax; V SMCCCD bond; W San Mateo-Foster City SD bond.

**City measures:**
- Y Belmont special tax (community center)
- X Brisbane business license tax
- D Burlingame TOT
- O East Palo Alto bond
- CC East Palo Alto term limits (charter)
- I Half Moon Bay coastal land use
- Q Half Moon Bay housing initiative (senior farmworker housing)
- P Menlo Park citizen initiative (downtown parking plazas)
- BB Pacifica transactions and use tax
- N Portola Valley town charter + property transfer tax
- E Redwood City rent control and eviction limits initiative
- S San Bruno housing permits and developments
- DD San Bruno fireworks ban
- EE San Bruno business license tax
- G San Carlos transactions and use tax
- H San Mateo transactions and use tax
- F San Mateo charter amendment

**Contested on-ballot local races** (from the 9/3 roster):

School:
- SMCCCD TA2: Mike Guingona, Jason Holt
- Cabrillo USD TA C: Peter Tokofsky, Lizet Cortes-Ronquillo
- Cabrillo USD TA E: Mary Beth Alexander, Andrea Rosenthal
- SSFUSD TA C: Chialin Hsieh, Avin Sharma
- SSFUSD TA E: Frank Lara, Mina A. Richardson
- SMUHSD TA3: Diana Harris, Jennifer Jacobson
- SMUHSD TA5: Kimo Rosenbaum, Alison Proctor
- Sequoia UHSD TA A: Amy Koo, Alon Shiran
- Sequoia UHSD TA D: Michael Dekshenieks, Sathvik Nori (**Nori withdrew 8/28 and endorsed Dekshenieks, but remains on the ballot**; RWC Pulse)
- Brisbane SD (3 seats): Charlene Larson, Morgan Finlay, Emily Wirowek, Sarah Duffy
- Menlo Park City SD (3): Jed Scolnick, Maya Herstein, Sherwin Chen, Andrew Barnes
- Pacifica SD full term (3): Bridget Hardt, Rachel Durkin, Grace Sobieski, Tiffany Button, Christopher Swiedler, Katy Bradley, Laverne R. Villalobos
- Pacifica SD short term: Kelly Mendoza, Tracey Simmons, Elizabeth A. Bredall
- San Carlos SD (3): Boris Lipkin, Richard F. Wahl, Megha Chawla, Shivani Tripathi

City:
- Belmont Mayor: Julia Mates (unopposed but on the ballot)
- Belmont D1: Gina Latimerlo; D3: Sarah K.M. Delisle (both unopposed)
- Brisbane (2 seats): Julie Sims, Charles Spencer, Madison Davis, Chaya-Bella David, Christopher Hornick
- Burlingame D1: Andrea Pappajohn; D3: Jen Faber vs Howard Wettan; D5: Peter W. Stevenson
- Colma (2): Helen Fisicaro, Laura M. Walsh, Joanne F. Del Rosario, Elisabeth Aurora Jenson
- Daly City (3): Thomas A. Nuris, Pamela DiGiovanni, Teresa Proaño, Tony Bayudan, Rod Daus-Magbual, Asia Su, Barry Rodriguez
- East Palo Alto (2): Holifa Windom, Gail Wilk Dixon, Ruben Abrica, Sam Jimenez, Ofelia Bello, Deborah Lewis-Virges, Michael Mashack
- Foster City D1: Art Kiesel vs Phoebe Shin Venkat; D2: Stacy Jimenez
- Half Moon Bay D1: Robert Brownstone vs David Gorn; D4: Ron Kies vs Debbie Ruddock; D5: Susie Morasci vs Steven R. Booker
- Menlo Park D1: James Rohr vs Wonman Lee; D2: Drew Combs vs Vamsi Velagapudi; D4: Charlotte Reed vs Laura Melahn
- Millbrae D2 full: Sissy Riley; D3 short: Juan Gámez vs Ann Schneider; D4 full: Albert Yam vs Bob Nguyen
- Pacifica D2: Christine Boles vs Dan Urban; D3: Cindy Abbott; D5: Margo Meiman vs Sam Casillas
- Portola Valley (3): Mary Hufty, Craig S. Taylor, Judith A. Hasko (3 candidates, on ballot)
- Redwood City D2: Chris Sturken; D5: Kaia Eakin; D6: Diane Howard (all unopposed)
- San Bruno Mayor: Rico E. Medina (unopposed); D1: Jennifer M. Blanco vs Kingsley Ma; D4: Marty P. Medina vs Auros Harman
- San Carlos (3): Pranita Venkatesh, Sara McDowell, Adam Rak, Mark D. Iwanowski
- San Mateo D1: Taso Zografos vs Lisa Diaz Nash; D3: Seema Patel vs Robert G. Newsom Jr.; D5: Dave Johnson, Dana Yates Sahae, Adam Loraine
- South San Francisco D1: Aysha Dominguez Pamukcu; D3: Buenaflor (Flor) Nicolas, Sophia Cyris, Melanie Olson; D5: Eddie Flores; City Clerk: Rosa Govea Acosta; Treasurer: Frank Risso
- Woodside D2: Lyle Weaver; D3: Daniel Druker

Special districts on the ballot:
- Coastside County Water D. Zone 5: Nancy Eleanora Poss vs Joey P. Silva
- Coastside Fire D: Ryan McGraw vs Cynthia Sherrill
- Coastside Fire E: Gary Burke vs Alex Carrillo
- Granada CSD (3): Barbara Dye, Kevin W. Sniecinski, Matt Allen, Patrick Tierney

**Not on the ballot** (uncontested, so appointed in lieu of election): Atherton, Hillsborough, all of Jefferson ESD, Las Lomitas, Millbrae ESD, Ravenswood, Redwood City SD, San Bruno Park, SMFCSD, Woodside ESD, Hillsborough CSD, Belmont-Redwood Shores, Burlingame SD, Bayshore ESD, Portola Valley SD, La Honda-Pescadero, Jefferson UHSD, SMUHSD TA1, Midpen W5/W6 (SMC portion), Harbor District, Sequoia Healthcare, Peninsula Health Care, Menlo Park Fire, West Bay Sanitary, and the other special districts. The full list is in the roster.

**Counts:** 141 roster contests. On the ballot: 13 state/federal, 1 county office, 16 school, 42 city (18 of them with one candidate), 4 special district. Plus 29 measures. **About 63 local candidate contests on the ballot (about 45 actually contested) and 29 local measures, before RTM.**

Gotcha: the SMCDems image labels Christine Boles "Pacifica, District 1". The roster has her in **District 2**. Normalize to the roster.

### Palo Alto (Santa Clara County)

Verified from the Omniballot sample ballot for precincts 0002049 (downtown, Ballot Type 1) and 0002019 (Midtown/south, also Type 1). PA appears to have a single ballot style.

- CD16: Sam Liccardo vs Peter Sundin Soulé
- AD23: Marc Berman vs David G. Johnson
- BOE D2: Sally Lieber vs John Pimentel
- Court of Appeal, **6th District** retention: Charles E. Wilson II, Frederick S. Chung, Charles F. Adams, Allison Marston Danner, Daniel H. Bromberg
- **Palo Alto Unified SD** (vote for 2): Linda Henigin, Avery Wang, John Craig
- **Palo Alto City Council** (vote for 3): Brian Hamachek, Bryna Chang, Ed Lauing, Yu "Yudy" Deng, Raymond L. Goins, Gary Gechlik, Vicki Veenker, Henry Etzkowitz
- **Santa Clara Valley Water District D7**: Pete Dailey vs Rebecca Eisenberg (incumbent)
- **RTM**: Connect Bay Area Transit (0.5% in SCC)
- **Measure J**: Palo Alto Community Safety/Services ½¢ sales tax (Cubberley; about $15.6M a year; majority vote)

No Santa Clara County measures and no county offices are on the Nov ballot. Supervisor D5 is not up.

Total: **5 local contests** (PAUSD, council, Valley Water D7, J, RTM), plus 3 district contests and 5 Court of Appeal retention votes.

Possible but unverified: foothill parcels in ZIPs 94022/94028 may sit in other special-district wards. The FHDA TA4 and Midpen W1 contests do **not** appear on either sampled PA ballot.

### Mountain View (Santa Clara County)

Verified from Omniballot precinct 0003401 (downtown, 500 Castro) and 0003438 (2500 Grant Rd). Both are Ballot Type 65.

- CD16, AD23, BOE D2, and Court of Appeal 6th District retention: same as Palo Alto
- **Mountain View-Los Altos Union HSD, TA3**: Thida Cornes, Sanjay Dave, Catherine Vonnegut. TA1 (Nir Paz) and TA2 (Ellen Kamei) are uncontested and not on the ballot.
- **Mountain View Whisman SD** (vote for 2): Devon Conley, William Lambert, Sundar Subbarayan, Quintin Riis
- **Mountain View City Council** (vote for 3): James Kuszmaul, Robert Cox, Erik Poicon, Silja Paymer, Samuel Ali, Alex Amoroso, Paul Donahue, IdaRose Sylvester
- **Santa Clara Valley Water D7**: Pete Dailey vs Rebecca Eisenberg
- **RTM**
- **Measure E**: MV charter amendment, modernizing provisions
- **Measure F**: MV transient occupancy tax (10% up to 15%; up to $5.2M a year)
- **Measure S**: El Camino Healthcare District, four-term limit for directors. The district covers MV, Los Altos, LAH and part of Sunnyvale.

Total: **8 local contests**, plus 3 district contests and 5 retention votes.

Possible variation (unverified): parts of MV are in **Los Altos SD**, where 4 candidates run for 3 seats (David Poll, Brandon Stroy, Vaishali "Shali" Sirkay, Bryan Harvey Johnson), and a few areas may be in other MVLA trustee areas. Check more precincts through Omniballot.

### Other SCC measures (for reference)
- A Morgan Hill treasurer appointive
- B Gilroy TOT
- C Santa Clara public-works charter
- D **Los Altos** parking plazas initiative
- G, H and I Sunnyvale charter amendments
- K Milpitas business tax
- L Cupertino General Plan (parks; 2/3)
- M Gilroy USD bond
- N LGSUHSD bond
- O and P Alum Rock SD (parcel tax, bond)
- Q Cambrian SD parcel tax
- R Orchard SD parcel tax
- S El Camino Healthcare

---

## 3. ZIP codes

From Census 2020 ZCTA relationship files (`tab20_zcta520_county20_natl.txt` and `tab20_zcta520_place20_natl.txt`), plus PO-box-only ZIPs from USPS knowledge (not ZCTAs; unverified here).

**San Mateo County** (ZCTAs that intersect the county):
- Fully in the county: 94002, 94005, 94010, 94014, 94015, 94018, 94019, 94020, 94021, 94025, 94027, 94030, 94037, 94038, 94044, 94060, 94061, 94062, 94063, 94065, 94066, 94070, 94074, 94080, 94128 (SFO), 94401, 94402, 94403, 94404
- **Split**: 94028 (about 81% SMC: Portola Valley; the rest is Santa Clara/LAH/PA foothills) and **94303 (about 33% SMC: East Palo Alto; the rest is Palo Alto and MV baylands)**
- PO-box-only (unverified): 94011, 94016, 94017, 94026, 94064, 94083, 94497

**Palo Alto (city):**
- Residential core: 94301, 94303 (shared with EPA), 94304, 94306
- Foothills/open space: 94022 (shared with Los Altos/LAH), 94028 (shared with Portola Valley), 95033 sliver
- 94305 is Stanford (unincorporated, not PA city) and has 0% PA land
- PO-box-only (unverified): 94302, 94309

**Mountain View (city):**
- 94040, 94041, 94043 (72% MV; includes Moffett Field/NASA Ames)
- Slivers: 94303 (4% of MV land, the baylands), 94085 (Sunnyvale)
- PO-box-only (unverified): 94039, 94042; 94035 is Moffett Field

**Gotcha:** 94303 spans two counties and three cities (EPA in SMC; Palo Alto; MV baylands). 94022 and 94028 also cross county and city lines. ZIP alone can't route a voter. Ask for an address, or show a picker for 94303/94022/94028.

---

## 4. Gaps and next steps

1. **No newspaper endorsements yet from the Embarcadero papers** (Palo Alto Weekly, MV Voice, Almanac, RWC Pulse). They are free, nonprofit papers covering the target areas. Expected mid-to-late October (unverified for 2026). It is unclear whether MV Voice still endorses.
2. **Mountain View has the thinnest set of guides with reasons.** Only SV@Home (E/F) explains its MV picks. No MV-specific YIMBY, Livable MV (domain lapsed) or LWV LAMV position on E/F was found. Watch: Town Crier, MV Voice, Mercury News.
3. **Palo Alto Measure J**: Yes from SCCDP, SBLC, Palo Alto Forward and LWV PA. The **Daily Post has raised appraisal questions but has not yet endorsed** on J. SV@Home has no position. No organized "No" guide was found.
4. **Image-only slates**: SMCDems (PNG) and SCC GOP (JPG) need OCR or manual entry. SMCLC uses .docx.
5. **Stale or mixed pages**: P4E, SVYD and SCCDP still include June primary items on the same page. The ingest must filter by contest.
6. **Clubs not found**: Peninsula Democratic Coalition, Peninsula Young Democrats (bluevoterguide shows only 2024), and the PA, MV and Menlo Park Democratic clubs. **Not checked**: chambers of commerce, MV Mobile Home Alliance, Palo Alto Neighborhoods, SMC Building Trades, police and fire unions. Any of these may endorse.
7. **SMC Court of Appeal (1st District) retention names** were not pulled. Get them from an SMC sample ballot or the SoS certified list.
8. **Ballot-style variation**: only 2 PA and 2 MV precincts were sampled. Run more Omniballot lookups (Los Altos SD portion of MV; PA foothills) before shipping the address filter.
9. **SCC candidate list** says "printed 8/27" despite the 9-28 filename. Re-check before launch. The SMC roster is dated 9/3.
10. **Coastsider** was down (520). Recheck it for HMB and coast picks.
