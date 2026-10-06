# Peninsula expansion design

**Goal:** add San Mateo County, Palo Alto and Mountain View to Bay Ballot, and turn the site from one SF list into a Bay Area list with a page per area.

**Status:** approved 2026-10-06.

## Decisions

| Decision | Choice |
|---|---|
| First expansion | All of San Mateo County, plus Palo Alto and Mountain View (Santa Clara County) |
| Site structure | Both: a combined Bay Area list as the home page, and a page per area |
| Home page | `/2026-11` leads with the combined Bay Area list |

## Routes

```
/2026-11                 Bay Area list: every contest, grouped State → County → City; area picker and address box narrow it
/2026-11/sf              San Francisco: state + SF contests, SF guides only
/2026-11/san-mateo       San Mateo County: state + county + its cities' contests, San Mateo guides only
/2026-11/palo-alto       Palo Alto: state + Santa Clara County + Palo Alto contests
/2026-11/mountain-view   Mountain View: state + Santa Clara County + Mountain View contests
/2026-11/<contest>       one page per contest (unchanged)
/guides/<id>             one page per guide (unchanged)
```

Area slugs and contest ids share the `/2026-11/<slug>` space; the build fails if one collides with the other.

## Areas

An area is a named set of jurisdictions: `sf` = {state, county:San Francisco, city:San Francisco}; `palo-alto` = {state, county:Santa Clara, city:Palo Alto}; `san-mateo` = {state, county:San Mateo, every city in San Mateo County}. Areas live in `data/areas.yml` with their name, kind (city or county), and jurisdictions. A contest belongs to an area when its jurisdiction is one of the area's jurisdictions (districted contests count by their county or city).

## Guides

Each guide lists the areas it covers (`areas: [sf]`; SPUR might be `[sf, san-mateo]`). A guide's picks count on an area page only if the guide covers that area. The Bay Area list counts every guide.

## Counting

- Area page: only that area's guides. "Prop 1: 18 of 22 SF guides say Yes" stays true on `/sf`.
- Bay Area list: every guide, so statewide props show the region's split.
- Contest pages: every guide that took a position on that contest (local contests only have local guides anyway).
- The address filter narrows to one ballot and uses the counting of the area the address is in.

## Contest ids

Existing SF ids stay (`prop-b`, `supervisor-8`) so current links keep working. New local contests get area-prefixed ids (`san-mateo-county-measure-l`, `menlo-park-measure-p`, `palo-alto-council`). Statewide contests are shared by every area.

## Search

Area pages get their own titles and answer sentences ("San Mateo County endorsements (Nov 2026)"; "12 of 15 San Mateo County voter guides recommend Yes on Prop 1"). Contest page titles name their area. The sitemap lists the area pages.

## Existing links

`/2026-11` showed the SF list; it now shows the Bay Area list. A visitor with saved SF districts (address filter) or an SF-only filter state lands on `/2026-11/sf`. Share images and the changelog note the change.

## Data

- `data/2026-11/ballot.yml` gains the San Mateo County, Santa Clara County (as seen by Palo Alto and Mountain View voters), and city contests, built from each registrar's qualified candidate and measure lists.
- New guides in `data/guides/`, found by a focused discovery pass for San Mateo County, Palo Alto and Mountain View (local papers such as the San Mateo Daily Journal, Palo Alto Online, the Mountain View Voice and the Palo Alto Daily Post; parties; labor councils; clubs; advocacy groups), extracted and verified with the existing pipeline.
- The address filter's per-county index (separate plan) adds San Mateo County and Santa Clara County address data later.

## Rollout

1. Areas and routes with SF only: `/2026-11/sf` exists, the home page is the Bay Area list (identical content while SF is the only area). Ship.
2. San Mateo County data and guides. Ship.
3. Palo Alto and Mountain View. Ship.

Each step adds a changelog entry.

## Testing

- Unit: area membership, per-area counting, collision check, area-aware titles and sentences.
- Data: every contest belongs to at least one area; every guide's areas exist; every pick's contest is in one of the guide's areas.
- E2E: Bay Area list shows all areas' contests grouped by place; each area page shows only its contests and counts only its guides; the area picker navigates; old `/2026-11/prop-b` links still work.
