# ZIP to county and city data for the ZIP filter

Investigated 2026-10-12 (Pacific), while building the first version of the ZIP filter (#44, PR #159).

## Context

The ZIP filter has to decide, for a 5-digit ZIP, which contests can be on a voter's ballot. The earlier address-filter work (`feat/address-filter`) used precinct files and district maps for SF, San Mateo and Santa Clara. A first version across all nine counties uses which counties and cities a ZIP overlaps. Of the 545 contests, 33 are statewide or countywide, 161 are city contests, 102 are council districts inside one city, and the rest are other districts.

## Key findings

- **Source:** the Census 2020 relationship files `tab20_zcta520_county20_natl.txt` and `tab20_zcta520_place20_natl.txt` under https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/. Pipe-separated, UTF-8 with a byte-order mark, about 7 and 10 MB. Each row is one ZCTA (ZIP Code Tabulation Area) and one county or place, with `AREALAND_ZCTA5_20` (the ZCTA's land) and `AREALAND_PART` (the overlap's land), in square meters.
- **Coverage:** 310 ZCTAs touch the nine Bay Area counties. Every one of the 96 place names the ballot uses matches a Census place once " city", " town" or " CDP" is removed.
- **Unincorporated places:** Castro Valley, San Lorenzo, Fairview and Sunol are census-designated places (CDP, `CLASSFP` starting with `U`), not cities. They are kept.
- **Name clash:** "Mountain View" is both the city (Santa Clara County) and a CDP in Contra Costa County. When a name is both, the build keeps only the incorporated city.
- **A district's `within` is not its extent.** It names the places the contest is filed under and leaves out unincorporated land and sometimes other cities (Mountain View-Los Altos Union High School District lists only Mountain View). Congress, Assembly and State Senate districts in Alameda and Santa Clara are listed by cities only. So a district can't be ruled out because a ZIP misses its cities: 94305 (Stanford) touches no city on the ballot but votes in Palo Alto Unified.
- **County lists drive hiding.** A district's counties are its `within` counties, the counties of its `within` cities, its list group's county, and every county the district's at-large contests name (`districtCounties`, from `poolDistrictCounties`; Sonoma County Junior College District's trustee area 5 lists only Sonoma, but its at-large bond lists Marin too). Sibling trustee areas don't pool, since each has its own area (BART District 8 is SF only), and names for a kind of seat (`SEAT_KINDS` in `src/pipeline/zips.ts`: Supervisor, Congress, City Council) never do. A county missing from all of these hides the district there.
- **Effect:** a district is hidden only when none of its counties holds the ZIP, and a city contest or council district only when the ZIP doesn't touch the city. With real data, 94040 narrows the Santa Clara County page from 125 contests to 92 (67 of them "may be"), 94611 narrows Alameda County from 146 to 94, and 94401 narrows the Bay Area page from 545 to 62. SF is one city, so 94110 hides nothing and marks its 12 district contests "may be". District maps would turn most "may be" rows into yes or no.

## How it works

- `npm run bb -- zips` downloads both files and runs `buildZipTable` (`src/pipeline/zips.ts`), which writes `src/data/zips.json`, one ZIP per line: for each ZIP, its Bay Area counties, any other counties it reaches (`outside`), and the ballot's places it overlaps (`full` only when the ZIP's land is all inside). Both files are built from census blocks, so every overlap with land is real and counts. It also writes `cityCounty`, each ballot city's county from the area files.
- `zipFit` (`src/lib/zip.ts`) rates each contest `on`, `maybe` or `off` from its `jurisdiction` and its list group's county; `zipGroups` filters the list. `BallotView` loads the table only after a ZIP is entered.
- The ZIP is stored in `localStorage` (`bb-zip`) and never written to the URL. The ZIP's ballot is the Bay Area list with `?mine=1`, a flag that names no ZIP, so Back, Forward and reload show what they showed; picking any area chip drops the flag and keeps the ZIP. `zip` is on the analytics scrub list (`src/lib/analytics.ts`), so `beforeSend` drops it from Vercel events and `SiteAnalytics` removes it from the address bar for Ahrefs.

## Gotchas

- ZCTAs are Census approximations of USPS ZIP codes: each census block goes to the ZIP most of its addresses use. An address near a city or county line whose ZIP lost its block to a neighbor can see one of its contests hidden. The UI says "probably not" for hidden rows and points to Show all. HUD's USPS ZIP crosswalk is built from real addresses and would close this gap, but needs a HUD API token. PO-box-only ZIPs and ZIPs created after 2020 have no ZCTA; the filter says it can't map them and shows every contest.
- City limits are as of January 1, 2020. Land annexed since then is missing, so a ZIP that only reaches a city through a later annexation has that city's contests hidden.
- The ZIP narrows the Bay Area list, so a ZIP spanning two Bay counties (94303: San Mateo and Santa Clara) keeps both counties' contests. A county or city page always shows that place in full; picking one sets the ZIP aside without clearing it.
- A new city, or an at-large district contest naming a new county, needs `npm run bb -- zips`. `tests/zip.test.ts` fails when the committed table misses a ballot city or its `districtCounties` are stale.
- A new county needs its Census GEOID in `BAY_COUNTIES` in `scripts/bb.ts`; the command fails until it is added.

## References

- Census relationship file layouts: https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.html
- Earlier district-data work: `docs/investigations/2026-10-06-sf-address-district-data.md` and `docs/investigations/2026-10-07-peninsula-address-district-data.md` on `feat/address-filter`
