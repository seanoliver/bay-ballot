# Bay Ballot

Bay Ballot shows every San Francisco voter guide's picks for the November 3, 2026 election side by side, at [bayballot.com](https://bayballot.com).

## Data and counting

- Each guide's picks live in YAML under `data/`. The site reads them at build time and renders static pages.
- An extraction pipeline fetches each guide's published pages, pulls out picks and verbatim quotes with Claude, and archives the source pages.
- Counts include only guides that took a position. A guide that ranks candidates counts toward its #1.

## Development

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
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

No license yet.
