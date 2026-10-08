# Bay Ballot Alameda County discovery (Nov 3, 2026)

Researched 2026-10-07. This builds on the Alameda section of `docs/investigations/2026-10-06-bay-area-guide-discovery.md` and corrects it where it was wrong. No extraction was run; nothing here called the Anthropic API.

**Status labels**
- **Verified**: I loaded the URL on 2026-10-07 and saw Nov 2026 picks. Picks listed below are what the page says, not inferred.
- **Pending**: the guide exists and says picks are coming, or has 2026 activity but no Nov picks yet.
- **Unverified**: I could not confirm it. The reason is given.

**Access notes** (curl with a normal Chrome user agent, then a real browser when curl failed)
- `acdems.org` (Alameda County Democratic Party) and `apademcaucus.org` (APA Democratic Caucus) return **403 with a "Please wait" bot wall** to curl. Both load in a browser after a redirect, and PDFs on acdems.org download with `fetch()` from inside the page.
- `sierraclub.org` returns a tiny bot-wall stub (212 bytes) to curl and loads in a browser, as on the Peninsula.
- `vote.eastbaydsa.org` (East Bay DSA) is a single-page app. curl gets an empty shell. The page text needs a browser; the data is also served as `/terminal-races.json` and `/race-content/<chapter>/<race>.txt`.
- `blackactionalliance.org` is a JS app (empty to curl).
- The Alameda Labor Council slate is a Google Doc. `https://docs.google.com/document/d/<id>/export?format=txt` returns the full text to curl.
- Everything else below returned 200 with full text to curl.
- `oaklandca.gov` returned 403 to curl for the City Clerk's qualified-candidate PDF. Not needed: the county list covers it.

## Corrections to the first pass

| First-pass claim | Correction |
|---|---|
| Alameda County Democratic Party: "Yes per Oaklandside; direct fetch got 403", format "List (unverified)" | **Published 2026-09-14** as two press-release PDFs linked from https://acdems.org/press-release/ : candidates (https://acdems.org/wp-content/uploads/2026/09/ACDP-September-2026-Endorsements-Press-Release.docx.pdf) and measures (https://acdems.org/wp-content/uploads/2026/09/ACDP-November-2026-Ballot-Measure-Endorsements-Press-Release.docx-1.pdf). 76 candidate contests (74 on the ballot) and **Yes on all 28 measures** (27 local plus RTM). List only. |
| Alameda Labor Council: "Unverified (the doc body did not render)" | **Published**, last updated 2026-09-17. The txt export works. About 60 local contests plus state races and props. Uses "Dual Endorsement" and "Open Endorsement". |
| Metropolitan-Greater Oakland Dems: reasons "Unverified" | Verified list, no reasons. 7 candidates, EE, FF, RTM and props. |
| Wellstone: "Yes per Oaklandside", reasons unverified | Verified list, no reasons. **The same page still shows the June primary slate below the Nov slate.** |
| APEN Action, EBHO, IFPTE 21: "Yes per Oaklandside", unverified | All verified (details below). EBHO is measures only. |
| East Bay DSA: "Partial, page not fetched" | Verified in a browser at https://vote.eastbaydsa.org/ (the old `/electoral/` link is gone). Covers every Alameda measure plus 7 candidate endorsements. |
| LWV Oakland: "Yes per Oaklandside; page returned 403" | Page loads (200). **Pending**: it lists the candidates and links Pros & Cons, and says recommendations will be presented at an Oct 13 Zoom. No positions on EE, FF or RTM yet. |
| LWV Berkeley Albany Emeryville: "Yes (per page)" | Verified. **Positions on every Albany, Berkeley and Emeryville measure plus RTM**, each with several paragraphs of reasons. The URL slug really is `vote-with-the-league-nov-2024-2`. |
| Candidate-list app: "Nov 2026 election ID is one of 253–262; not resolved" | **Election ID 260.** The app is a plain form POST (details in section 2). The measures app works at `/rov_app/measures/election/260`. |
| Oakland Measures EE/FF, "Berkeley rent/arts/public bank/soda tax, Alameda city bonds" | Confirmed, and there are **27 local measures** (lettered I through II) plus RTM. **No county measures** and **no county offices** on the Nov ballot. |
| Black Action Alliance: "in-depth guide to OUSD candidates" | True, but it **endorses no one** (it says so). Not a guide for Bay Ballot. Same for Ballot Watchdog, which rates ballot-label wording, not merits. |
| ACCE: "unverified" | Verified at https://www.acceaction.org/2026voterguide : OUSD D2 Brouhard, D6 Bachelor, Berkeley D7 Micael, Yes on EE. |

---

## 1. Guide table

Abbreviations: OAK = Oakland, BRK = Berkeley, ALA = city of Alameda, ALB = Albany, EMY = Emeryville, SL = San Leandro, UC = Union City, OUSD = Oakland Unified, BUSD = Berkeley Unified, ACT = AC Transit. "Reasons" means the guide explains each pick. "List" means picks only. "Curl" is what curl with a normal user agent got.

Proposed ids follow the repo's existing naming. Types are the repo's: `newspaper`, `party`, `club`, `union`, `advocacy`, `civic`.

### Newspapers

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| East Bay Times editorial board | `east-bay-times` / newspaper (or widen `mercury-news`; same editorial board, see decisions) | Index: https://www.eastbaytimes.com/opinion/editorials/ . So far: [Ma for Lt. Gov.](https://www.eastbaytimes.com/2026/09/25/endorsement-elect-fiona-ma-californias-lieutenant-governor/) (9/25), [Allen for Insurance Commissioner](https://www.eastbaytimes.com/2026/09/26/endorsement-elect-ben-allen-californias-next-insurance-commissioner-2/) (9/26) | **Statewide only. Local picks pending.** | Yes (one editorial per race) | HTML, metered paywall | 200 |
| The Oaklandside / Berkeleyside (Cityside) | — | https://oaklandside.org/2026/10/05/oakland-endorsements-voter-guides-list/ | **Do not endorse** ("The Oaklandside doesn't make endorsements"). Berkeleyside runs signed opinion pieces only. The Oaklandside list is the best index of Oakland guides; updated 10/7. | — | — | 200 |
| Oakland Post | — | https://www.postnewsgroup.com/ | **Unverified.** No endorsement pages found on the site or in search. | — | — | 200 |
| Pleasanton Weekly, Alameda Post | — | — | **Unverified.** Search found race coverage, no endorsements. | — | — | not fetched |

