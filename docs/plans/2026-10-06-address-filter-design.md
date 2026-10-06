# Address filter design

**Goal:** a visitor enters an address or ZIP and sees only the contests on their ballot. The address never leaves their browser.

**Status:** approved 2026-10-06.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the lookup runs | In the browser, from a prebuilt index | Private, exact for every real address, instant after one small fetch, no third-party service or rate limit |
| Other districts' contests | Hidden, with a count and "Show all" | Shortest list; obvious how to get the rest back |
| What is remembered | The resulting districts only, as a short code in the URL and on the device | Refresh and shared links keep the ballot; the address is never stored |
| Ambiguous ZIP | Ask for the street address | 20 of SF's 27 ZIPs span more than one Supervisor district |

## Which contests depend on location

11 of 52 contests are districted: Congress 11/15, Assembly 17/19, Supervisor 2/4/6/8/10 (odd districts have no race this year), BART 8 (SF also spans BART 7 and 9, which have no race), Board of Equalization 2 (all of SF). The rest are citywide or statewide.

A contest is on a visitor's ballot when its `jurisdiction` is state, county, city, or a district whose number matches the visitor's district of that kind.

## Data

Sources (verified 2026-10-06; details in `docs/investigations/2026-10-06-sf-address-district-data.md`):

- **Addresses:** DataSF Enterprise Addressing System base addresses (`3mea-di5p`), about 224,000, with coordinates and ZIP. Public domain, updated nightly.
- **Precincts:** DataSF "Election Precincts - Current, Defined 2022" (`d6x4-hefw`), 514 precincts, each with Supervisor, Assembly, Congress, BART and BOE districts.
- **Congress:** the Prop 50 map (2025). For SF it matches the precinct file's districts (CD 11 and CD 15); the build checks this.

Build (`npm run bb -- districts`, run when sources change, output committed):

```
addresses ──┐
            ├─ point-in-polygon at build time
precincts ──┘
   │
   ├─ public/districts/<county>/precincts.json   precinct → {supervisor, assembly, congress, bart, boe}
   ├─ public/districts/<county>/streets/<slug>.json   house-number ranges → precinct
   ├─ public/districts/<county>/streets.json   street names for autocomplete
   └─ public/districts/<county>/zips.json   ZIP → precincts
```

Runs of house numbers on a street that fall in the same precinct collapse into one range. Units are ignored; a building has one location.

Build checks (tests fail on any mismatch):

- Each address's Supervisor district from the precinct join equals the Supervisor district in the address file itself.
- Every precinct maps to districts that exist; districted contests on the ballot are all reachable.
- Congress from the precinct file matches the Prop 50 map for every precinct.

## Lookup in the browser

1. Input is a ZIP (5 digits): load `zips.json`. One district set → done. Several → ask for the street address.
2. Input is an address: parse the house number and street; autocomplete street names from `streets.json`; load that street's file; find the range containing the number → precinct → districts.
3. No match → "We couldn't find that address" with a link to SF Elections' voter lookup.

The result is stored as a district code, for example `?d=sf.s8.a17.c11.b8`, and in localStorage. The address is never written to the URL, storage, or analytics.

## UI

- Desktop: "Your ballot" box at the top of the filter column. Phone: full-width box above the Filters button.
- States: empty, ZIP resolved, ZIP ambiguous (asks for street with autocomplete), resolved summary ("Supervisor 8 · Assembly 17 · Congress 11 · BART 8 · Change"), not found.
- Resolved: list header "41 contests on your ballot · 11 others hidden · Show all".
- "Change" reopens an empty box.
- A link to SF Elections' official lookup to confirm. The result is the visitor's districts, not their personal sample ballot.

## Privacy requirements

- Analytics scrubbing switches from a denylist to an allowlist: every query parameter except the known filter ones is dropped before an event is sent.
- Referrer policy `strict-origin-when-cross-origin` or stricter, so a URL is never sent to another site in full.
- The About page's privacy note states that addresses stay in the browser.

## Generalizing to other counties

Each county supplies an address list and a precinct file with a district crosswalk. Output goes under `public/districts/<county>/` in the same format, and the district code carries the county prefix.

## Testing

- Unit: address parsing (numbers with suffixes like 123A, street types, ordinals like 3rd/Third), range lookup, ZIP resolution, contest filtering by district code, code encoding and decoding.
- Build: the checks above, plus file-size limits per street file.
- E2E: unambiguous ZIP filters; ambiguous ZIP asks for the street; a known address resolves to known districts; "Show all" and "Change"; reload keeps the districts; the URL never contains the address.
