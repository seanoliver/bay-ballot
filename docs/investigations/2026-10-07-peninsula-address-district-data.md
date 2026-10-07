# San Mateo County and Palo Alto / Mountain View address and district data

**Date:** 2026-10-07
**Context:** extend the address filter (SF only today) to all of San Mateo County and to Palo Alto and Mountain View in Santa Clara County. The filter needs address → precinct → contests, built at build time from public data, run in the browser. This doc lists the districted contests on our Nov 3, 2026 ballot for those areas, the public data that can resolve each one, and what can't be resolved.

## Key findings

- **Federal and state contests are easy.** The Statewide Database (SWDB) June 2026 primary files give Congress, Assembly, State Senate and BOE per precinct, already on the Prop 50 Congress map. Palo Alto and Mountain View are entirely CD 16, AD 23, SD 13. San Mateo spans CD 15/16 and AD 19/21/23. BOE 2 and the Court of Appeal (1st for San Mateo, 6th for Santa Clara) are countywide. No State Senate contest is on our ballot.
- **Local contests are the hard part.** San Mateo has 25 local districted contests on our ballot (council districts in 9 cities, trustee areas in 6 school or college districts, the County Board of Education, Supervisor 5) plus 8 at-large school and special districts whose boundaries don't follow city lines. The county publishes current precincts but **no precinct → local district crosswalk**. The registrar's lookup (`/elections/my-election-info`) does list a precinct's districts, but it needs house number, ZIP and date of birth, so we can't use it at build time.
- **Both registrars publish current precinct polygons.** San Mateo: 1,057 precincts, exported daily (last export 2026-10-07). Santa Clara: 3,011 precincts on the ROV's ArcGIS account (edited 2026-07-09). Precinct IDs only, no district attributes.
- **Precincts never cross a district line.** San Mateo's precinct layer is literally named `PrecinctActiveNoSplit`. California elections code requires this. So a precinct → district table can be built by testing one interior point of each precinct against each district polygon. That tolerates small edge mismatches between city GIS and county precinct lines much better than testing every address against district polygons.
- **Santa Clara's per-precinct sample ballots exist, but we can't fetch them in bulk.** The registrar's voter guide (omniballot `cvig/vg/info?pid=<precinct>`) shows each precinct's ballot type. Its API needs a reCAPTCHA session (`401 Unauthorized` without one), so it can't be scraped at build time. Hand lookups still work as a check.
- **Address points:** San Mateo has a current countywide NENA address-point layer (260,197 points, edited 2026-09-29) but **no ZIP field**. Santa Clara's county address points are stale (last modified 2020-06-16). Mountain View's city layer (edited 2026-04) and Palo Alto's (2023-08) are fresher and include ZIP.
- **The MVLA trustee area map is new and has no public GIS.** The C1 map was adopted 2025-04-21 for the Nov 2026 election. Trustee Area 3 can't be resolved from public data without digitizing the PDF.
- **Most San Mateo council and trustee maps exist only as consultant web maps.** They are embedded feature collections in public ArcGIS web maps made by NDC, or city-hosted layers. Several are drafts or older plans mixed in with the adopted map. Each one has to be matched to the adopted map before use.

## Districted contests on our ballot

From `data/2026-11/ballot.yml` and `data/areas.yml` on `origin/main`, 2026-10-07. "Membership" means the contest is at-large but only covers part of the area, so we need to know whether the address is inside the district.

### All three areas (state and federal)

| Contest | Boundary | Notes |
|---|---|---|
| `us-rep-15`, `us-rep-16` | Congress (Prop 50 map) | SMC: CD 15 and 16. PA/MV: all CD 16 |
| `assembly-19`, `-21`, `-23` | Assembly (2021 map) | SMC: AD 19/21/23. PA/MV: all AD 23 |
| `board-of-equalization-2` | BOE | Both counties are entirely BOE 2 |
| `court-of-appeal-1`, `-6` | County | SMC → 1st, SCC → 6th. No lookup needed |
| `rtm` | Region | All three counties |

### San Mateo County