### Parties

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| Alameda County Democratic Party | `acdp` / party | Press-release page https://acdems.org/press-release/ ; candidate and measure PDFs linked above | **Yes, 2026-09-14.** Mayors: ALA Vella, Dublin McCorriston, Hayward Salinas, OAK Lee, SL Gonzalez III (plus Livermore Marchand, not on ballot). Councils in ALA, ALB, BRK D4/D7/D8, Dublin D2/D4, EMY, Fremont D2–4, Hayward D1/D6, Newark, OAK D2/D4/D6, Piedmont, Pleasanton D3, SL D1, D2, D5 (no D3 pick), UC D2–4. BRK auditor and rent board (5). OAK auditor. 5 college trustee races. 17 school races including OUSD D4 (Camp; no D2/D6 pick). All ACT, ACWD, BART D4, EBMUD, EBRPD, Eden, Fairview, HARD, LARPD, Oro Loma and CV Sanitary races. **Yes on all 28 measures.** No BRK D1 pick and no OUSD D2 or D6 pick. | List | PDF (text layer) | **403 bot wall**; browser OK |
| Alameda County Republican Party | `acgop` / party | https://www.alamedagop.org/candidates | **Stale.** The candidates page still shows the June primary field (e.g. Bianco, Dena Maldonado for CD14). Only two Nov local picks: Union City D2 Jaime Patino and D3 Jeff Wang. Oaklandside: "hasn't yet updated". | — | HTML (Next.js) | 200 |
| California Working Families Party (exists: `ca-wfp`) | widen | http://caworkingfamilies.org/voter-guide-general-election-2026.pdf | **Yes.** Alameda: OAK mayor Lee, CD12 Simon, CD14 Wahab, BRK council Gangopadhyay, Micael, Wrubel, BRK auditor Wong, BRK rent board slate (5), Dublin USD Badar, Hayward D1 Syrop, HUSD Fernelius, UC Lopez Pulido. | Props: yes; candidates: list | PDF | 200 |
| Peace & Freedom Party of Alameda County | — | — | Pages found are 2020 or earlier. Not a current guide. | — | — | 200 |

### Democratic clubs

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| East Bay Young Democrats | `ebyd` / club | https://www.ebyd.org/endorsements | **Yes.** CD12, CD14, SD10, AD18, AD24, Insurance Commissioner; ALB council (ranked 1. Tiedemann, 2. Lopez); BRK D1/D4/D7/D8 and rent board (5); CVUSD A3; Dublin mayor, D2, D4, DUSD A3/A5; EMY council; OAK D2, OUSD D4 Camp, D6 (1. Powell, 2. A. Williams); Pleasanton D3; SL mayor, D3; UC D3, D4; NHUSD A5; ACT W3; BART D4; CLPCCD A3; EBMUD W7; EBRPD W5; Yes on BRK U, V, Z and OAK EE, FF. Also Livermore D1 (not on ballot) and San Pablo (Contra Costa). | List | HTML | 200 |
| Wellstone Democratic Renewal Club | `wellstone` / club | https://www.wellstoneclub.org/endorsements.html | **Yes.** Statewide slate, CD12, CD14, AD18; BRK auditor, D1 (Wrubel; 2nd Gangopadhyay), D7, D8 (Wallman), BUSD (3), rent board (5); OAK mayor, auditor, OUSD D2 Brouhard, D4 (Pfeiffer Williams; 2nd Camp), D6 Bachelor; ACT W3/W4; EBMUD W3; Peralta A5 Weese; all props; RTM; BRK U, W, X, Y, Z, AA support, V no rec; OAK FF support, EE no rec. Explicit "No Endorsement" in AD14, BRK D4, OAK D2/D4/D6. | List | HTML | 200 |
| Metropolitan-Greater Oakland Democratic Club | `mgo-dems` / club | https://mgodems.org/2026/09/26/metropolitan-greater-oakland-mgo-democratic-club-2026-general-election-endorsements/ | **Yes** (9/26, updated 10/3). OAK mayor Lee, D2 Wang, OUSD D2 Fleisher, BART D4, ACT W3/W4, EBMUD W3; Yes RTM, EE, FF; props. | List | HTML | 200 |
| Berkeley Democratic Club | `berkeley-dems` / club | https://www.berkeleydemocraticclub.com/ (homepage "at a glance"; says a fuller guide with reasons exists) | **Yes.** BRK D1 Bernet, D4 Tregub, D7 Micael, D8 Humbert, auditor Wong, BUSD (3), rent board Marasovic only; RTM yes; BRK U, V, W, X, Y, AA yes, **Z no**. | List on homepage; "full voter guide" link not found in the HTML | HTML | 200 |
| East Bay Stonewall Democratic Club | `east-bay-stonewall` / club | https://eastbaystonewalldemocrats.org/Endorsements | **Yes**, despite the heading "2026 Primary Election Endorsements": the content is the Nov slate. Covers ALA, ALB, BRK, CV, Dublin, EMY, Fremont, Hayward, Livermore, OAK, SL, UC and special districts. | List | HTML (Wild Apricot) | 200 |
| Asian Pacific American Democratic Caucus | `apadc` / club | North: https://apademcaucus.org/nov-2026-election-north-alameda-county-endorsed-candidates-for/ ; East and South: https://apademcaucus.org/nov-2026-election-east-and-south-alameda-county-endorsed-candidates/ | **Yes** (Aug 29–30 meeting). North: CD12, ALA council Marcie (Soslau) Johnson, AUSD Lym, BRK D4/D8, OAK auditor, D2, D6, ACT W3; explicit "No Endorsement" for ALA mayor, BRK D1/D7. East/South: SD10, Dublin D4, DUSD 5, Pleasanton D3 Gupta, CVUSD A2, SL mayor and D5, HUSD A4, HARD, Fremont D4, UC D2–4, NHUSD A4, CLPCCD A2/A3, Ohlone A6, Eden Z3, Fairview, EBMUD W7 (April Chan), EBRPD W3, ACWD W3, Oro Loma 1 and 3. | List (questionnaires linked) | HTML | **403 bot wall**; browser OK |
| Berkeley Citizens Action (the "progressive alliance" slate) | — | https://berkeleycitizensaction.org/ | **Unverified.** Latest endorsement post found is 2022. | — | — | 200 |
| Tri-Valley, Hayward, Fremont/Tri-City, John George, BWOPA clubs | — | — | **Unverified.** Not found by search. | — | — | — |

### Labor

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| Alameda Labor Council | `alameda-labor-council` / union | https://docs.google.com/document/d/17P9ht52TNggvTUvs5ZEtCeiWC6kNYrVF_uGE8MMCDvU (txt export works) | **Yes**, updated 9/17. Statewide, CD10/12/14/17, SD10, AD16/18/20/24 (AD14 no endorsement), props; most cities, school boards and special districts; Yes on ALA L, BRK U, V, Y, Z, Hayward CC, RTM. **Dual endorsements** in BRK D1, OUSD D4, Pleasanton D3, UC D3, NHUSD A5; **"Open Endorsement"** in OAK D2, SL mayor, UC D4. Picks ACT W3 **Joel Young** (most others: Valencia). | List | Google Doc | 200 |
| SEIU 1021 (exists: `seiu-1021`) | widen | https://www.seiu1021.org/post/election-endorsements-nov-3-2026 ("East Bay" section) | **Yes.** CD14, AD14/18/20, SD10; ALA mayor Vella; ALB council; BRK D1 Wrubel, D4, D7, rent board (5); EMY Frydlewicz; Hayward D1 Syrop; OAK mayor Lee, D2 **Nate Adams**, D4, D6; UC D2 dual (Patiño / Lopez Pulido), D3; CLPCCD A2/A3/A6; Peralta A5; HUSD A2/A4; OUSD D2 Brouhard, D6 Bachelor; EBMUD W3; Yes on BRK U–AA, Hayward CC, OAK FF, UC II, EMY BB, RTM. **No position on OAK EE.** | List | HTML | 200 |
| IFPTE Local 21 | `ifpte-21` / union | https://ifpte21.org/endorsements/ | **Yes.** Statewide, AD16/18/20/24, props, RTM, Hayward CC, OAK D4 Ramachandran, OAK mayor Lee, EBMUD W3 Young, W7 Wolff (plus W2 and W4, not on the Alameda ballot). | List | HTML | 200 |
| Building & Construction Trades Council of Alameda County | — | — | **Unverified.** No 2026 slate found online. | — | — | — |
| Oakland Education Association, Berkeley Federation of Teachers | — | — | **Not checked.** | — | — | — |

