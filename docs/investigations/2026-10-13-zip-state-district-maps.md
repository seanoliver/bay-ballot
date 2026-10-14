# ZIP to state, Sonoma supervisor and San José council districts

Investigated 2026-10-13 (Pacific), extending the SF supervisor map (`2026-10-13-sf-supervisor-zip-overlap.md`) toward #44.

## Context

After the SF supervisor map, a ZIP still kept every district contest in its counties as "may be on your ballot". Across the 310 ZIPs in `src/data/zips.json` and every contest on the Bay Area list, that was 13,642 maybe rows. By kind:

| Kind | Maybe rows | Contests |
| --- | ---: | ---: |
| School districts | 6,775 | 143 |
| Special districts | 2,403 | 52 |
| Assembly | 1,152 | 18 |
| Congress | 901 | 14 |
| City contests (ZIP partly in the city) | 571 | 161 |
| Court of Appeal | 313 | 2 |
| Board of Equalization | 312 | 2 |
| State Senate | 183 | 2 |
| San José council | 117 | 3 |
| Sonoma supervisors | 80 | 2 |
| Each other council, supervisor or county board of education | 87 or fewer | 1 to 4 |

Measured by running `zipFit` for every ZIP against `placeGroups` of the 2026-11 ballot, with each group's county as `home`, as the page does.

## Key findings

- **Congress uses the Proposition 50 map.** The 2026-11 contests are on AB 604, the map Prop 50 adopted in November 2025: `us-rep-1` is Mike McGuire in Sonoma, `us-rep-9` is Josh Harder with Contra Costa. Neither fits the 2021 commission map. Source: the Senate Elections and Constitutional Amendments Committee, https://selc.senate.ca.gov/proposed-congressional-map, "AB 604 District Shapefile" at https://selc.senate.ca.gov/media/603 (chaptered 8/21/2025). It is a zipped shapefile in Web Mercator with 52 districts, ids in `DISTRICT`, zero-padded ("08"). The Statewide Database copy (https://statewidedatabase.org/pub/data/d25/AB604%202025-08-16.zip, NAD83 degrees) has the same vertices to within 0.000014 degrees.
- **Assembly, State Senate and Board of Equalization use the 2021 commission maps.** Prop 50 changed only Congress. Source: the state GIS service https://services.gis.ca.gov/arcgis/rest/services/Government/CaliforniaDistricts/MapServer, layers 0 (Assembly, 80), 1 (Senate, 40) and 3 (Board of Equalization, 4), queried statewide as GeoJSON. Layer 2 there is the 2021 congressional map and must not be used.
- **Sonoma supervisors:** https://socogis.sonomacounty.ca.gov/map/rest/services/BASEPublic/Supervisorial_Districts/FeatureServer/0, "Supervisorial Districts 2020", the lines adopted by Ordinance 6364 on 2021-12-14, ids in `SupNum`.
- **San José council:** https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_AdministrativeBoundaries/MapServer/1, "City Council Districts (Current)", adopted 2022-01-11 and updated for annexations, ids in `DISTRICT`. Layer 17 is the 2011 archive.
- **Area alone hid real voters.** At the 0.5% threshold, 94706 (Albany) dropped Congress 8, but a Contra Costa block in that overlap has 28 people and 17 homes. 95116 dropped Congress 17 at 0.497% with two blocks of 97 people. ZIP areas and these districts are both built from 2020 Census blocks, so blocks are the check.
- **Area alone also drops whole neighbourhoods in big ZIPs.** In a large exurban ZIP, 0.5% can be a new subdivision, and the homes check only knows 2020. So an overlap is dropped only when it is also thin (see How it works).
- **ZIP areas are not USPS ZIPs.** A ZCTA is a set of Census blocks, each given the ZIP most of its addresses use. A home in a block near the edge can have the neighbouring ZIP, and so a district its own ZCTA never reaches. The run keeps any district with 2020 homes in a block that reaches within 150 m of a ZIP's edge (see How it works).
- **Result**, maybe / on / hidden rows over the Bay Area list for all 310 ZIPs: main 13,642 / 8,364 / 146,944; with these maps, the single-district rule, the size test and the edge buffer, 11,783 / 9,006 / 148,161. By kind, maybe rows on main then now: Assembly 1,152 to 391, Congress 901 to 356, Board of Equalization 312 to 34, State Senate 183 to 48, San José council 117 to 22, Sonoma supervisors 80 to 24, SF supervisors 32 to 43 (the edge buffer adds more than the single-district rule takes away).

## How it works

