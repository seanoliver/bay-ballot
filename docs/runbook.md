# Runbook

## Daily refresh (automated, until Nov 3, 2026)

GitHub Actions runs **Daily data refresh** (`.github/workflows/refresh.yml`) every day at 13:00 UTC: 6 am Pacific while daylight time lasts, 5 am after Nov 1.

What a run does:

1. `npm run bb -- refresh --summary summary.md` fetches every guide's pages and compares them with the stored page text in `data/2026-11/pages/<guide>/`. Dates, "3 hours ago", cookie and newsletter banners, counters and duplicate lines are stripped first.
2. A guide is re-extracted only if an added or removed line names a contest, candidate (or alias, or surname), or uses an endorsement word (endorse, recommend, support, oppose, "yes on", "no on", #1, ranked, slate). Anything else is "unchanged" and costs nothing.
3. Re-extracted guides whose picks or quotes changed go through `verify` (a separate model audits them against the pages). Unconfirmed picks are moved to `held:` and not published.
4. At most 20 guides are re-extracted per run; the rest are "deferred" and picked up the next day.
5. `validate` runs, and the summary is written for the pull request.

Then the workflow:

- **Nothing relevant changed:** no PR, no commit. Page-text drift (dates, banners) is discarded; it never counts as a change, so it does not need to be stored.
- **Something changed:** it pushes `data/refresh-<date>-<run>`, opens a PR into `main` with the summary and a cc to Sean, then runs `validate`, `npm test` and `npm run build` itself (PRs opened by the workflow's token don't trigger other workflows).
  - Clean (exit 0) and checks pass: squash-merged automatically; Vercel deploys `main`.
  - Picks held or a result shrank (exit 2), or a check failed: the PR stays open with the `needs-review` label and a comment saying why.
  - Error (exit 1, e.g. a page failed to load): the run is marked failed. If anything else changed, its PR stays open too.

Nothing is ever pushed straight to `main`.

**Run it by hand:** GitHub → Actions → Daily data refresh → Run workflow.

**When a PR is left open:** read the summary in the PR body.

- **HELD** lines name the contest, the pick and the verifier's page evidence. If the pick is right, fix the input (a contest alias in `data/2026-11/ballot.yml`, more `extraSources`), or mark the guide `manual: true` and enter the pick by hand. A hold also clears when a later extraction returns a different pick for that contest. Push the fix to the PR branch and merge.
- **Shrunk** means a guide's picks dropped to under half (usually a page that failed to render). Check the page; re-run locally with `--browser` or `--force` if the drop is real.
- **Check failed:** run `npm run validate` and `npm test` on the branch and fix what they report.

**Cost:** a day with no relevant change costs $0 (no model calls; only page fetches). A re-extracted guide averages about $0.05 to extract (Sonnet 5.5) plus about $0.11 to verify (Opus 5.5) when its data changed, so about $0.16. The longest guides (growsf, spur) cost about $0.30 to extract and $0.50 to verify. The 20-guide budget keeps a run under about $4 typically, and under $10 even if every changed guide were a long one. The PR summary shows each run's estimate.

**Setup it relies on:** the repository secret `BAYBALLOT_ANTHROPIC_API_KEY`, and Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests". The workflow file must be on `main` for the schedule to fire.

### Running it locally

- `npm run bb -- refresh --summary summary.md` does the same as the workflow, minus the PR.
- `npm run bb -- extract <guide...>` re-checks named guides; `--force-extract` extracts even when the pages look unchanged.
- `npm run bb -- verify --all` re-audits every guide without re-extracting; `verify <guide>` does one.
- `npm run bb -- pages --seed` stores today's page text for every guide without extracting, e.g. after adding a guide's `extraSources` by hand.
- Locally the API key comes from `.env.local` (`BAYBALLOT_ANTHROPIC_API_KEY=...`), never from `ANTHROPIC_API_KEY`.
- `npm run bb -- discover` lists guides with no Nov 2026 source yet. Set `source:` for any that have published.

## Manual guides

Guides with `manual: true` are skipped by `extract`. Their picks are hand-entered or hand-corrected, so re-check their pages by hand during the refresh. As of 2026-10-05 these are lwv-ca, d2-dems (slate is an image), uesf and housing-action-coalition (hand-corrected after review). `npm run bb -- check` lists them.

Any hand edit to a guide that is **not** manual (picks, `ranked`, quotes, `hasReasoning`) is overwritten by the next `extract`. Either mark the guide `manual: true`, or fix the input instead: add a contest alias, or add the explanation pages to `extraSources`.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