### Advocacy

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| East Bay for Everyone (YIMBY Action chapter) | `eb4e` / advocacy | https://eastbayforeveryone.org/2026/09/21/eb4e-2026-general-election-endorsements/ | **Yes** (9/21). RTM yes; BRK D1 Bernet, D4 Tregub, D7 Micael, D8 Humbert; EMY Mourra, Frydlewicz; OAK D2 Wang, D6 Jenkins; ALA mayor Vella, council Amarasiriwardena; SL mayor Maes; BART D4 Raburn; ACT W3 Valencia, W4 Syed. No OAK mayor, no city measures. | **Yes**, a paragraph per pick | HTML | 200 |
| Empower Oakland | `empower-oakland` / advocacy | https://www.empoweroakland.com/voter-guide | **Yes.** OUSD D2 (#1 Fleisher), D4 (#1 Hutchinson, #2 Camp), D6 (#1 A. Williams, #2 Powell); OAK mayor Lee, D2 Wang, D4 Ramachandran, D6 Jenkins, auditor Houston; BART D4 Raburn; ACT W3 Valencia, W4 Syed; EBMUD W3 Young; Peralta A5 Reiss; Yes EE, FF, RTM. **Gives RCV ranks.** | **Yes**, detailed, with "You might hear" counterpoints | HTML | 200 |
| Oakland Rising Action | `oakland-rising-action` / advocacy | https://oaklandrisingaction.org/homepage/2026-oakland-progressive-voter-guide/ | **Yes.** OAK mayor Lee, OUSD D2 Brouhard, D6 Bachelor; all props; Yes EE, FF, RTM. | **Yes** | HTML (plus English/Spanish/Chinese PDFs) | 200 |
| Bay Rising Action (exists: `bay-rising-action`) | widen | https://bayrisingaction.org/voterguide/ | **Yes.** Alameda: RTM, OAK EE, FF, BRK X, Z (all Yes). | **Yes** | HTML | 200 |
| East Bay DSA | `east-bay-dsa` / advocacy | https://vote.eastbaydsa.org/ | **Yes.** Endorsed (🌹): BRK D7 Micael, BRK rent board slate (5), Hayward D1 Syrop, OAK D2 **Nate Adams**, OUSD D2 Brouhard, D6 Bachelor. **Recommended** (👍) on nearly every Alameda measure: RTM, ALA L, M, ALB P–T, BRK U–AA, Dublin I, EMY BB, Hayward CC, Newark DD, OAK FF, Piedmont GG, Pleasanton HH, San Lorenzo J, Sunol K. **No position** on ALA N, ALB O, OAK EE, UC II. | **Yes** (analysis per measure) | SPA; JSON/txt behind it | 200 shell; needs browser |
| APEN Action | `apen-action` / advocacy | https://www.apenaction.org/endorsements/ | **Yes.** OAK mayor Lee; Yes EE, FF, RTM; props (also Richmond items). | List | HTML (English/Chinese) | 200 |
| ACCE Action | `acce-action` / advocacy | https://www.acceaction.org/2026voterguide | **Yes.** OUSD D2 Brouhard, D6 Bachelor; BRK D7 Micael; Yes OAK EE; props. Statewide guide with a "Bay Area" section. | Props: short reasons; candidates: list | HTML | 200 |
| East Bay Housing Organizations | `ebho` / advocacy | https://ebho.org/2026-campaign-endorsements/ | **Yes**, measures only (updated 8/13): RTM, Prop 1, No on 43, BRK X. | **Yes** | HTML | 200 |
| Bike East Bay (c3; no candidates) | `bike-east-bay` / advocacy | https://bikeeastbay.org/Election2026/ | **Yes**, measures only: RTM, BRK U, V yes; No on 43, 45. Links candidate questionnaires (Seamless Bay Area; Bike Walk Alameda; Albany Strollers & Rollers). | **Yes** | HTML | 200 |
| Sierra Club SF Bay Chapter (exists: `sierra-club-sf-bay`) | widen | https://www.sierraclub.org/sfbay/2026-endorsements | **Yes.** Alameda: ACT W3/W4, EBMUD W3/W7, EBRPD W5; ALA L, BRK AA and U yes; ALB council (2); BRK D1 (RCV #1 Bernet, #2 Wrubel), D4, D7, D8; Dublin mayor **Mohammad**, D4; EMY Mourra; Hayward D1, D6; Livermore D2 Barrientos; OAK mayor, D2, D4, D6; Pleasanton mayor **Testa**, D3 **Gupta**; SL mayor Gonzalez, D3 Trujillo; AD16/18/24. Also "Alameda Board of Supervisors: Lena Tam", which is not on the Nov ballot. | List (explanations page for some) | HTML | **bot wall**; browser OK (already `fetchWith: browser`) |
| YIMBY Action (exists: `yimby-action`) | widen | https://yimbyaction.org/endorsements/november-2026-california-general | **Yes.** ALA mayor Vella, council Amarasiriwardena, Savage; ALB Tiedemann, Lopez; BRK D1 **Wrubel and Bernet**, D4, D8; EMY Frydlewicz, Mourra; OAK D2 Wang; ACT W3 Valencia; BART D4 Raburn; RTM. | List | HTML | 200 |
| Greenbelt Alliance (exists: `greenbelt-alliance`) | widen | https://www.greenbelt.org/voter-guide-26/ | **Yes.** ALA L yes, ALB O yes (plus RTM). | **Yes** (post per measure) | HTML | 200 (repo uses browser) |
| Courage California (exists: `courage-california`) | widen | https://www.progressivevotersguide.com/california/2026/general/county/alameda | **Yes**, but **only federal, legislative and statewide**: CD10/12/14/17, SD10, AD14/16/18/20/24, props. No local races. Needs this county URL as an extra source. | **Yes** | HTML | 200 |
| SPUR (exists: `spur`) | widen | https://www.spur.org/voter-guide/2026-11 | **Yes.** OAK EE and FF plus RTM (the Oakland pages are already in `spur`'s `extraSources`, so the picks were extracted but had no contest to land on). | **Yes** | HTML | 200 |
| Black Action Alliance, Ballot Watchdog | — | https://blackactionalliance.org/ousd2026 , https://ballotwatchdog.com | **No endorsements** by design. Exclude. | — | — | — |
| Chambers (OakPAC, Fremont, Hayward), BNC | — | — | **Unverified.** No 2026 slates found. The Berkeley Neighborhoods Council site lists only a ballot-measure forum on 10/10. | — | — | — |

### Civic (League of Women Voters; Leagues don't endorse candidates)

