# SF address and district data sources

**Date:** 2026-10-06
**Context:** the address filter needs to map any San Francisco address to its election districts for Nov 3, 2026, in the browser, from data processed at build time.

## Key findings

- SF publishes every address with coordinates, and every voting precinct with its districts. Joining the two at build time gives an exact address → districts map with no third-party service.
- Prop 50 (passed Nov 4, 2025) replaced California's congressional map, but SF's two districts (CD 11 and CD 15) cover the same precincts under both maps.
- SF spans BART Districts 7, 8 and 9. Only District 8 is on the Nov 2026 ballot.
- 20 of SF's 27 ZIPs contain addresses in more than one Supervisor district, so a ZIP alone usually can't settle the ballot.

## Sources

| Data | Dataset | Format, size | License | Notes |
|---|---|---|---|---|
| Base addresses | DataSF `3mea-di5p` (EAS base addresses) | CSV/GeoJSON via Socrata | PDDL | ~224,000 rows, nightly. Includes ZIP and the Supervisor district per address |
| Addresses with units | DataSF `ramy-di5m` | CSV, 132 MB | PDDL | 388,619 rows; not needed (units share a location) |
| Precincts + crosswalk | DataSF `d6x4-hefw` | GeoJSON 1.1 MB | Not stated | 514 precincts; columns `supe22`, `assemb22`, `cong22`, `bart22`, `boe22`. Data dated 2023-09-13. A few rows fall outside SF; filter them |
| Supervisor districts | DataSF `f2zs-jevy` (2022) | GeoJSON 304 KB | CC0 | 11 districts; cross-check only |
| Assembly districts | Census TIGER/Line 2025 SLDL, California | Shapefile 4.1 MB | Public domain | Agrees with the precinct file's AD 17/19 |
| Congress (Prop 50) | Statewide Database AB 604 shapefile | Shapefile 4.3 MB | Not stated | 52 districts; NAD83 |
| BART districts | BART ArcGIS feature service `BART_Director_Districts` | GeoJSON 653 KB (request `outSR=4326`) | Not stated | 2022 Plan E2, in effect until after 2030 |

URLs:

- https://data.sf.gov/d/3mea-di5p
- https://data.sf.gov/d/d6x4-hefw (download: `https://data.sf.gov/api/geospatial/d6x4-hefw?method=export&format=GeoJSON`)
- https://data.sf.gov/d/f2zs-jevy
- https://www2.census.gov/geo/tiger/TIGER2025/SLDL/tl_2025_06_sldl.zip
- https://statewidedatabase.org/d25/draft-districts/
- https://services.arcgis.com/sqS7RNuF1BQinj5N/arcgis/rest/services/BART_Director_Districts/FeatureServer/0

## Gotchas

- The DataSF CSV header uses display names ("ZIP Code", "Unit Number") that differ from the API field names.
- DataSF's `bt7b-fdtx` Assembly layer is the 2011 map. Don't use it.
- The BART service is in California State Plane (EPSG:2227) unless `outSR=4326` is requested.
- The precinct file's `cong22` is the pre-Prop 50 map. For SF it matches, but the build should check it against the Prop 50 file rather than assume.

## Unverified

- License terms for the precinct, BART and Prop 50 files.
- Whether SF Elections changed any precincts for Nov 2026 after the 2023 data update.
- An official Secretary of State statement that the Prop 50 map applies to the Nov 2026 ballot (news coverage says it does).