| Contest | Boundary needed |
|---|---|
| `san-mateo-county-supervisor-5` | Supervisor district (2022 map) |
| `san-mateo-county-board-of-education-2` | SMCOE trustee area |
| `smcccd-trustee-area-2` | SMCCCD trustee area |
| `smcccd-measure-v` | SMCCCD membership (believed to be the whole county) |
| `cabrillo-usd-trustee-area-c`, `cabrillo-usd-measure-z` | Cabrillo USD trustee area + membership |
| `ssfusd-trustee-area-c`, `-e` | SSFUSD trustee areas |
| `smuhsd-trustee-area-3`, `-5` | SMUHSD trustee areas |
| `sequoia-uhsd-trustee-area-a` | Sequoia UHSD trustee areas |
| `pacifica-sd-trustee`, `-short-term`, `pacifica-sd-measure-t` | Pacifica SD membership (not the same as the city) |
| `san-carlos-sd-trustee`, `san-carlos-sd-measure-k` | San Carlos SD membership |
| `burlingame-sd-measure-r` | Burlingame SD membership |
| `jefferson-uhsd-measure-m` | Jefferson UHSD membership |
| `smfcsd-measure-w` | San Mateo-Foster City SD membership |
| `granada-csd-director` | Granada CSD membership |
| Council districts: Foster City 1, 2 · Half Moon Bay 1, 4, 5 · Menlo Park 1, 2, 4 · Millbrae 3, 4 · Pacifica 2, 3, 5 · Redwood City 2 · San Bruno 1, 4 · San Mateo 1, 3, 5 · South San Francisco 1, 3, 5 | City council district |
| City at-large contests and measures (Belmont, Brisbane, Burlingame, Daly City, East Palo Alto, HMB, Menlo Park, Pacifica, Portola Valley, Redwood City, San Bruno, San Carlos, San Mateo) | City limits (incorporated vs unincorporated) |

The SMC candidate roster (9/3) also has contests that aren't in `ballot.yml` (for example Millbrae Council D2, Redwood City D5/D6, Belmont D1/D3, Burlingame D1/D3/D5, Woodside D2/D3, Coastside Fire and Water). They're out of scope until a guide endorses in them, but the same data would resolve them.

### Palo Alto and Mountain View

| Contest | Boundary needed | Evidence from the registrar's sample ballots (`data/2026-11/sources/SCC-Sample-Ballots-PA-MV.txt`) |
|---|---|---|
| `palo-alto-*`, `mountain-view-*` (council, measures) | City limits | All PA types / all MV types |
| `valley-water-7` | Valley Water director district | On every sampled PA and MV ballot type |
| `pausd-trustee` | PAUSD membership | PA type 1 only |
| `mvwsd-trustee` | MVWSD membership | PA types 4, 6; MV types 65, 66, 69 |
| `los-altos-sd-trustee` | LASD membership | PA types 3, 5; MV type 67 |
| `el-camino-healthcare-measure-s` | El Camino Healthcare District membership | PA types 3, 5, 6; MV types 65, 67, 68 (not every type) |
| `mvla-trustee-area-3` | MVLA trustee area (C1 map, 2025) | MV type 65 |
| `fremont-uhsd-trustee-area-3` | FUHSD trustee area | PA type 7 (precinct 0002151) |
| `fremont-uhsd-trustee-area-4` | FUHSD trustee area | MV type 68 (precinct 0003495) |

Palo Alto has 7 ballot types and Mountain View at least 5. School district lines cut across both cities, so a city-level filter isn't enough.

## Sources: San Mateo County