| Guide | Proposed id / type | Nov 2026 URL | Published? | Reasons? | Format | Curl |
|---|---|---|---|---|---|---|
| LWV Berkeley Albany Emeryville | `lwv-bae` / civic | https://www.lwvbae.org/league-news/vote-with-the-league-nov-2024-2/ (posted 2026-09-10 despite the slug) | **Yes.** Support ALB O, P, Q, R, S, T; BRK U, V, W, X, AA; EMY BB; RTM. Neutral BRK Z. No position BRK Y. State props at the bottom. | **Yes**, long | HTML | 200 |
| LWV Alameda | `lwv-alameda` / civic | https://www.lwvalameda.org/advocacy | **Yes.** Yes ALA L; **neutral M and N**; Yes RTM; props (yes 1–5, neutral 40, no on the rest). | Short | HTML (Wix) | 200 |
| LWV Oakland | `lwv-oakland` / civic | https://www.lwvoakland.org/get_informed | **Pending.** Pros & Cons and candidate list only; recommendations to be presented Oct 13. | — | HTML | 200 |
| LWV Fremont-Newark-Union City | — | https://lwvfnucmembership.clubexpress.com/ | **No positions found.** Candidate and measure forums only (Oct 1–21, ballot-measure forum Oct 17). | — | — | 200 |
| LWV Piedmont, LWV Eden Area, LWV Amador Valley | — | https://www.lwvpiedmont.org/ , https://lwvea.clubexpress.com/ , https://my.lwv.org/california/amador-valley | **No positions found** (Piedmont: candidate forum only). | — | — | 200 |
| LWV Bay Area | — | https://www.lwvbayarea.org/ | No RTM position page found on the homepage. LWV BAE and LWV Alameda both support RTM. | — | — | 200 |
| LWV California (exists: `lwv-ca`) | widen | https://lwvc.org/ballot-recommendations-nov-3-2026/ | Yes (props). Already `manual: true`. | Yes | HTML | 200 |

### Counts

Counting guides with any Nov 2026 pick on an Alameda local contest (city, school, special district or local measure; RTM counts). Statewide-only guides (LWVC, Courage, the East Bay Times so far) are excluded.

| | Guides |
|---|---|
| **Published, with Alameda local picks** | **26**: ACDP, ALC, EB4E, Empower Oakland, Oakland Rising Action, EBYD, Wellstone, MGO, Berkeley Dems, East Bay Stonewall, APADC, East Bay DSA, SEIU 1021, IFPTE 21, APEN, ACCE, EBHO, Bike East Bay, LWV BAE, LWV Alameda, Sierra Club SF Bay, YIMBY Action, Bay Rising, Greenbelt, SPUR, CA WFP |
| **With reasons** | **11**: EB4E, Empower Oakland, Oakland Rising Action, East Bay DSA, EBHO, Bike East Bay, LWV BAE, Bay Rising, Greenbelt, SPUR, LWV Alameda (short) |
| **Pending** | **3**: East Bay Times (local picks), LWV Oakland (Oct 13), Alameda County GOP (page not updated) |
| **New guides** (not in `data/guides`) | 20 of the 26, plus the 3 pending |
| **Existing guides to widen** | sierra-club-sf-bay, spur, seiu-1021, yimby-action, bay-rising-action, greenbelt-alliance, ca-wfp, courage-california (needs the Alameda county URL), lwv-ca |

Coverage by place (published guides with at least one local pick there):

| Place | Guides | Notes |
|---|---|---|
| **Oakland** | **20**: ACDP, ALC, EB4E, Empower, ORA, EBYD, Wellstone, MGO, Stonewall, APADC, EBDSA, SEIU, IFPTE, APEN, ACCE, Sierra, YIMBY, Bay Rising, SPUR, CA WFP (LWV Oakland pending) | 4 with reasons on Oakland items (Empower, ORA, EB4E, SPUR) |
| **Berkeley** | **18**: ACDP, ALC, EB4E, EBYD, Wellstone, Berkeley Dems, Stonewall, APADC, EBDSA, SEIU, ACCE, EBHO, Bike East Bay, LWV BAE, Sierra, YIMBY, Bay Rising, CA WFP | 6 with reasons (EB4E, EBDSA, EBHO, Bike EB, LWV BAE, Bay Rising) |
| **City of Alameda** | 11: ACDP, ALC, EB4E, Stonewall, APADC, EBDSA, SEIU, Sierra, YIMBY, Greenbelt, LWV Alameda | |
| Albany, Emeryville | 9–11 each (mostly the same Dem/labor/YIMBY set plus LWV BAE) | |
| Hayward, San Leandro, Union City, Dublin, Fremont, Pleasanton, Livermore, Newark, Piedmont | 3–8 each, almost all Democratic clubs and labor (ACDP, ALC, EBYD, Stonewall, APADC, SEIU), plus Sierra for Dublin/Pleasanton/Hayward/SL/Livermore and EB4E for SL mayor | No local guide with reasons found south or east of San Leandro |

---

## 2. Ballot contests beyond statewide

Statewide contests on every Alameda ballot (already in `ballot.yml`): Governor through Superintendent, Supreme Court retention (Groban, Evans), Props 1–5 and 37–45.

### Sources and machine-readability

**Alameda County Registrar of Voters** (no bot wall; everything below works with curl)
- Elections page: https://acvote.alamedacountyca.gov/election-information/elections (JS-driven; not needed).
- **Candidate list**: https://alamedacountyca.gov/rov_app/candidatelist
  - `GET /rov_app/candidatelist/260` returns JSON: the election's 134 races (`raceId`, `raceTitle`, `categoryId`) and 5 categories (Federal, State, School Districts, Special Districts, City).
  - `POST /rov_app/candidatelist/` with form fields `electionId=260&categoryId=&raceId=&lastName=&raceStatus=onballot&candidateStatus=COMPLETED` returns the whole list as HTML (about 2 MB). `raceStatus=NOTONBALLOT` gives the uncontested seats.
  - Each race block has the title, "On Ballot"/"Not On Ballot", "Vote For: N", and per candidate: name (upper case), party, ballot designation, contact info, incumbent flag. The HTML repeats every race twice (desktop and mobile); parse only the blocks between `FIRST LOOP BEGIN` and `FIRST LOOP END`.
  - **The incumbent flag is unreliable** (Ramachandran, Oakland D4, is not flagged).
  - **103 races on the ballot, 29 not on the ballot**, 2 others (election total 134).
- **Measures**: https://alamedacountyca.gov/rov_app/measures ; data at `GET /rov_app/measures/election/260` (HTML fragment: letter, jurisdiction, title, passing threshold, full ballot question).
- **Ranked-choice voting**: https://acvote.alamedacountyca.gov/rcv : "Voters in Albany, Berkeley, Oakland, and San Leandro will use ranked-choice voting to elect most local officials." Up to 5 ranks.
- Berkeley City Clerk notice of nominees (proper-case names and ballot order): https://berkeleyca.gov/sites/default/files/Notice%20of%20Candidates%20Nov%203%202026%20-%20WEB%20Version.pdf
- Redacted extracts committed with this doc: `data/2026-11/sources/ALA-Candidates-Nov2026.txt` (contest, seats, ballot status, candidate names only) and `data/2026-11/sources/ALA-Measures-Nov2026.txt` (ballot questions and thresholds).

**There are no county offices and no county measures on the Nov ballot.** County races were decided in June (the Sierra Club still lists "Board of Supervisors: Lena Tam").

### State and federal districts touching Alameda

| Contest | Candidates (registrar order) | Notes |
|---|---|---|
| CD10 | Mark DeSaulnier, Jeff Frese | Alameda + Contra Costa (Courage CA) |
| CD12 | Jamie Joyce, Lateefah Simon | Other counties unverified |
| CD14 | Melissa Hernandez, Aisha Wahab | Seat had an Aug 18, 2026 special general (election 262). Other counties unverified |
| CD17 | Ro Khanna, Ritesh Tandon | Alameda + Santa Clara |
| SD10 | Linda R. Price, Scott Sakakihara | Only state senate seat on the Alameda ballot |
| AD14 | Mark Rendon, Buffy Wicks | |
| AD16 | Rebecca Bauer-Kahan, Joseph A. Rubay | |
| AD18 | Mia Bonta, Andre Sandford | |
| AD20 | Patricia Muga, Liz Ortega | |
| AD24 | Max Hsia, Alex Lee | |
| BOE D2 | Sally J. Lieber, John Pimentel | **Exists** as `board-of-equalization-2`; add Alameda to `within` |
| Court of Appeal, 1st District | (11 justices) | **Exists** as `court-of-appeal-1`; add Alameda to `within` |
| RTM | | **Exists** as `rtm`; add Alameda to `within` |