- **One district is on.** When a ZIP reaches exactly one district of a map (after the threshold and the homes check) and lies wholly in the map's place, `zipFit` marks that contest on, for every map including SF supervisors (approved by Sean 2026-10-13, reversing the SF note that kept it maybe). Wholly in: always for state maps, `whollyIn` for a county, `full` for a city. So 94501, mostly Alameda with a little SF land in District 6, keeps SF District 6 as maybe, and a ZIP partly outside San José keeps its one council district as maybe. Several districts stay maybe. County or city membership alone never makes a district contest on. Before the size test and edge buffer below, this moved 802 rows from maybe to on; the size test and the edge buffer then gave back 391 maybe rows, mostly where a ZIP's edge runs along a district line.
- `DISTRICT_MAPS` entries with `place: STATE_PLACE` cover every ZIP, and `zipFit` looks them up for any contest named in `STATE_DISTRICTS`, whatever its `within` list says. Their key is `state:California/<seat>`.
- `format: "zipped shapefile"` reads the map with `src/pipeline/shapefile.ts`: a small ZIP reader (stored and deflated entries, `node:zlib`), a polygon and PolygonZ `.shp` reader, a `.dbf` column reader that skips deleted rows, and inverse Web Mercator. It accepts only WGS 84 or NAD 83 degrees and WGS 84 Web Mercator, and fails on any other projection.
- District ids lose leading zeros so "08" matches the ballot's "8".
- `reachedDistricts` (`src/pipeline/zips.ts`) decides each ZIP's districts for a map, from numbers `runZips` measures. An overlap is dropped only when all three hold: under 0.5% of the ZIP's mapped land (`MIN_DISTRICT_SHARE`); thinner than 60 m (`SLIVER_WIDTH_M`); and no 2020 Census block with people or homes (`POP100 > 0 OR HU100 > 0`, TIGERweb `Tracts_Blocks/MapServer/2`) has its internal point inside both the ZIP's shape and the district's. This replaced the hand-kept `slivers` list and the stop on unreviewed slivers.
- **Thickness** (`overlapWidth`): the smaller of the overlap's longest east-west run along any row and its longest north-south run along any column, in metres. A border sliver is thin one way however long it is. 60 m is about one house lot (30 to 40 m deep) plus its street (about 20 m): a strip thinner than that can't hold a street with homes, so new homes there are unlikely, and 2020 homes are caught by the block check anyway. The nine dropped slivers measure 16 to 58 m; every overlap kept by the size test alone measured 64 m or more (94117 with SF District 7, the 0.33% strip from the SF note, is 85 m and is now kept as maybe). A diagonal sliver reads up to 1.4 times thicker, which only keeps more.
- **Edge buffer** (`EDGE_BUFFER_M`, 150 m, `blocksNearEdge`): any district holding a block with people or homes that may reach within 150 m of the ZIP's edge, inside or out, is kept as reached. 150 m is about one city block plus a street, as the review asked. TIGERweb gives each block's internal point, not its outline, so a block's reach is 150 m plus the square root of its land area (`AREALAND`), the side of a square block, which is more than the 0.71 sides from a square's centre to its corner. The square-root term is capped at 3 km (`BLOCK_REACH_CAP_M`): in rural Napa, south Santa Clara and west Sonoma that covers 96% to 99% of blocks with homes, and a wider cap would pull most of a rural county into every nearby ZIP's query. The block query covers the ZIP's box grown by 3,150 m (`MAX_BLOCK_REACH_M`). It adds a district to a ZIP more often than any other rule, mostly where a ZIP line follows the same street as a district line.
- The run logs each overlap kept by only one of the size tests, each kept for homes or the buffer, and each dropped overlap of 0.1% or more.
- **Shares have different denominators by map.** A state map covers all of California, so a share is of the whole ZIP's land. A county or city map covers only that place, so a share is of the ZIP's land inside it: 95051 is 100% San José District 1 though only a 13 m strip of it is in San José. The single-district rule therefore also requires the ZIP to lie wholly in a county or city map's place.
- `districtShares` now bands each shape's edges by latitude and skips districts whose bounding box misses the ZIP, so statewide maps with tens of thousands of edges run in seconds. That refactor alone left the SF results unchanged; the later rules here do change SF lists.
- The whole `npm run bb -- zips` run takes about one and a half minutes, most of it the block queries (eight at a time).

## Gotchas

- Oakland and Berkeley council maps were skipped: no 2022 source with GeoJSON was confirmed. San Mateo and Solano supervisors, county boards of education, school districts and special districts are not mapped. School and special districts are the largest remaining group; Census TIGER has school district boundaries (not trustee areas) that could rule out whole districts.
- Court of Appeal districts are whole counties by statute, so they need no map, but `zipFit` still says maybe for them.
- **Superblocks can still give a false on.** A block bigger than 9 km² can touch a ZIP's edge more than 3,150 m from its internal point. Its district is then missed, and if that leaves the ZIP one district, the ZIP shows that district on and hides the real one for those homes. Such blocks hold about 55 people each (median) in the rural samples checked. Fetching block outlines (TIGERweb `returnGeometry`) would close this at the cost of much larger responses.
- ZIP areas are Census ZCTAs, not USPS ZIPs. The buffer covers homes near an edge, but a ZIP the Postal Service draws far from its ZCTA (PO-box ZIPs, rural routes) can still hide a race its readers vote on. ZIPs whose ZCTA misses a county entirely are still ruled out by the county rule, which no buffer reaches. Show all is one tap away.
- The block check uses 2020 homes. A home built since in a thin sliver with no 2020 homes would see its district hidden.
- Board of Equalization: ZIPs that reach San Joaquin County (94505, 95219, 95377, 95391) now keep District 1 as maybe, which the county rule had ruled out because the District 1 contest lists only Solano. Their Bay Area readers are in District 2, so this is a harmless extra maybe, not a fix.

## References

- AB 604 page: https://selc.senate.ca.gov/proposed-congressional-map
- Statewide Database AB 604 files: https://statewidedatabase.org/redistricting2021/
- CA state district service: https://services.gis.ca.gov/arcgis/rest/services/Government/CaliforniaDistricts/MapServer
- TIGERweb blocks: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2
