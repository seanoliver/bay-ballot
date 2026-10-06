# Contributing

Corrections and pull requests are welcome. Most fixes are a one-line change to a YAML file.

## Data layout

- `data/guides/<guide>.yml`: one file per voter guide (name, type, and homepage).
- `data/2026-11/ballot.yml`: the contests on the ballot, with candidate names and aliases.
- `data/2026-11/endorsements/<guide>.yml`: one guide's picks for the election, keyed by contest id.

A pick looks like this:

```yaml
picks:
  prop-b:
    pick: N
    quotes:
      - text: "Exact sentence from the guide."
        source: https://example.org/voter-guide
  supervisor-10:
    pick: [Dionjay (DJ) Brookter, J.R. Eppler]
    ranked: true
    rankedCount: 1
```

- `pick` is `Y` or `N` for a measure, or a list of names for a candidate race. Names must match `ballot.yml`.
- `ranked: true` means the list is in ranked order. `rankedCount` marks how many of the names are ranked.
- Quotes are copied word for word from the page in `source`.

## Fixing a pick or quote

1. Edit the guide's file in `data/2026-11/endorsements/`.
2. Most files are rewritten by the extraction pipeline. If you hand-edit picks, add `manual: true` to the file so the next run skips it.
3. Run `npm run validate`. It must print `data OK`.
4. Run `npm test`.
5. Open a pull request with a link to the guide's page.

You can also report a mistake with the [data correction form](https://github.com/seanoliver/bay-ballot/issues/new?template=data-correction.yml) or at corrections@bayballot.com.
