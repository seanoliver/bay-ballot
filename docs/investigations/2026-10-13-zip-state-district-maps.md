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
- **Result:** maybe rows fell from 13,642 to 12,194 (1,448 now hidden as off). Assembly 1,152 to 430, Congress 901 to 410, State Senate 183 to 102, San José council 117 to 19, Sonoma supervisors 80 to 20. Board of Equalization went from 312 to 316: ZIPs that reach San Joaquin County (94505, 95219, 95377, 95391) now keep District 1, which covers it, where the county rule had ruled District 1 out because its contest lists only Solano. That is a fix, not a loss. SF supervisor lists are unchanged.

## How it works

- `DISTRICT_MAPS` entries with `place: STATE_PLACE` cover every ZIP, and `zipFit` looks them up for any contest named in `STATE_DISTRICTS`, whatever its `within` list says. Their key is `state:California/<seat>`.
- `format: "zipped shapefile"` reads the map with `src/pipeline/shapefile.ts`: a small ZIP reader (stored and deflated entries, `node:zlib`), a polygon `.shp` reader, a `.dbf` column reader, and inverse Web Mercator when the `.prj` says so. It fails on any other projection.
- District ids lose leading zeros so "08" matches the ballot's "8".
- A district under 0.5% of a ZIP's mapped land is kept anyway if a 2020 Census block with people or homes (`POP100 > 0 OR HU100 > 0`, TIGERweb `Tracts_Blocks/MapServer/2`) has its internal point inside both the ZIP's shape and the district's. One block query per ZIP, by the ZIP's bounding box, shared across maps. This replaced the hand-kept `slivers` list and the stop on unreviewed slivers. The run logs each kept and each dropped overlap of 0.1% or more.
- `districtShares` now bands each shape's edges by latitude and skips districts whose bounding box misses the ZIP, so statewide maps with tens of thousands of edges run in seconds. Results for SF are unchanged.
- The whole `npm run bb -- zips` run takes about two minutes, most of it the block queries.

## Gotchas

- A mapped district a ZIP reaches stays "maybe", even when it is the only one, as for SF supervisors. Treating a ZIP with one mapped district as "on" would move another 803 rows from maybe to on. That is a product decision, not made here.
- Oakland and Berkeley council maps were skipped: no 2022 source with GeoJSON was confirmed. San Mateo and Solano supervisors, county boards of education, school districts and special districts are not mapped. School and special districts are the largest remaining group; Census TIGER has school district boundaries (not trustee areas) that could rule out whole districts.
- Court of Appeal districts are whole counties by statute, so they need no map, but `zipFit` still says maybe for them.
- The block check uses 2020 homes. A home built since in a sliver with no 2020 homes would see its district hidden; Show all is one tap away.

## References

- AB 604 page: https://selc.senate.ca.gov/proposed-congressional-map
- Statewide Database AB 604 files: https://statewidedatabase.org/redistricting2021/
- CA state district service: https://services.gis.ca.gov/arcgis/rest/services/Government/CaliforniaDistricts/MapServer
- TIGERweb blocks: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2
