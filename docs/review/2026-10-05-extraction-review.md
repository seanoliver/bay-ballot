# Extraction review: Nov 3, 2026 (Task 12)

Run: `npm run bb -- extract --all --archive` on 2026-10-05 (branch `build/v1`). One pass, no `--browser` reruns needed, no `--force`, no hand fixes. `npm run validate` gives `data OK`.

## Totals

| | |
|---|---|
| Guides in registry | 44 (41 + 3 added in `b82d20d`) |
| Published | 35 (incl. 1 manual: lwv-ca, skipped by extract) |
| Pending | 9 (8 with no source + d2-dems, which is image-only) |
| Failed | 0 |
| Total picks (published) | 870 |
| Quotes kept | 416 |
| Quotes dropped | 24: attributed-speech 13, too-short 8, partial-sentence 3 |
| Picks dropped | 6 (all unknown-candidate name variants, see below) |
| Fuzzy name matches | 23 (all benign: middle initials, accents, quote marks) |
| Model notes | 24 |
| Archive | web.archive.org worked. No snapshot for: all 5 bay-area-reporter pages, d2-dems, sierra-club-sf-bay, 2 of 26 spur pages |

**Cost** (Sonnet 5.5 at $2/M in, $10/M out, $0.20/M cache read, $2.50/M cache write):

| in | out | cache read | cache write | total |
|---|---|---|---|---|
| 302,985 ($0.61) | 89,633 ($0.90) | 159,852 ($0.03) | 9,688 ($0.02) | **$1.56** |

## Golden guides vs committed versions

Compared each pick's candidates/vote and `ranked` flag against `HEAD`. Status, hasReasoning, source and fetchedAt are also unchanged.

| Guide | Pick mismatches | What changed |
|---|---|---|
| growsf | 0 | +54 quotes, archived |
| sf-chronicle | 0 | +27 quotes, archived |
| league-pissed-off-voters | 0 | +50 quotes, archived |
| sf-dems | 0 | archived (no reasoning, so no quotes) |
| spur | 0 | +50 quotes, 24/26 pages archived |
| lwv-sf | 0 | +19 quotes, archived |
| lwv-ca | 0 | skipped (manual) |

Verdict: no mismatches to adjudicate. The diff for these files is quotes plus `archived:` plus the YAML switching from flow to block style.

## PICK DROPPED (6)

Each one is the guide spelling a ballot candidate differently. All 6 are real endorsements that are currently missing from the data.

