# Runbook

## Daily refresh (until Nov 3, 2026)

1. `npm run bb -- discover`: lists guides with no Nov 2026 source yet. Set `source:` for any that have published.
2. `npm run bb -- extract --all --archive`: rewrites picks from each guide's pages and snapshots them, then runs `verify` on every guide whose picks or quotes changed. Guides marked `manual: true` are skipped. Re-run failures with `--browser`.
3. If the run exits non-zero, some picks are **held**: the verifier (a separate model that audits the extraction against the pages) did not confirm them. Held picks sit under `held:` in the endorsement file with the reason and page evidence, and are not published. Read the evidence; if the pick is right, fix the input (an alias, `extraSources`) or mark the guide `manual: true`. A hold clears when extraction returns a different pick for that contest. This is the only step that needs Sean.
4. `npm run validate`: must print `data OK`.
5. Skim `git diff data/` for `PICK DROPPED` notes. A dropped pick usually means a new spelling; add it to that contest's `aliases` in `data/2026-11/ballot.yml`.
6. Commit the data.

`npm run bb -- verify --all` re-audits every guide without re-extracting; `verify <guide>` does one.

## Manual guides

Guides with `manual: true` are skipped by `extract`. Their picks are hand-entered or hand-corrected, so re-check their pages by hand during the refresh. As of 2026-10-05 these are lwv-ca, d2-dems (slate is an image), uesf and housing-action-coalition (hand-corrected after review). `npm run bb -- check` lists them.

Any hand edit to a guide that is **not** manual (picks, `ranked`, quotes, `hasReasoning`) is overwritten by the next `extract`. Either mark the guide `manual: true`, or fix the input instead: add a contest alias, or add the explanation pages to `extraSources`.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