10 new district contests. Which other counties each district spans (for `within`) is unverified except CD10 and CD17; check the SoS certified list before writing `ballot.yml`. Contra Costa's discovery should share CD10, AD14, AD16 and SD10 entries if they overlap.

### Local candidate contests on the ballot (84)

RCV = ranked-choice. "(1)" = one candidate, on the ballot anyway.

**Community colleges (5)**
- Ohlone CCD Area 6: Suzanne "Sue" Lee Chan, Sonia Salwan
- Chabot-Las Positas CCD Area 2: Linda Granger, Cindy Rocha; Area 3: Mark Fay, Wendy Huang, Harris Mojadedi; Area 6: Hal G. Gin, Joe Orlando Ramos
- Peralta CCD Area 5: Cindi Reiss, Sandra Weese

**School districts (21)**
- Alameda USD (vote 2): Joyce Boyd, Carrie Hahnel, Gary Lym, Mike McMahon, Sarah Putnam
- Albany USD board (vote 4, **RCV, multi-winner**): Margaret Allen, Melissa Boyd, Becky Hopwood, Josh Mahoney, David McKinney
- Berkeley USD (vote 3): Ka'Dijah A. Brown, Sandy Park, Jennifer Shanoski (3 for 3 seats)
- Castro Valley USD Area 2 short term: Jesus Jacobo, Myla Long, Frederick Regala; Area 3: Dan Jacowitz, Eryka N. Mathews-Cain, Glenn A. Miller, Kara Wong; Area 4: Faith Carroll, Brian A. Foster, Joseph Grcar
- Dublin USD Area 3 short term: Shalini Bhandari, Tanner Frye; Area 5: Seema Badar, Dan Cherrier
- Emery USD (vote 3): Christopher Keith Allen, Regina Chagolla, Brian Donahue, David Ridlehuber, Kimberly Solis
- Hayward USD Area 2: Joann Guzman, Joe Orlando Ramos; Area 4: Michelle Fernelius, Maria Araceli Orozco
- Livermore Valley JUSD Area 2: Tara Boyce, Stephen R. Orgain; Area 3: Angela M. Brady, Deborah Gibson; Area 5: Deena Kaplanis, Sam Phelps, Christiaan VandenHeuvel
- New Haven USD Area 4: Shruti Kumar, Charandeep Singh Tatlah, Kashif Wasim; Area 5: Deepti Garg, Francis Rojas
- Oakland USD (**RCV**) D2: Jennifer Brouhard, Arielle Fleisher; D4: Kathryn Camp, Mike Hutchinson, Sylvia Pfeiffer Williams; D6: Valarie Bachelor, LeAna Powell, Alexandra Williams
- Pleasanton USD Area 5: Thomas Choi, Karen Fletcher, Brett Gerald Martinez
- Sunol Glen USD (vote 2): Gagan Bassi, Jennifer Kavouniaris, Karen Ruth Newcomb, René Turnbull

**Cities (39)**
- **Oakland (RCV)**: Mayor: Brenda F. Grisham, Barbara Lee, Mindy Ruth Pechenuk, Julius Robinson. D2: Nate Adams, Charlene Wang. D4: Janani Ramachandran (1). D6: Kevin E. Jenkins, Nancy S. Sidebotham. Auditor: Michael C. Houston (1).
- **Berkeley (RCV for council and auditor)**: D1: Laura Babitt, Ross Bernet, Moni Gangopadhyay, Steve Kromer, Daria Wrubel. D4: Majdi "Gaith" Abuhamdieh, Igor A. Tregub. D7: Aidan Hill, Syrak Micael. D8: Fred M. Feller, Mark Humbert, Mari Mendonca, Michael Wallman. Auditor: Jenny Wong (1). Rent Stabilization Board (vote 5): Avery Arbaugh, Carole Marasovic, Ida Martinac, Nathan Mizell, Vylma Ortiz, Derek Rodriguez.
- **Alameda**: Mayor: Tony Daysog, Tracy Jensen, Malia Vella. Council (vote 2): Thushan Amarasiriwardena, Maria L. Bondonno, Marcie Johnson, Tyler Savage, Steve Slauson, Amos White.
- **Albany (RCV, multi-winner)**: Council (vote 2): Jon Destin, Katherine Enos, Robin D. López, Chris McDaniels, Aaron Tiedemann.
- **Emeryville**: Council (vote 2): Corry Frydlewicz, David Mourra, Kalimah Atreyu Priforce, Brandon Soublet.
- **Piedmont**: Council (vote 3): Nancy Beninati, Sunny Bostrom-Fleming, Adam Hundt, Tom Ramsey, Bill Reichle.
- **San Leandro (RCV)**: Mayor: Juan González III, James Maes. D1: Sbeydeh Viveros-Walton (1). D2 short term: James Aguilar (1). D3: Lee Thomas, Joseph Trujillo. D5: Xouhoa Bowen (1).
- **Hayward**: Mayor: Mark Salinas, Tom Wong. D1: Brian M. Schott, George Syrop. D6: Julie Roche (1).
- **Union City**: D2: Victor Lopez Pulido, Jaime Patino. D3: Cheris Crocker-Root, Jeff Wang. D4: Vipan S. Bajwa, Sarabjit Kaur Cheema, Qasim Lodhi, Ann Yap-Jequinto.
- **Fremont**: D2: Desrie Campbell, Keith Parker. D3: Kathy Kimberlin, Vipin Sharma. D4: Aziz Akbari, Ying Min Li, Anurag Mishra, Manisha Pathak.
- **Newark**: Mayor: Michael K. Hannon (1). Council (vote 2): Tonya Connolly, Noah Patrick Grushkin, Matthew Jorgens, Eve Marie Little.
- **Dublin**: Mayor: Sherry Hu, Michael McCorriston, Kiran Mohammad. D2: Daniel Hor, Steve Lorey, Tejpreet Singh, Richard Thornbury. D4: Kashef Qaadri, Shivraj Singh.
- **Pleasanton**: Mayor: Jack Balch, Julie Testa. D1: Vin Kruttiventi, Kathy Narum. D3: Reena Gupta, Jamie Yee.
- **Livermore**: D2: Ben Barrientos, Narayan Tadimeti. (Mayor and D1 are not on the ballot.)

Names above are the registrar's, put in normal case by hand. Accents and quotes follow the registrar; check spellings against each city's notice before writing `ballot.yml`.