| Guide | Contest | Page says | Ballot name | Verdict |
|---|---|---|---|---|
| bay-area-reporter | supervisor-8 | Michael Trung Nguyen | Michael T. Nguyen | same person |
| cadc | supervisor-10 | Dion-Jay Brookter | Dionjay (DJ) Brookter | same person |
| cadc | board-of-education | Philip Kim | Phil Kim | same person; drops the whole 3-seat pick |
| sf-building-trades | public-defender | Manohar Raju | Mano Raju | same person (sf-labor-council's "Manuhar Raju" was matched by the model) |
| sf-gop | board-of-education | Laurence Lee | Laurance Lee | same person; drops the whole pick |
| wallenberg-dems | supervisor-2 | Stephen Sherill | Stephen Sherrill | typo on the page |

## Model notes by guide

| Guide | Contest | Note | My read |
|---|---|---|---|
| ed-lee-dems | supervisor-8 | Dual endorsement, rank #1 and #2 in any order | stored unranked: OK |
| endc | supervisor-6, -10 | Sole endorsement | OK |
| housing-action-coalition | us-rep-11, assembly-17, assembly-19, supervisor-6, supervisor-10 | Listed as made ahead of the June primary; page doesn't say it carries over | **needs decision**, see below |
| potrero-hill-dems | supervisor-10 | Sole endorsement | OK |
| potrero-hill-dems | college-board-partial | Page labels it "full term" but it's the second listing (Ruth Ferguson) | right: Ferguson is the only partial-term candidate |
| sf-green-party | us-rep-11 | Endorsed in the primary, listed for November | page says "Connie Chan (endorsed in the primary)": OK |
| sf-labor-council | public-defender | Page says "Manuhar Raju", matched to Mano Raju | OK |
| sf-rising-action | supervisor-8 | Dual endorsement, not ranked | OK |
| sf-tenants-union | supervisor-4 | Page says "Jeremy Greco", no ranking | OK |
| sf-tenants-union | supervisor-10 | Page says "Dion-Jay "DJ" Brookter", no ranking | OK |
| sfwpc | supervisor-2, -4, -6, -8, -10 | Listed as [Sole] endorsement | OK |
| uesf | supervisor-8 | Three candidates, no explicit rank | **wrong in data**: stored `ranked: true` |
| uesf | supervisor-10 | Brookter #1; Eppler and Bryant unranked | **wrong in data**: stored `ranked: true` for all three |
| wallenberg-dems | assembly-17, -19 | Page puts Stefani under AD-17 and Haney under AD-19; assigned by candidate | right: the page has the labels swapped (ballot: Haney AD-17, Stefani AD-19) |

## Newly published guides

| Guide | Picks | hasReasoning | Sample quote |
|---|---|---|---|
| abundant-sf | 21 | true | rtm: "This measure is critical to saving Bay Area public transit…" ([abundantsanfrancisco.org/vote/ballot-measures](https://www.abundantsanfrancisco.org/vote/ballot-measures)) |
| alice-b-toklas | 48 | false | none |
| bay-area-reporter | 21 | true | supervisor-6: "Overall, Dorsey has been effective on the Board of Supervisors." ([ebar.com/story/170743](https://www.ebar.com/story/170743/Opinion/Editorial/Editorial%3A%20The%20B.A.R.%20makes%20its%20SF%20supervisor%20choices)) |
| blueprint-sf | 13 | true | board-of-education: "Vote for Autumn Brown Garibay to ensure families have a strong voice on the School Board." ([sfblueprint.org](https://www.sfblueprint.org/advocacy/november-2026-voter-guide)) |
| cadc | 34 | true | prop-2: "CADC supports Prop. 2 because setting aside more revenue during strong economic years…" ([sfcadc.org/endorsements](https://www.sfcadc.org/endorsements)) |
| d11-dems | 39 | false | none |
| ed-lee-dems | 47 | false | none |
| endc | 42 | false | none |
| housing-action-coalition | 6 | true (was false) | the same boilerplate sentence on all 6 picks: "These leaders have a proven track record of championing smarter land-use policy…" |
| milk-club | 36 | false | none |
| noe-valley-dems | 17 | false | none |
| potrero-hill-dems | 34 | false | none (page says more votes are coming after Oct 6) |
| seiu-1021 | 33 | false | none |
| sf-building-trades | 24 | false | none |
| sf-gop | 16 | true | supervisor-2: "Our strongest endorsement this cycle goes to Nicholas Berg for District 2 Supervisor." ([sfgop.org](https://sfgop.org/nov-2026-endorsements)) |
| sf-green-party | 27 | true (was false) | none: the page says its full Green Voter Guide is "to be published" |
| sf-labor-council | 14 | false | none |
| sf-parents-action | 1 | true | board-of-education: "SF Parents Action has known Brown Garibay for years…" ([sfparentaction.org](https://sfparentaction.org/endorsements-2026-nov/)) |
| sf-rising-action | 6 | true | us-rep-11: "We are thrilled to endorse Supervisor Connie Chan for Congress -again!" ([sfrisingaction.org](https://www.sfrisingaction.org/election/november-3-2026-general-election/)) |
| sf-tenants-union | 28 | false | none |
| sf-yimby | 20 | true | us-rep-11: "The YIMBY movement would not be anywhere near where it is today if not for the work and influence of Scott Wiener." ([sfyimby.org](https://sfyimby.org/endorsements/sf-2026-general-election/)) |
| sflcv | 15 | false (was true) | none |
| sfwpc | 21 | false (was true) | none |
| sierra-club-sf-bay | 25 | false (was true) | none |
| uesf | 10 | false | none |
| united-dems | 47 | false | none |
| wallenberg-dems | 17 | false | none |
| westside-family-dems | 20 | true | supervisor-4: "Among the D4 candidates, Alan Wong stands out as the one we can rely on…" ([westsidefamilysf.com](https://westsidefamilysf.com/november-2026-endorsements)) |

## Spot-check list (10 least confident)

| # | Guide / contest | Concern | URL |
|---|---|---|---|
| 1 | uesf / supervisor-8 | stored `ranked: true`; the PDF lists McCoy, Nguyen, Patel with no ranks | [UESF PDF](https://uesf.org/wp-content/uploads/2026/09/UESF-Voter-Guide-PDF-Print.pdf) |
| 2 | uesf / supervisor-10 | stored `ranked: true` for all 3; only Brookter is #1, the other two are "unranked" | same PDF |
| 3 | housing-action-coalition / supervisor-6, -10, us-rep-11, assembly-17/19 | listed under "Ahead of the June 2026 primary…"; only Sherrill says "June and November" | [HAC](https://housingactioncoalition.org/news/nov-2026-endorsements) |
| 4 | housing-action-coalition / all | hasReasoning flipped to true on one boilerplate sentence repeated as each pick's quote | same |
| 5 | wallenberg-dems / assembly-17, -19 | page labels swapped; model reassigned by candidate | [wallenbergdems.org](https://wallenbergdems.org/) |
| 6 | sf-green-party / hasReasoning | flipped to true, but the page has no reasoning yet (0 quotes) | [SF Greens](https://www.sfgreenparty.org/endorsements/123-november-2026-endorsements) |
| 7 | potrero-hill-dems / all | page is still filling in until after Oct 6; Assessor and Public Defender are blank. **Re-run on or after 2026-10-07** (in `docs/runbook.md`) | [phdemclub.org](https://phdemclub.org/endorsements-for-november-3-2026-general-election/) |
| 8 | sf-labor-council / public-defender | "Manuhar Raju" matched by the model while building-trades' "Manohar Raju" was dropped, so the two are inconsistent | [SF Labor Council](https://www.sflaborcouncil.org/news-details/webview/our-endorsements/single/9251) |
| 9 | sierra-club-sf-bay / hasReasoning | flipped true to false (browser fetch, not archived) | [Sierra Club SF Bay](https://www.sierraclub.org/sfbay/2026-endorsements) |
| 10 | bay-area-reporter / all | 5-editorial merge, none archived; governor editorial still to come | [BAR editorials](https://www.ebar.com/ch/Opinion/Editorial) |

## Still pending

| Guide | Why |
|---|---|
| bernal-heights-dems | site's latest is June 2026 |
| home-sharers-dems | latest post is June 2, 2026 |
| sf-bay-guardian | latest is the June 2026 Clean Slate |
| sf-berniecrats | only a linktree, no slate page |
| sf-bike-coalition | the Bike the Vote page still shows June 2026 |
| sf-examiner | nothing found on the site or in search |
| sf-young-dems | /endorsements shows June 2026 |
| sf-young-republicans | /election-info goes up to June 2026 |
| d2-dems | the Nov 2026 slate is a single PNG (`D2 Dems Endorsement Slate.png`); needs hand entry or `manual: true` |

Clubs and papers checked with no Nov 2026 slate (no files added): Brownie Mary and Portola (Instagram only), District 3 (site last updated 2020), Fénix (no endorsements page), Filipino American (fadcsf.org does not resolve), Harriet Tubman (no posts), Richmond District (June 2026 only), SF Working Families (no endorsements page), South Beach D6 (empty blog), SF Bay View (no 2026 voters guide yet).

## Decisions applied (Sean approved all six)

Two commits: `307c481 feat: candidate aliases` (code, tests and the `ballot.yml` aliases) and `145aeb4 docs: daily refresh runbook`. Everything else below is uncommitted data.

New totals: 36 published (2 manual: lwv-ca, d2-dems), 8 pending, 889 picks, 423 quotes. The re-extract cost $0.28, making $1.84 for the day.

**1. Aliases.** Contests now take `aliases: { <official>: [<spelling>] }`, and an alias hit counts as a fuzzy match, so it still gets a note. I re-ran extract on the five affected guides. All 6 picks came back, with no other pick changes:

| Guide | Contest | Recovered pick | Note |
|---|---|---|---|
| bay-area-reporter | supervisor-8 | Gary McCoy / Michael T. Nguyen (ranked; page says "first choice" / "second choice") | 'Michael Trung Nguyen' -> 'Michael T. Nguyen' |
| cadc | supervisor-10 | Theo Ellington / Dionjay (DJ) Brookter (ranked) | 'Dion-Jay Brookter' -> 'Dionjay (DJ) Brookter' |
| cadc | board-of-education | Phil Kim / Virginia Cheung / Laurance Lee | 'Philip Kim' -> 'Phil Kim' |
| sf-building-trades | public-defender | Mano Raju | 'Manohar Raju' -> 'Mano Raju' |
| sf-gop | board-of-education | Laurance Lee / Phil Kim / Tim Tung | **no note**: this time the model wrote the official spellings, but the page prints "Laurence Lee, Phillip Kim". "Phillip Kim" has no alias yet |
| wallenberg-dems | supervisor-2 | Stephen Sherrill | 'Stephen Sherill' -> 'Stephen Sherrill' |

**2. UESF.** Hand-set supervisor-8 to unranked. supervisor-10 stays ranked.

**3. Housing Action Coalition.** Kept only supervisor-2 (Sherrill, the one pick marked "June and November"). Removed the boilerplate quote. hasReasoning is now false (item 4).

**4. hasReasoning, checked on each page.** The definition is "true if the guide explains its picks anywhere":

| Guide | Now | Finding |
|---|---|---|
| sf-green-party | false | the page lists picks with one-line labels and says the full Green Voter Guide is "to be published" |
| sflcv | true | each pick links to a "Read more" blog post explaining it |
| sfwpc | false | candidate and measure pages are bare lists ("The members have spoken!") |
| sierra-club-sf-bay | true | "Read endorsement explanation" links go to a combined explanations page |
| housing-action-coalition | false | the only shared text is boilerplate; no reasoning for any pick |

Both sflcv and sierra keep their reasons on linked pages that aren't in `extraSources`. That's why the model saw no reasoning and why they have 0 quotes.

**5. Potrero Hill Dems.** Re-run on or after 2026-10-07; the follow-up is logged in `docs/runbook.md`.

**6. d2-dems.** Hand-entered 18 picks from the slate image, using official names, with `manual: true`, hasReasoning false and no quotes. The slate's Prop G and Prop J say "No position", so I skipped them.

### Follow-ups (round 2)

Commits: `fcba6bc data: Phillip Kim alias` and `c3aa08b data: Shirley Webber alias`. The runbook update is uncommitted.

| Guide | Change | Result |
|---|---|---|
| sfwpc | added the ballot-measure page (same host, returns 200) to `extraSources`; re-extracted with `--archive` | 21 -> 46 picks: +25 measure picks (Y: 1, 2, 3, 4, 5, 37, 40, 44, RTM, A, B, C, H, I, J; N: 38, 39, 41, 42, 43, 45, D, E, F, G). Both pages archived. hasReasoning stays false, 0 quotes. **Side effect:** 7 single-candidate picks (assessor, public-defender, supervisor-2/4/6/8/10) are now `ranked: true` ("[Sole]"); the candidate names didn't change |
| sflcv | added all 15 "Read more" posts to `extraSources`; re-extracted with `--archive` | picks unchanged (15), hasReasoning true, quotes 0 -> 32. 15 of 16 pages archived (the BART post failed) |
| sierra-club-sf-bay | added the combined explanations page (same host; plain HTTP loops on a 302, but the guide is already fetched with the browser); re-extracted with `--archive` | picks unchanged (25), hasReasoning true, quotes 0 -> 23. The first rerun dropped secretary-of-state because the page prints "Shirley Webber"; I added that alias and re-ran, and the pick is back with a note. Archive failed for both pages |
| sf-gop | re-extracted after the Phillip Kim alias | board-of-education now carries both notes: 'Laurence Lee' -> 'Laurance Lee' and 'Phillip Kim' -> 'Phil Kim'. Picks unchanged; 23 quotes |
| uesf, housing-action-coalition | set `manual: true` so the hand edits survive the next refresh | — |

Round 2 cost $0.30, making $2.14 for the day.

**Final totals:** 44 guides: 36 published (4 manual: lwv-ca, d2-dems, uesf, housing-action-coalition), 8 pending, 0 failed. 914 picks, 475 quotes.

**Still open**
- sfwpc: un-rank the 7 single-candidate "[Sole]" picks so they match how endc and potrero-hill store theirs? This is a hand edit, so it would also need `manual: true`.
