# SF ZIP to supervisor district overlap

Investigated 2026-10-13 (Pacific), while teaching the ZIP filter which SF supervisor districts a ZIP reaches (a step toward #44, district maps).

## Context

The ZIP table (`src/data/zips.json`, see `2026-10-12-zip-to-city-data.md`) only knew which counties and cities a ZIP overlaps. SF is one city and one county, so every SF ZIP kept all five supervisor races on the 2026 ballot (Districts 2, 4, 6, 8 and 10) as "may be on your ballot". The Census relationship files have no supervisor districts, so this needs shapes.

## Key findings

- **District source:** DataSF "Supervisor Districts (2022)", dataset `f2zs-jevy`, GeoJSON at https://data.sf.gov/resource/f2zs-jevy.geojson (DataSF moved from data.sfgov.org to data.sf.gov; the old host now redirects). 11 multipolygons, about 8,000 vertices in all, district number in `sup_dist`. These are the lines adopted in April 2022 from 2020 Census blocks, trimmed of water. The dataset is static until the 2030 redistricting; DataSF's "Current Supervisor Districts" sets will switch to new lines on their own.
- **ZIP source:** Census TIGERweb, service `TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer`, layer 11 ("ZIP Code Tabulation Areas" under the "Census 2020" group), queried by `ZCTA5 IN (...)` with `outSR=4326&f=geojson`. Same 2020 ZCTAs as the relationship files. Layers 1, 4 and 7 are the same ZCTAs under other vintage groups. ZCTA shapes include water; the trimmed district map is what limits the measurement to land.
- **Overlap by area:** 30 ZIPs touch SF. Each district's share is its overlap with the ZIP divided by the ZIP's overlap with all districts, so ZIPs that reach SF only in part (94501 Alameda, 94920 Tiburon) are measured on their SF land.
- **Slivers:** ZCTA lines and district lines don't follow exactly the same edges, so most ZIPs have 0.00% to 0.33% overlaps with neighbors. The largest, 94117 with District 7 (0.33%), is a strip about 1 km long and under 90 m wide; whether any address lies in it was not checked. The smallest compact piece is 94117 with District 2 (0.94%, about 31,000 m², two blocks near Lone Mountain). The threshold is 0.5% (`MIN_DISTRICT_SHARE`), between the two.
- **Result:** 13 of the 30 ZIPs reach one district, the rest two to five. 94102 reaches five (2, 3, 5, 6, 8).

## How it works

- `npm run bb -- zips` builds the county and city table as before, then for each entry in `DISTRICT_MAPS` (`src/pipeline/zips.ts`) downloads the district map and the ZCTA shapes of every ZIP in the map's place, runs `districtShares`, and writes `districts: { "county:San Francisco/Supervisor": [...] }` on each ZIP, keeping districts at or above the threshold (`districtsTouched`).
- `shapesById` checks both responses: it fails on an ArcGIS or Socrata `error` key, a feature with no id, or one with no polygon, and merges features that share an id into one multipolygon. The run also fails unless the map has `count` districts (11 for SF).
- The run prints every dropped overlap above 0.1% and fails on a dropped overlap of 0.25% or more that isn't listed in the map's `slivers`, so a person looks at it on a map first. 94117 with District 7 is listed.
- `districtShares` slices each ZIP into at least 2,000 rows of latitude, and no more than 0.00005 degrees (about 5.5 m) apart, so a ZIP a few blocks tall still resolves the threshold. It finds where each row crosses the ZIP's and each district's edges and sums the overlap length per district. Inside is between each pair of crossings (even-odd), which is right for holes and for multipolygons whose parts don't overlap; parts that overlap each other would cancel. Halving the row spacing changed no share by more than 0.2 percentage points, and moving to 2,000 rows per ZIP left the table unchanged. No geometry library is needed; the SF run takes a few seconds.
- `zipFit` (`src/lib/zip.ts`) looks up `districtMapKey(place, seat)` for a district contest filed under one place: "county:San Francisco/Supervisor" for SF supervisors. The level is in the key because a name can be both a city and a county (Alameda). A district the ZIP misses is `off`; one it reaches is `maybe`, even when it is the only one, since ZIP areas and district lines are both approximate near borders. A ZIP with no entry for the map, or an empty one, falls back to the county rule, as does a contest filed under two places.
- `tests/zip.test.ts` checks the committed table: every SF ZIP has supervisor districts, all 11 districts appear, every supervisor race on the ballot is reachable from some ZIP, and two known answers (94123 is District 2 only, 94110 is 8, 9 and 10).

## Gotchas

- Adding another city's council map: add a `DISTRICT_MAPS` entry with `place` set to `{ level: "city", name }` (the council contest's one `within` place), `seat` "City Council", the GeoJSON URL, the district field and the district count, then rerun `npm run bb -- zips`. The map's district ids must match the contests' `district` values. Check the sliver sizes again; a map that is not trimmed of water still works because each share is of the ZIP's land inside the map, but a map drawn with coarse lines may make larger slivers.
- 94501 (Alameda) and 94920 (Tiburon) reach SF County by a little land, which lies in District 6. Their readers see District 6 as maybe; before this change they saw every SF supervisor race as maybe. Where exactly that land is was not checked.
- ZCTAs assign each census block to one ZIP, so an address whose block went to a neighboring ZIP can see its district hidden. Show all is one tap away, as for cities.

## References

- DataSF dataset page: https://data.sf.gov/d/f2zs-jevy
- TIGERweb ZCTA service: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer
- Earlier ZIP table work: `docs/investigations/2026-10-12-zip-to-city-data.md`