**Special districts (19)**
- AC Transit W3: Adriana Valencia, Joel B. Young; W4: Gabriel Morales, Sarah Syed; W5: Joseph Grcar, Murphy McCalley, Luis Reynoso
- BART D4: Robert Raburn, Luis Reynoso
- EBMUD W3: Don Gray, Marguerite Young; W7: April Chan, Joseph Grcar, Luis Reynoso, Gary Wolff
- East Bay Regional Park District W3: Joseph Grcar, Rebecca Lewington, William Yragui; W5: Bruce Henry, Olivia Sanwong
- Alameda County Water District W2: Judy C. Huang, Jason Miguel; W3: Paul Sethy, Yang Shao
- Castro Valley Sanitary (vote 2): Kristy (Dooman) Woerz, Joseph Grcar, Ralph Johnson, Ken Owen, Darshan Saini
- Eden Township Healthcare Area 3: Narges Dillon, Joseph Grcar
- Fairview Fire Protection (vote 2): Michelle Biche, Vandana Singh Gautam, Michael D. Justice
- Hayward Area Recreation & Park District Area 2: Amanda Alysia Daniels, Sara Lamnin; Area 4: Joseph "Joe" Giltner, Paul W. Hodges, Jr.
- Livermore Area Recreation & Park District (vote 3): Timothy Barry, Larry Bird, Matt Bogdanowicz, Maryalice Summers Faltings, Philip Pierpont, Mike Ralph, Laureen Turner
- Oro Loma Sanitary D1: Tiare Peña, Shelia Young; D3: Benny Lee, Fred Simon; D5: Rita Duncan, Koroush "Cyrus" Farsaei

**Not on the ballot** (uncontested, appointed in lieu of election), listed because guides endorse some of them: Livermore Mayor (John Marchand), Livermore D1 (Evan Branning), AC Transit W1 short term and W7, BART D6 (Liz Ames), EBMUD W4 (Andy Katz), Peralta A3 and A7, Ohlone A3, A4, A7, AUSD short term (Ryan LaLonde), Dublin USD A2, Fremont USD A2 and A3, Newark USD, Pleasanton USD A2, San Leandro USD A2/A4/A6, San Lorenzo USD A1/A4, Eden Healthcare A1/A5, Washington Township Healthcare, City of Alameda Healthcare, Dublin San Ramon Services A4, Byron-Bethany Irrigation, San Joaquin Delta CCD A4. Full list in the source extract.

**Counts:** 103 races on the ballot: 19 state/federal (8 statewide offices including Superintendent, BOE 2, 4 House, 1 State Senate, 5 Assembly) and **84 local** (5 college, 21 school, 39 city, 19 special district). 8 local races have a single candidate, and Berkeley USD has 3 candidates for 3 seats, so **about 75 local races are contested**.

### Local measures (27, plus RTM)

From the registrar (threshold in brackets; "N/A" is what the registrar shows for some).

| Letter | Jurisdiction | Title | Threshold |
|---|---|---|---|
| RTM | Regional | Regional Transit Measure (0.5% in Alameda) | N/A |
| I | Dublin USD | Parcel tax (renews $96, adds $48) | 2/3 |
| J | San Lorenzo USD | Education parcel tax renewal | N/A |
| K | Sunol Glen USD | $6.1M GO bond | N/A |
| L | City of Alameda | GO bond (SAFER Alameda) | 2/3 |
| M | City of Alameda | Charter amendment: outdated provisions | majority |
| N | City of Alameda | Charter amendment: leases and sales of real property | majority |
| O | Albany | Zoning changes (R-1 voter requirement from Measure D) | majority |
| P | Albany | Street paving and storm drain parcel tax | 2/3 |
| Q | Albany | EMS, ALS, fire parcel tax | majority |
| R | Albany | Business license tax | majority |
| S | Albany | Real property transfer tax | majority |
| T | Albany | Street trees and streetlighting parcel tax | 2/3 |
| U | Berkeley | Infrastructure bond | 2/3 |
| V | Berkeley | Sales tax | majority |
| W | Berkeley | Charter amendment (elections, filing fees, public financing) | majority |
| X | Berkeley | Rent ordinance amendments | majority |
| Y | Berkeley | Initiative: arts parcel tax | majority |
| Z | Berkeley | Initiative: public bank parcel tax | majority |
| AA | Berkeley | Initiative: soda tax | majority |
| BB | Emeryville | Business tax | N/A |
| CC | Hayward | Business license tax modernization | majority |
| DD | Newark | Essential services protection (business tax) | majority |
| EE | Oakland | Charter amendment: strong mayor | majority |
| FF | Oakland | Transfer tax: remove foreclosure exception | majority |
| GG | Piedmont | Real property conveyance tax | majority |
| HH | Pleasanton | Hotel tax 8% to 10% | majority |
| II | Union City | Essential services extension (utility users tax) | majority |

Totals for Alameda beyond statewide: **10 new district contests, 84 local candidate contests, 27 local measures**, plus widening BOE 2, Court of Appeal 1 and RTM.

### Ranked-choice contests

Per the registrar, RCV applies in **Albany, Berkeley, Oakland and San Leandro** for "most local officials", never to county, state, federal or measures.
- Oakland: mayor, D2, D4, D6, auditor, OUSD D2, D4, D6 (8).
- Berkeley: council D1, D4, D7, D8, auditor (5). Unverified whether the Rent Board (vote 5) and BUSD (vote 3, uncontested) are RCV; they were plurality in past Berkeley elections.
- San Leandro: mayor, D1, D2, D3, D5 (5).
- Albany: council (vote 2) and school board (vote 4) use **multi-winner** RCV. Unverified on a 2026 sample ballot. `ballot.yml` has `rankedChoice` and `seats` but no SF contest combines them, so check the UI handles a multi-seat ranked contest.

---

## 3. Proposed area structure (not implemented)

