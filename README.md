# Bay Ballot

[![CI](https://github.com/seanoliver/bay-ballot/actions/workflows/ci.yml/badge.svg)](https://github.com/seanoliver/bay-ballot/actions/workflows/ci.yml)
[![Daily data refresh](https://github.com/seanoliver/bay-ballot/actions/workflows/refresh.yml/badge.svg)](https://github.com/seanoliver/bay-ballot/actions/workflows/refresh.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fseanoliver%2Fbay-ballot%2Fbadges%2Fcoverage.json)](https://github.com/seanoliver/bay-ballot/actions/workflows/ci.yml)
[![Data updated](https://img.shields.io/github/last-commit/seanoliver/bay-ballot/main?path=data&label=data%20updated)](https://github.com/seanoliver/bay-ballot/commits/main/data)
[![Voter guides](https://img.shields.io/endpoint?url=https%3A%2F%2Fbayballot.com%2Fbadges%2Fguides)](https://bayballot.com)
[![Counties](https://img.shields.io/endpoint?url=https%3A%2F%2Fbayballot.com%2Fbadges%2Fcounties)](https://bayballot.com)
[![Election](https://img.shields.io/badge/election-Nov%203%2C%202026-blue)](https://bayballot.com)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fbayballot.com&label=bayballot.com)](https://bayballot.com)
[![License: MIT](https://img.shields.io/badge/code-MIT-green)](LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-green)](data/LICENSE.md)

Bay Ballot shows every Bay Area voter guide's endorsements (San Francisco, San Mateo County, Santa Clara County (including San Jose, Palo Alto and Mountain View), Alameda County (including Oakland and Berkeley), Contra Costa County, Marin County, Sonoma County, Napa County and Solano County so far) for the November 3, 2026 election side by side, at [bayballot.com](https://bayballot.com). Each area also has a short link, like [bayballot.com/marin](https://bayballot.com/marin), that goes to its page for the current election.

## Data and counting

- Each guide's picks live in YAML under `data/`. The site reads them at build time and renders static pages.
- An extraction pipeline fetches each guide's published pages, pulls out picks and verbatim quotes with Claude, and archives the source pages.
- Counts include only guides that took a position. A guide that ranks candidates counts toward its #1.

## Development

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run coverage   # unit tests with a coverage summary
npm run validate   # checks every data file against the schema and the ballot
npm run build
```

## Data pipeline

The pipeline needs `BAYBALLOT_ANTHROPIC_API_KEY` in `.env.local`.

```sh
npm run bb -- discover                    # guides with no source for this election yet
npm run bb -- extract <guide...>          # rewrite one or more guides' picks from their pages
npm run bb -- extract --all --archive     # every guide, with web.archive.org snapshots
npm run bb -- check                       # validate data, list manual guides and guides with no source
npm run bb -- review                      # open a review page of all picks and quotes
```

Add `--browser` to `extract` for pages that need JavaScript. `docs/runbook.md` has the refresh routine.

## Corrections

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code is under the [MIT License](LICENSE). Data in `data/` is under [CC BY 4.0](data/LICENSE.md), except the guides' quotes and archived pages, which belong to each guide.
