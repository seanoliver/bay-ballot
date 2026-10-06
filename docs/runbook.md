# Runbook

## Daily refresh (until Nov 3, 2026)

1. `npm run bb -- discover`: lists guides with no Nov 2026 source yet. Set `source:` for any that have published.
2. `npm run bb -- extract --all --archive`: rewrites picks from each guide's pages and snapshots them. Guides marked `manual: true` are skipped. Re-run failures with `--browser`.
3. `npm run validate`: must print `data OK`.
4. Review `git diff data/`: read every `PICK DROPPED` and model note. A dropped pick usually means a new spelling; add it to that contest's `aliases` in `data/2026-11/ballot.yml`.
5. Commit the data once reviewed.

## Manual guides

Guides with `manual: true` are skipped by `extract`. Their picks are hand-entered or hand-corrected, so re-check their pages by hand during the refresh. As of 2026-10-05 these are lwv-ca, d2-dems (slate is an image), uesf and housing-action-coalition (hand-corrected after review). `npm run bb -- check` lists them.

Any hand edit to a guide that is **not** manual (picks, `ranked`, quotes, `hasReasoning`) is overwritten by the next `extract`. Either mark the guide `manual: true`, or fix the input instead: add a contest alias, or add the explanation pages to `extraSources`.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