- **`alameda-county`** (kind `county`): jurisdictions California, county Alameda, and the 14 cities (Alameda, Albany, Berkeley, Dublin, Emeryville, Fremont, Hayward, Livermore, Newark, Oakland, Piedmont, Pleasanton, San Leandro, Union City). School and special districts are `level: district` with `within: [{ level: county, name: Alameda }]`, so unincorporated Castro Valley, San Lorenzo, Sunol and Fairview contests show here.
  - I recommend the id `alameda-county`, not `alameda`, because the city of Alameda is also a jurisdiction and may want its own page later. (`san-mateo` set the other precedent; Sean's call.)
- **`oakland`** (kind `city`): 20 guides, 4 with reasons. Clear yes.
- **`berkeley`** (kind `city`): 18 guides, 6 with reasons, 7 city measures. Clear yes.
- **City of Alameda**: 11 guides including LWV Alameda, Greenbelt and Sierra on Measure L. Optional third city page (`alameda` as the id if the county takes `alameda-county`).
- Everything else (Hayward, Fremont, San Leandro, Union City, Tri-Valley, Albany, Emeryville, Piedmont, Newark) lives on the county page. Their guide sets are almost entirely the Democratic clubs and labor.

---

## 4. Gotchas

1. **Bot walls**: acdems.org and apademcaucus.org (403 "Please wait") and sierraclub.org need a browser. ACDP's picks live in PDFs under `wp-content/uploads/2026/09/`, so the guide's `source` should be the PDFs, fetched in a browser. Expect them to need `fetchFrom: local` like the NationBuilder sites; not tested from a GitHub runner.
2. **East Bay DSA** is a single-page app with three tiers: endorsed (🌹), recommended (👍) and no position. Decide whether "recommended" counts as a pick. Its data is fetchable as `/terminal-races.json` and `/race-content/...txt`.
3. **Dual and open endorsements** (ALC: BRK D1, OUSD D4, Pleasanton D3, UC D3, NHUSD A5 dual; OAK D2, SL mayor, UC D4 "Open Endorsement"; SEIU UC D2 dual; YIMBY Action BRK D1 two names). Wellstone and Sierra give a "2nd place" or RCV #2. Empower Oakland, EBYD and Sierra give explicit ranks.
4. **Picks for contests not on the ballot**: Livermore mayor Marchand (ACDP), Livermore D1 Branning (ACDP, ALC, EBYD, Stonewall), EBMUD W4 Katz (Wellstone, IFPTE, ALC), Peralta A3 Quindlen (Wellstone), AUSD short term LaLonde (ALC), Supervisor Lena Tam (Sierra). Extraction will find no contest for these; that is correct.
5. **Guide page errors**: APADC lists "Livermore City Council, D2 – Evan Branning" (he filed for D1, which is not on the ballot; D2 is Barrientos vs Tadimeti). East Bay Stonewall lists Mark Humbert under "Berkeley City Council District 7" (he is D8) and heads the Nov slate "2026 Primary Election Endorsements". CA WFP lists Berkeley council picks without districts.
6. **Mixed pages**: Wellstone (June primary slate below Nov), EBYD (every endorsement back to 2022 on one page), ACGOP (June field), ACCE and APEN (statewide pages with Richmond, LA etc.). The ingest must filter by contest.
7. **Same name, many contests**: Joseph Grcar is on 6 ballots (ACT W5, EBMUD W7, EBRPD W3, CVUSD A4, CV Sanitary, Eden A3), Luis Reynoso on 3 (ACT W5, BART D4, EBMUD W7), Joe Orlando Ramos on 2 (CLPCCD A6, HUSD A2). Contest disambiguation must not be by name alone.
8. **Name variants needing aliases**: Marcie Johnson / Marcie Soslau Johnson; Juan González III / Juan Gonzalez; Sbeydeh Viveros-Walton / Viveros Walton; Xouhoa Bowen / "Xoahoa" (ALC typo); Sarah Syed / Sarah Yasmin Syed; Tanner Frye / James Tanner Frye / James Frye; Suzanne "Sue" Lee Chan / Suzanne Chan / Sue Chan; Melissa Boyd / Melissa Harrison Boyd; René Turnbull / Gail Rene Turnbull; Jason Miguel / Jason Mathew Miguel; Paul W. Hodges, Jr. / Paul Wayne Hodges; Fred Simon / Frederick Simon, Jr.; Michelle Fernelius / "Fernellius" (WFP); Victor Lopez Pulido / Victor Daniel Lopez Pulido; LeAna / Leana Powell; Sylvia Pfeiffer Williams / Sylvia Williams; Joseph Trujillo / Joseph Lawrence Trujillo; Kristy (Dooman) Woerz; Robin D. López / Robin Lopez.
9. **Registrar names are upper case**; take normal case from the Berkeley notice, the Oakland clerk list (403 to curl) or the guides.
10. **Measure letters collide** with SF props and San Mateo measures (J, L, U, V and others). Use the San Mateo pattern for ids: `oakland-measure-ee`, `berkeley-measure-u`, `alameda-measure-l`, `dublin-usd-measure-i`.
11. **Two "Alameda"s**: county and city share the name. Jurisdiction `level` keeps them apart in data; titles should say "City of Alameda" for L, M, N and the mayor and council.
12. **SEIU and EBDSA pick Nate Adams for Oakland D2**; almost everyone else picks Charlene Wang. **ALC picks Joel Young for ACT W3**; everyone else picks Valencia. Worth eyeballing after extraction.
13. **SPUR already fetches the Oakland EE/FF pages** (`extraSources`). Once EE and FF exist in `ballot.yml`, a re-extract of SPUR will pick them up; per the runbook, review the quote diff for SF contests.
14. **Courage California's `source` is the San Mateo county page.** Alameda needs `.../county/alameda` as an extra source.
15. The Sierra Club page lists AD12 and EBRPD W6/W7 and EBMUD W2: those are Contra Costa or Marin contests, not Alameda.

## 5. Unverified and not done

1. **East Bay Times local picks**: not yet. Its 10/5 "Bay Area voter guide" is news. Re-check weekly; expect a "cheat sheet" late October.
2. **LWV Oakland**: recommendations expected at or after its Oct 13 meeting.
3. **Alameda County GOP**: no Nov page yet.
4. **Not found**: Building Trades Council of Alameda County, OakPAC / Oakland Chamber, Fremont and Hayward chambers, Oakland Post, Tri-Valley and Hayward Democratic clubs, John George Democratic Club, BWOPA, Berkeley Citizens Action (2022 is the latest post), Pleasanton Weekly, Alameda Post. **Not checked**: OEA, Berkeley Federation of Teachers, Alameda Renters Coalition, Oakland firefighters.
5. **Leagues south and east**: LWV FNUC, Eden Area, Amador Valley and Piedmont show forums but no positions on DD, II, CC, HH or GG. LWV FNUC's ballot-measure forum is Oct 17; re-check after.
6. **Berkeley Democratic Club's "full voter guide"** with reasons is referenced on its homepage, but its link was not in the fetched HTML.
7. **District geography** for CD12, CD14, SD10 and the Assembly districts (which other counties, which Alameda cities) was not pulled. Get it from the SoS certified list or an Alameda sample ballot.
8. **RCV scope** for Berkeley Rent Board and BUSD, and Albany's multi-winner RCV, need a 2026 sample ballot.
9. **ZIP codes** for Alameda were not mapped in this pass.

## Decisions (2026-10-07)

- **Inclusion**: any guide whose endorsements are clearly for Nov 3, 2026 is in, however few contests it covers. Undated pages are skipped.
- **Areas**: a county page `alameda-county` (avoids the clash with the city of Alameda), plus city pages `oakland` and `berkeley`. No city-of-Alameda page; the county page's place filter covers it.
- **East Bay Times**: widen the existing `mercury-news` guide (shared editorial board), with a display name that names both papers. Contra Costa needs the same change, so it goes through the team lead rather than both branches editing that file.
- **East Bay DSA**: both "endorsed" (🌹) and "recommended" (👍) count as its pick. "No position" is not a pick.
- **Dual and open endorsements** use what the schema and extractor already do; no new mechanism:
  - Dual: `pick` is a list of candidate names (`Entry.pick` in `src/lib/schema.ts`). Unranked duals get both names with `ranked: false`, per the extractor's rule "Dual endorsements without ranking: list both names with ranked false" (`src/pipeline/extract.ts`). Ranked ones ("rank both", "#1 / #2") get `ranked: true`, and `rankedCount` covers a partly ranked list (the `uesf` file has an example). So ALC's "Dual Endorsement | Choose 1" in Pleasanton D3, UC D3 and NHUSD A5 becomes a two-name unranked pick, and its "Rank Both" in BRK D1 and OUSD D4, which gives no order, is also a two-name pick with `ranked: false` (superseding an earlier note here that called it ranked).
  - "Open Endorsement", "No Endorsement", "No position", "no recommendation" and "neutral": no pick at all. The extractor skips these contests by rule, and the verifier treats a recorded pick there as `wrong-pick`.
- **ACDP and APA Dem Caucus fetching**: test them with a plain fetch during ingest. Mark them `fetchFrom: local` only if they still fail after the pipeline's browser retry.
- **Sequencing**: no contests, areas or guides are added until the refactor that splits `ballot.yml` into one file per county has merged.

## What the shared guides need for Alameda

The team lead widens these once for all three counties after the `ballot.yml` split; this branch does not edit them. "All three Alameda areas" means `alameda-county`, `oakland`, `berkeley`. Each of these guides has a pick on RTM or a statewide/district contest that appears on all three pages, so all three areas apply even when its local picks are narrower.

| Guide | Add to `areas` | Sources to add | Notes |
|---|---|---|---|
| `sierra-club-sf-bay` | all three | none: https://www.sierraclub.org/sfbay/2026-endorsements already lists the Alameda picks | Already `fetchWith: browser`. The page also lists Supervisor Lena Tam (not on the Nov ballot) and Contra Costa/Marin contests. |
| `spur` | all three | none: the Oakland EE and FF pages are already in `extraSources` | Oakland EE/FF and RTM only. Review the SF quote diff after the re-extract (runbook). |
| `seiu-1021` | all three | none: the "East Bay" section is on the existing source page | No position on Oakland EE. |
| `yimby-action` | all three | none: same national page | Optionally add EB4E as its own guide (planned, `eb4e`); YIMBY Action itself gives no reasons. |
| `bay-rising-action` | all three | none: same page (Alameda table: RTM, OAK EE, FF, BRK X, Z) | |
| `greenbelt-alliance` | all three | https://www.greenbelt.org/blog/vote-yes-measure-l-alameda/ , https://www.greenbelt.org/blog/vote-yes-measure-o-albany/ (the reasons for its city of Alameda L and Albany O picks; optional if the main page's summaries are enough) | Already `fetchWith: browser`. |
| `ca-wfp` | all three | none: same PDF | Berkeley council picks have no district on the PDF; the extractor must match by name. |
| `lwv-ca` | all three | none | `manual: true`; props only. |
| `courage-california` | all three | https://www.progressivevotersguide.com/california/2026/general/county/alameda | Federal, legislative and statewide only. |
| `mercury-news` (to become the Bay Area News Group guide) | all three | https://www.eastbaytimes.com/opinion/endorsements/ (index) and, once published, each East Bay Times local endorsement. Current East Bay Times Nov URLs: https://www.eastbaytimes.com/2026/09/25/endorsement-elect-fiona-ma-californias-lieutenant-governor/ , https://www.eastbaytimes.com/2026/09/26/endorsement-elect-ben-allen-californias-next-insurance-commissioner-2/ , https://www.eastbaytimes.com/2026/09/29/endorsement-elect-eleni-kounalakis-californias-next-treasurer-2/ , https://www.eastbaytimes.com/2026/10/07/endorsement-elect-richard-barrera-californias-superintendent-of-public-instruction-november-election-california-public-schools-sonja-shaw/ | The first three are the same editorials as the Mercury News URLs already in `extraSources`; adding them duplicates text, so the index page alone is enough until local picks appear. The Barrera editorial (10/7) is new. **The East Bay Times endorsements index still lists the June primary picks** (including a June Oakland Measure E editorial), so the ingest must ignore anything dated before September. |

### East Bay guides owned by the Contra Costa branch

These are created on the Contra Costa branch (areas `[contra-costa]` at first); this branch does not create them. What each needs for Alameda:

| Guide | Add to `areas` | Sources | Notes from the Alameda extraction test (2026-10-07) |
|---|---|---|---|
| `east-bay-dsa` | all three | Source https://vote.eastbaydsa.org/ with `fetchWith: browser`, plus extraSource https://vote.eastbaydsa.org/voter-guide.pdf | One guide covers every county. The rendered page's table of contents is the only text that carries the 👍 "recommended" marks; the PDF has the analysis but shows 👍 only as images, so a PDF-only source misses most recommended measures. Picks to expect in Alameda: 🌹 BRK D7 Micael, BRK rent board slate, Hayward D1 Syrop, OAK D2 Nate Adams, OUSD D2 Brouhard, D6 Bachelor, BRK Z; 👍 RTM, ALA L, M, ALB P–T, BRK U–Y, AA, Dublin I, San Lorenzo J, Sunol K, EMY BB, Hayward CC, Newark DD, OAK FF, Piedmont GG, Pleasanton HH; no position on ALA N, ALB O, OAK EE, UC II. Quotes rejected in the test: descriptive "Measure I/J seeks to…", "The measure is subject to an independent…" (L), "This measure would convert the existing soda tax…" (AA), "Micael is running to expand on…", "Adams is endorsed by Oakland Educators…". |
| `bike-east-bay` | `alameda-county`, `berkeley` | none beyond https://bikeeastbay.org/Election2026/ | RTM, BRK U and V yes; No 43, 45. Reject "VOTE YES on Measure U/V, …" (calls to vote). |
| `ebho` | `alameda-county`, `berkeley` | none beyond https://ebho.org/2026-campaign-endorsements/ | RTM, Prop 1, No 43, BRK X. |
| `ifpte-21` | `alameda-county`, `oakland` (it also has SF picks) | none beyond https://ifpte21.org/endorsements/ | Picks OAK mayor, OAK D4, EBMUD W3 and W7, Hayward CC, AD16/18/20/24. Its SF school board pick spells "Virgina Cheung", so the SF contest needs that alias. |
| `unite-here-2`, `eqca`, `pp-norcal-action`, `envirovoters`, `350-bay-area-action` | probably all three | not checked for Alameda | Not surveyed in this discovery. |
| `lwv-bay-area` | all three if it takes an RTM position | — | No RTM position found on https://www.lwvbayarea.org/ on 2026-10-07. |

## Data phase notes (2026-10-07)

- **ACDP and APA Dem Caucus are `manual: true`.** Both sites return 403 to the pipeline's plain fetch and to its headless-browser retry, and ACDP's picks are PDFs, which never get a browser retry, so `fetchFrom: local` would not help. Their picks were entered by hand from the pages read in a real browser.
- **Alameda County GOP is `manual: true`** with its two Union City picks; the rest of its candidates page is the June field.
- **Unopposed races printed on the ballot are included when a guide picks them** (Oakland D4 and Auditor, Berkeley Auditor and School Board, San Leandro D1, D2 and D5, Hayward D6). Newark Mayor (unopposed) and Pleasanton D1 have no guide position and are left out.
- **The verifier flip-flops on two valid shapes**: a one-name pick the guide ranks #1 (Empower OUSD D2), and a two-name "rank both, no order" pick (ALC BRK D1 and OUSD D4). Both follow the extractor's rules (a one-name pick is never ranked; an unordered dual is two names, unranked), and a re-verify confirmed them once and held them once. They were moved from `held` to `picks` by hand (Empower's as a one-name pick with `ranked: true`, ALC's as unranked two-name picks); a later re-extract may hold them again (see the runbook's pending follow-ups).
- **Still held**: EBYD's Albany council pick ("1. Tiedemann, 2. Lopez"). Albany fills two seats by ranked-choice voting, and the schema cannot rank a multi-seat pick.

### Alameda guides with picks outside Alameda (for the widening step)

These stay on this branch with Alameda areas only; add `contra-costa` when the shared guides are widened:
- `apen-action`: Richmond mayor (Claudia Jiménez), Yes on Richmond RTM, neutral on Richmond Measure O, Yes on Richmond Measure V.
- `acce-action`: Richmond mayor (Claudia Jimenez), Yes on San Pablo Measure S (rent control); also non-Bay Area picks (Los Angeles, Sacramento, San Diego, Orange County) that match no contest.
- `ebyd`: San Pablo City Council (Caden Cotton-Blake).
- The IFPTE 21 SF school board alias ("Virgina Cheung" for Virginia Cheung) is left for the widening step.