| Data | Source | Format, size | Updated | License | Notes |
|---|---|---|---|---|---|
| **Precincts (current)** | County GIS "Jurisdictional Boundaries" export, layer `ELECTION_PRECINCTS` | GeoJSON zip 3.97 MB (also SHP, FGDB) | Exported daily; Last-Modified 2026-10-07 | Public domain per county open data | 1,057 precincts, field `Precinct_ID` (5 digits, e.g. `10001`). EPSG:2227 (CA State Plane III, US feet). Same file holds `CITY` (55 polygons incl. named unincorporated areas, `UNINCORPORATED` flag) and `COUNTY_BOUNDARY` |
| Precincts (registrar's ArcGIS) | `PrecinctActiveNoSplit_20260810` feature service | FeatureServer, 1,057 features | 2026-09-08 | Not stated | Same precincts as above; used by ACRE's Sep 2026 Precinct Lookup app. Only `PrecinctID` |
| **Address points** | County `Site_Address_Points` (NENA "Master Address Dataset") | FeatureServer, 260,197 points, maxRecordCount 2,000, `lat`/`long` fields | Last edit 2026-09-29 | Not stated on item; OpenAddresses lists SMC GIS as public domain | 35,716 rows have a unit. `inc_muni`, `post_comm` present. **`post_code` (ZIP) is blank on every row**; derive ZIP from `Zip_Code_Areas` |
| Address points (alt) | `gis.smcgov.org/.../Common/SMC_GIS/FeatureServer/0` (`MAD_Address_Pts`) | FeatureServer, 270,322 points | Not stated | Public domain (per OpenAddresses) | The source OpenAddresses uses. Fields `LATITUDE`, `LONGITUDE`, `HOUSE_NUM`, `STREET`, `TYPE`, `UNIT_NUM`, `CITY` |
| Parcels with situs | County "Active Parcels" (Socrata `nr6j-72z7`, or S3 export) | GeoJSON zip 59 MB; 235,348 rows | S3 export daily (2026-10-07); Socrata copy 2024-08 | Public domain | Polygons in EPSG:2227; situs address, city, no ZIP. Fallback only |
| ZIP areas | County `Zip_Code_Areas` | FeatureServer, 33 polygons | 2026-10-03 | Not stated | For ZIP → address and ZIP-only input |
| Supervisor districts (2022) | S3 `Supervisor District Boundaries.zip`; Socrata `vq4k-g35m`; ArcGIS `State_BOS_Feb2022_Modified` | SHP zip 256 KB | 2022-12-23 | Public domain | Measure U (reapportionment) is on this ballot but doesn't change the Nov 2026 lines |
| Congress / Assembly / Senate | ACRE ArcGIS `US_Representative_2025`, `State_Assembly_12_28_2021`, `State_Senate_12_27_2021` | FeatureServer | 2026-04-09 / 2026-03-30 | Not stated | `US_Representative_2025` is the Prop 50 map. SWDB (below) is simpler |
| School district membership | County `Elementary_School_Districts` (20), `High_School_Districts` (7), `Unified_School_Districts` (5) | FeatureServer | 2026-09-28 to 2026-10-06 | Not stated | Names match ours (Burlingame, San Carlos, Pacifica SD, SMFCSD, Jefferson UHSD, Cabrillo USD, SSFUSD, SMUHSD, Sequoia UHSD) |
| Granada CSD | County `Sewer_Districts` (feature "Granada Community Services District") | FeatureServer | Not checked | Not stated | Membership for `granada-csd-director` |
| County Board of Education TAs | SMCOE `SMCOE_Trustee_Area_Boundaries_WFL1` layer 0 | FeatureServer, 7 areas | 2024-04-12 | Not stated | Field `Trustee_Area` ("Trustee Area 2"). Has 2020 population columns, so likely the post-2021 map; confirm |
| San Mateo council districts | City `City_of_San_Mateo_Council_Voting_Districts` | FeatureServer, 5 features, `DISTRICT` | 2025-10-07 | Not stated | Official city layer |
| San Bruno council districts | City `Council_Districts` | FeatureServer, 4 features, `DistrictName` | 2026-08-13 | Not stated | Official city layer (4 districts + elected mayor) |
| Millbrae council districts | City `CityCouncilMap2022` | FeatureServer, 5 features, `DISTRICT` | 2022-07-24 | Not stated | Adopted 2022 map (has deviation columns) |
| Half Moon Bay council districts | `Adopted_Map_503b` (in the city's "Half Moon Bay Election Districts" web map) | FeatureServer, 5 features, `DISTRICT` | Web map 2026-08-24 | Not stated | Official city web map points at it |
| Pacifica council districts | NDC web map `265620ea…`, layer "Pacifica 2022-2030 Council Election Districts" | Embedded feature collection, 5 features | 2022-04-13 | Not stated | Consultant map; not a queryable service |
| South San Francisco council districts | NDC web map `1e9cc35f…` "South San Francisco Redistricting 2022" | Embedded feature collections (drafts 101–104, 102a, "102a REVISED", current) | 2022-03-09 | Not stated | Unclear which layer was adopted |
| Redwood City council districts | NDC web map `328a8ef9…` "Redwood City 2018/2019 Districting", layer "RC Adopted Council Districts Parcel Match" | Embedded, 7 features | 2019-11-21 | Not stated | 2019 map; may have been redrawn after the 2020 Census. Also has Sequoia UHSD and RCSD trustee areas |
| Sequoia UHSD trustee areas | NDC web map `d4ba08bb…`, layer "SUHSD Adopted Trustee Areas" | Embedded, 5 features (`TRUSTEEARE`) | 2018-07-27 | Not stated | 2018 map; may predate 2021–22 redistricting |
| SSFUSD trustee areas | NDC web map `88c4aac5…` "South SF USD 2019 Districting", layer "Adopted Trustee Areas" | Embedded, 9 features | 2020-06-18 | Not stated | 9 polygons for 5 areas (multipart); may predate 2022 redistricting |
| Cabrillo USD trustee areas | NDC web map `d1e06bff…`, layer "Adopted 'Orange' Map" | Embedded, 5 features | 2019-12-17 | Not stated | May predate 2022 redistricting |
| SMUHSD trustee areas | NDC web map `80c1b26e…` "San Mateo Union High District Redistricting 2022" | Embedded drafts 101–104 only; "Draft_102 (Board's preferred map)" | 2022-03-07 | Not stated | No layer labeled adopted |
| Menlo Park council districts | `Adopted_Council_Districts` (GEOinovo) | FeatureServer, **token required** | 2021-07-23 | n/a | Not public. NDC "Menlo Park 2018 Adopted" web map exists (2018). Menlo Park precinct PDF was updated Aug 2026 |
| Foster City council districts | City "Map B2 Live Edits", adopted 2024-12-02 (Redistricting Partners) | PDF on the city site | 2024-12 | n/a | No GIS found. Districts 1 and 2 are first elected in 2026 |
| SMCCCD trustee areas | None found | — | — | — | Not found on ArcGIS Online or county GIS |
| Per-city precinct maps | ACRE "Precinct Maps in PDF" | PDF per city | Aug 2024 – Aug 2026 | — | Visual check only |
| Nov 2022 Statement of Vote | ACRE results page | Not checked | 2022 | — | The council districts and trustee areas up in 2026 were last up in 2022, so per-precinct 2022 results could cross-check a precinct → district table where precinct IDs haven't changed |

## Sources: Santa Clara County (Palo Alto, Mountain View)

| Data | Source | Format, size | Updated | License | Notes |
|---|---|---|---|---|---|
| **Precincts (current, base)** | ROV ArcGIS `Precinct_Boundaries_` (layer `Precinct_Boundaries_ADA`) | FeatureServer, 3,011 features, item size ~11 MB | Edited 2026-07-09 | Not stated | Field `Precinct` ("2001"). The voter guide and SWDB pad to 7 digits ("0002001"). 298 IDs match `2___`, 440 match `3___` |
| Voting precincts (June 2026, consolidated) | ROV `E147_Voting_Precincts` | FeatureServer, 573 features | 2026-04-02 | Not stated | Consolidated precincts for the June 2 primary (E147). Has `City` and `SUM_Active_Voters`. PA + MV = 32. Nov consolidations differ |
| City limits | ROV `Cities_Merge_120525` | FeatureServer, 15 features, `City` | 2026-02-03 | Not stated | Newer than the Planning `City Limits` layer (description dated 2018) |
| **Address points (city)** | Mountain View `Public/SiteAddressPoint/MapServer/0` | MapServer, 42,559 points (15,800 without unit), maxRecordCount 25,000 | Last edit 2026-04-13 | Not stated | Has `ZIP5`, `FULLADDR`, `MUNICIPALITY` |
| **Address points (city)** | Palo Alto `Address_Points_Share/FeatureServer/0` | FeatureServer, 48,307 points | 2023-08-01 | Not stated | Has `SZIP`, `ADDRESS_FULL`, `X`/`Y` |
| Address points (county) | County `opendata/SCCGISHUB/MapServer/8` | MapServer, 504,386 countywide; PA 22,817, MV 21,650 by `JURISDICTION` | **Max `MODIFIEDDATE` 2020-06-16** | County "as is" disclaimer | Stale. Use only to fill gaps (Stanford, unincorporated pockets) |
| Tax Rate Areas | County `SCCGISHUB/MapServer/118` | MapServer, 1,808 polygons | Not stated | County/SBE "as is" | `ELEM_SCHL`, `HIGH_SCHL`, `COMM_COLL`, `JURISD` per TRA. Within PA/MV `JURISD` the elementary districts are PAUSD, MVWSD ("MT VIEW ELEMENTARY"), Los Altos, Cupertino Union, Sunnyvale, Saratoga Union; high schools PAUSD, MVLA, Fremont Union, Los Gatos-Saratoga. **This resolves PAUSD/MVWSD/LASD membership** |
| El Camino Healthcare District | County `SCCGISHUB/MapServer/59` (also Planning `PlanningOfficeDataService2` layer 16) | 1 polygon | Description mentions a 2014 rename | County "as is" | |
| Valley Water director districts | Valley Water `SCVWD_Board_of_Directors_Boundaries` | FeatureServer, 7 features, `DISTRICT` | 2026-02-19; lines from 2022 | Not stated | District 7 is on every sampled PA and MV ballot. Keep as a build check |
| FUHSD trustee areas | ROV `Fremont_Union_High_School_District_TA` | FeatureServer, 5 features, `TA` | 2024-06-26 | Not stated | Registrar's own layer |
| MVLA trustee areas (C1 map) | None | — | Adopted 2025-04-21 | — | Only board PDFs (mvlapub.ic-board.com). Areas 1–3 are Mountain View, 4–5 mostly Los Altos / Los Altos Hills |
| Sample ballot by precinct | ROV voter guide `ca.omniballot.us/sites/06085/site/app/cvig/vg/info?pid=<7-digit precinct>` | Web app | Nov 2026 election live | — | Shows the ballot type for a precinct. API requires a reCAPTCHA session; hand lookups only |

## Sources: statewide and fallbacks

| Data | Source | Format, size | Updated | License | Notes |
|---|---|---|---|---|---|
| **Precinct → CD/AD/SD/BOE** | SWDB P26 `c081_p26_sov_data_by_p26_srprec.csv`, `c085_…` | CSV 253 KB / 521 KB | 2026-09-25 / 2026-08-12 | Not stated (SWDB terms) | Columns `addist`, `cddist`, `sddist`, `bedist` per SR precinct. Last row is a county total; drop it. June 2026 primary, so CD is the Prop 50 map |
| MPREC → SRPREC | SWDB `mprec_srprec_081_p26.csv`, `…_085_…` | CSV | 2026 | — | SMC: 1,058 county precincts → 280 SR precincts (consolidated). SCC uses the 7-digit ID |
| SRPREC → city | SWDB `c081_p26_srprec_to_city.csv`, `c085_…` | CSV 10 KB | 2026-09-25 | — | Has `n_in_city`/`n`, so split precincts show up |
| Precinct polygons | SWDB `mprec_081_p26_v01.geojson.zip` (1.5 MB, 1,058 features), `mprec_085_p26_v01.geojson.zip` (3.9 MB) | GeoJSON (CRS84) | 2026-09-29 / 2026-08-13 | — | Only `PRECINCT`, `COUNTY`. **SWDB has no local districts** (no council, school or special districts) |
| School districts | Census TIGER 2025 `tl_2025_06_unsd/elsd/scsd.zip` | 4.3 / 3.7 / 1.9 MB | 2025-09-22 | Public domain | Membership cross-check only; no trustee areas |
| Places (cities) | TIGER 2025 `tl_2025_06_place.zip` | 9.9 MB | 2025-09-22 | Public domain | Cross-check for city limits |
| Address ranges | TIGER 2025 `ADDRFEAT` `tl_2025_06081_addrfeat.zip` (3.1 MB), `tl_2025_06085_addrfeat.zip` (7.3 MB) | SHP | 2025-09-22 | Public domain | Street-segment ranges with ZIP per side. Interpolated, so a fallback for gaps, not a primary source |
| OpenAddresses | Source definitions `us/ca/san_mateo`, `santa_clara`, `city_of_palo_alto`, `city_of_mountain_view` | Point to the county/city services above | — | SMC marked public domain; others unstated | No better coverage than going to the services directly |

## Recommendation

Use a **precinct table** in both counties, the same shape as SF:

```
address points ── point-in-polygon ──► precinct (registrar's current polygons)
precinct interior point ── point-in-polygon ──► every district layer ──► precinct → {districts}
SWDB P26 (mprec → srprec → cd/ad/sd/be) ──► precinct → state/federal districts (and build check)
```

Precincts don't cross district lines, so testing each precinct's interior point against each district polygon gives an exact precinct → district table. Small edge mismatches between city GIS and county precinct lines don't matter. A build check should flag any precinct whose polygon overlaps a district polygon by between 1% and 99% of its area: either the district layer is out of date or it's the wrong map.

### San Mateo County

- Addresses: `Site_Address_Points` (ZIP from `Zip_Code_Areas`), cross-checked with `MAD_Address_Pts`.
- Precincts and cities: county GIS "Jurisdictional Boundaries" daily export (precincts + city limits + unincorporated areas). Reproject from EPSG:2227.
- State/federal: SWDB P26 crosswalk; ACRE's `US_Representative_2025` as a check.
- Supervisor 5: county 2022 supervisor districts.
- School/special membership: county Elementary/High/Unified school district layers; Granada CSD from `Sewer_Districts`.
- County Board of Education TA 2: SMCOE layer.
- Council districts with an official layer: San Mateo, San Bruno, Millbrae, Half Moon Bay.
- Council districts and trustee areas from consultant web maps (Pacifica, SSF, Redwood City, Sequoia UHSD, SSFUSD, Cabrillo, SMUHSD): usable only after matching each to the adopted map. Check against the city/district's adopted-map PDF, and against Nov 2022 per-precinct results where precinct IDs didn't change.
- **Can't resolve today:** Foster City 1/2 (PDF only), Menlo Park 1/2/4 (token-gated layer; 2018 NDC map may be stale), SMCCCD TA 2 (nothing found), SMUHSD 3/5 (no layer labeled adopted). Until data is found, show these contests to every address in the parent jurisdiction with a "may be on your ballot, check your sample ballot" note. Don't hide them.
- Ask ACRE for a precinct → district list (`data@smcacre.gov`, 650-312-5222). The registrar keeps one: its voter lookup returns "This precinct is in these districts". If they provide it, it replaces all the local polygon work above and is authoritative.

### Palo Alto and Mountain View

- Addresses: city layers (Mountain View 2026-04, Palo Alto 2023-08); county points only for gaps.
- Precincts: ROV `Precinct_Boundaries_ADA` (pad to 7 digits).
- City: ROV `Cities_Merge_120525`.
- PAUSD / MVWSD / LASD: county Tax Rate Areas (`ELEM_SCHL`).
- El Camino Healthcare: county layer 59. Valley Water 7: Valley Water layer (expect every PA/MV precinct in D7; build check).
- FUHSD TA 3/4: ROV FUHSD TA layer, gated by TRA `HIGH_SCHL = FREMONT UNION`.
- **Can't resolve today:** MVLA TA 3 (C1 map, no GIS). Options: digitize the adopted C1 PDF; or, since there are only a few dozen Mountain View precincts, look up each precinct's ballot type by hand in the registrar's voter guide and record MVLA TA per precinct; or show the contest to every Mountain View address in MVLA with the "may be on your ballot" note.
- Check the result against the sampled ballot types: precinct 0002151 must resolve to FUHSD TA 3, precinct 0003495 to FUHSD TA 4, and 0003401 to MVLA TA 3 + MVWSD + El Camino.

### Registrar links ("confirm with the registrar")

- San Mateo: https://smcacre.gov/elections/my-election-info (needs house number, ZIP, birth date; shows precinct and districts). Map without personal data: https://smcacre.gov/elections/precinctlookup
- Santa Clara: the registrar's voter guide https://ca.omniballot.us/sites/06085/site/app/cvig/home (linked from https://vote.santaclaracounty.gov/elections/november-3-2026-general-election)
- Any county: https://voterstatus.sos.ca.gov/

## URLs

- https://www.smcgov.org/tsd/gis-data-download (redirect from `/isd/gis-data-download`)
- https://gis-data-downloads.s3-us-west-1.amazonaws.com/JURISDICTIONAL_BOUNDARIES_GEOJSON.zip
- https://gis-data-downloads.s3.us-west-1.amazonaws.com/Supervisor+District+Boundaries.zip
- https://gis-data-downloads.s3-us-west-1.amazonaws.com/SAN_MATEO_COUNTY_ACTIVE_PARCELS_GEOJSON.zip
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/Site_Address_Points/FeatureServer/0
- https://gis.smcgov.org/maps/rest/services/Common/SMC_GIS/FeatureServer/0
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/PrecinctActiveNoSplit_20260810/FeatureServer/0
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/Election_Precincts/FeatureServer/0
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/Zip_Code_Areas/FeatureServer/0
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/Elementary_School_Districts/FeatureServer/0 (also `High_School_Districts`, `Unified_School_Districts`, `Sewer_Districts`)
- https://services.arcgis.com/yq3FgOI44hYHAFVZ/arcgis/rest/services/US_Representative_2025/FeatureServer/0
- https://services8.arcgis.com/O1R9chPCxI4ORdX1/arcgis/rest/services/SMCOE_Trustee_Area_Boundaries_WFL1/FeatureServer/0
- https://services2.arcgis.com/g26Y0m7OCdjU0ObA/arcgis/rest/services/City_of_San_Mateo_Council_Voting_Districts/FeatureServer/0
- https://services2.arcgis.com/iLsFVn6d1pmqKEfA/arcgis/rest/services/Council_Districts/FeatureServer/0 (San Bruno)
- https://services6.arcgis.com/paH4j1JG3JAZKLhE/arcgis/rest/services/CityCouncilMap2022/FeatureServer/0 (Millbrae)
- https://services.arcgis.com/PmM1Bg9qFLS54qH7/arcgis/rest/services/Adopted_Map_503b/FeatureServer/0 (Half Moon Bay)
- Consultant web maps (data via `https://www.arcgis.com/sharing/rest/content/items/<id>/data?f=json`): Pacifica `265620ea3ea64333b71779843008fe35`, SSF `1e9cc35f2ca94aaba624ccf266410b7a`, Redwood City `328a8ef954a9498ebb87ebf2ce711a1b`, Sequoia UHSD `d4ba08bb966f423cb9519cf1677c9a0c`, SSFUSD `88c4aac516084c71bc4297715c2c882d`, Cabrillo `d1e06bff9bbe4019ae9162576dbe9960`, SMUHSD `80c1b26ec46f4addb7a4901fbab2b2aa`
- https://smcacre.gov/elections/precinct-maps-pdf
- https://smcacre.gov/system/files/2025-10/50_PrecinctConsolidations%20Nov2025.pdf (example consolidation list; no districts)
- https://services2.arcgis.com/nJEmhZphYC5TKA7K/arcgis/rest/services/Precinct_Boundaries_/FeatureServer/0
- https://services2.arcgis.com/nJEmhZphYC5TKA7K/arcgis/rest/services/E147_Voting_Precincts/FeatureServer/0
- https://services2.arcgis.com/nJEmhZphYC5TKA7K/arcgis/rest/services/Cities_Merge_120525/FeatureServer/0
- https://services2.arcgis.com/nJEmhZphYC5TKA7K/arcgis/rest/services/Fremont_Union_High_School_District_TA/FeatureServer/0
- https://maps.santaclaracounty.gov/server/rest/services/opendata/SCCGISHUB/MapServer (layers 8 address points, 48 city limits, 59 healthcare district, 92 water districts, 118 tax rate areas)
- https://services2.arcgis.com/9KdAx8qBsHiGXOEw/arcgis/rest/services/SCVWD_Board_of_Directors_Boundaries/FeatureServer/0
- https://maps.mountainview.gov/arcgis/rest/services/Public/SiteAddressPoint/MapServer/0
- https://services6.arcgis.com/evmyRZRrsopdeog7/ArcGIS/rest/services/Address_Points_Share/FeatureServer/0
- https://statewidedatabase.org/d20/p26_geo_conv.html and https://statewidedatabase.org/pub/data/P26/c081/c081_p26_sov_data_by_p26_srprec.csv (and `c085`)
- https://www2.census.gov/geo/tiger/TIGER2025/ (UNSD, ELSD, SCSD, PLACE, ADDRFEAT)
- https://www.mv-voice.com/education/2025/04/22/mvla-approves-trustee-area-map-for-school-board-elections/
- https://fostercity.org/districtelections

## Gotchas

- **Precinct ID formats differ.** SMC: 5 digits everywhere. SCC: ROV ArcGIS uses 4 digits (`2001`); the voter guide and SWDB use 7 (`0002001`).
- **SWDB SR precincts are consolidations.** In SMC, 1,058 county precincts map to 280 SR precincts. Join through `mprec_srprec_*.csv`, never by assuming the IDs match. The SOV CSV's last row is a county total (e.g. `cddist` = 4260); drop it.
- **Projections:** SMC S3 exports are EPSG:2227 (feet); ArcGIS services return Web Mercator unless you request `outSR=4326`; SWDB GeoJSON is CRS84.
- **SMC address points have no ZIP.** Derive it from `Zip_Code_Areas`. ZIP polygons are approximate, so ZIP-only resolution should use the derived ZIP the same way SF uses the EAS ZIP.
- **SCC county address points are from 2020.** Use the city layers for PA and MV.
- **School districts don't follow city lines.** `ballot.yml` uses `within: { level: city, name: Palo Alto }` for PAUSD and `within: { city: Pacifica }` for Pacifica SD. That's a display hint, not the boundary. PA has 7 ballot types, including precincts in LASD, MVWSD, FUHSD and Saratoga/Los Gatos-Saratoga districts.
- **Stanford and unincorporated pockets** use "Palo Alto" mailing addresses but are outside the city. They must resolve to "not in Palo Alto" (no city contests) while still getting PAUSD etc. The `palo-alto` area page covers the city only; decide what the filter shows them.
- **SMC "San Mateo County" is a county area**, so a resolved address must carry its city (or "unincorporated") as well as its districts. The SF district code has no city slot; the code format needs one for SMC.
- **Consultant web maps mix drafts with the adopted map.** Take the layer whose title says adopted, then confirm it against the adopted PDF. Several are pre-2021 maps that may have been redrawn after the 2020 Census.
- **ArcGIS `maxRecordCount`** is 1,000–2,000 on most of these services. Page with `resultOffset` or use the S3/hub exports.
- **santaclaracounty.gov is behind Cloudflare** and returned 403 to both curl and a headless browser. Registrar pages there couldn't be fetched for this investigation.
- **The SMC Socrata copies are stale** (precincts 2021, parcels 2024). Use the S3 exports or ArcGIS services.

## Unverified

- Licenses for every ArcGIS-hosted layer above (none state one). SMC's own site and OpenAddresses describe county GIS data as public domain; SCC layers carry an "as is" disclaimer only.
- Whether the SMC and SCC precinct layers are final for Nov 3, 2026 (SMC export is current to 2026-10-07; SCC precincts last edited 2026-07-09).
- Whether SMCCCD covers all of San Mateo County (assumed for Measure V).
- Which SSF, SMUHSD, Sequoia UHSD, SSFUSD, Cabrillo and Redwood City consultant layers are the maps in force for 2026, and whether any were redrawn after 2021.
- Whether the SMCOE trustee-area layer (2024) is the current County Board of Education map.
- Whether Menlo Park's 2018 districts are still in force (city precinct PDF updated Aug 2026).
- Whether Santa Clara ROV publishes a downloadable precinct shapefile or district list on its precinct-maps page (blocked by Cloudflare). Search snippets say custom maps can be ordered in electronic format.
- Whether ACRE or the SCC ROV will provide a precinct → district list on request, and at what cost.
- The SMC Nov 2022 Statement of Vote file formats and how many 2022 precinct IDs still exist.
- The exact boundary of the PA precinct on ballot type 2 (Saratoga Union / Los Gatos-Saratoga): voter count unknown, as noted in the sample-ballot source file.
