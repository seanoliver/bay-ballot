# Runbook

## Daily refresh (until Nov 3, 2026)

1. `npm run bb -- discover`: lists guides with no Nov 2026 source yet. Set `source:` for any that have published.
2. `npm run bb -- extract --all --archive`: rewrites picks from each guide's pages and snapshots them. Guides marked `manual: true` are skipped. Re-run failures with `--browser`.
3. `npm run validate`: must print `data OK`.
4. Review `git diff data/`: read every `PICK DROPPED` and model note. A dropped pick usually means a new spelling; add it to that contest's `aliases` in `data/2026-11/ballot.yml`.
5. Commit the data once reviewed.

Hand edits to picks or `hasReasoning` are overwritten by the next extract unless the guide is `manual: true`. Re-apply them, or mark the guide manual.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
