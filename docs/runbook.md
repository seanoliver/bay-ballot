# Runbook

## Daily refresh (automated, until Nov 3, 2026)

GitHub Actions runs **Daily data refresh** (`.github/workflows/refresh.yml`) every day at 13:00 UTC: 6 am Pacific while daylight time lasts, 5 am after Nov 1.

What a run does:

1. `npm run bb -- refresh --summary summary.md` fetches every guide's pages and compares them with the stored page text in `data/2026-11/pages/<guide>/`. Dates, "3 hours ago", cookie and newsletter banners, counters and duplicate lines are stripped first.
2. Lines are compared in order, so a flipped or swapped verdict is seen. A guide is re-extracted only if a changed line:
   - names a contest or candidate (or alias, or surname),
   - starts with a verdict (yes, no, support, oppose, neutral, "No position"),
   - uses an endorsement word (endorse, recommend, support, oppose, "vote for/against", "yes on", "no on", #1, ranked, slate),
   - or is a short label, or says "against", within 3 lines below a contest or candidate line.

   A long line that only moved is ignored unless it names a contest or candidate. Anything else is "unchanged" and costs nothing.
3. Re-extracted guides whose picks or quotes changed go through `verify` (a separate model audits them against the pages). Unconfirmed picks are moved to `held:` and not published.
4. At most 20 guides are re-extracted per run; the rest are "deferred" and picked up the next day.
5. Each guide whose data changed gets one file, `data/changelog/<date>-refresh-<guide>.yml`, committed with the data.
   - The entry compares the guide against `main`. The workflow extracts `data/` from the `main` commit that the run merged into the refresh branch, and passes that directory as `--baseline`.
   - On an open refresh PR, a guide's entry is rewritten whenever that guide's data changes, and a change undone before merge leaves no entry.
   - A file already on `main` is never rewritten. A second run on the same day after a merge writes `<date>-refresh-<guide>--2.yml`, then `--3`. A local `bb refresh` without `--baseline` writes no entries.
   - An entry reads "GrowSF published endorsements for 12 contests" for a first publication. Otherwise it lists the guide's changes, separated by semicolons: two by name, the rest as a count. Held picks aren't announced.
   - To fix an entry's wording, edit the file on `main` after the refresh PR merges. A clean run merges itself, and an edit on an open refresh PR is overwritten the next time that guide changes.
6. `validate` runs, and the summary is written for the pull request.

Then the workflow:

- **Nothing relevant changed:** no commit. Page-text drift (dates, banners) is discarded; it never counts as a change, so it does not need to be stored.
- **Something changed:** it commits to the single branch `data/refresh` and opens one PR into `main` with the summary and a cc to Sean. Pushes made with the workflow's token don't trigger push or pull_request workflows, so a second job, `gate`, starts the full CI workflow (`ci.yml`: validate, tests, type check, build, e2e) on the branch with `workflow_dispatch`, waits up to 25 minutes, and reruns failed CI jobs once if the run finished. That run reports the `ci` check on the PR's head commit, which `main` requires before a merge. Only `gate` can dispatch workflows, and it checks out no code.
  - Clean (exit 0), CI passes, and the PR is not labeled `needs-review`: squash-merged automatically, and Vercel deploys `main`.
  - Picks held or a result shrank (exit 2), CI failed twice, didn't start within 2 minutes or timed out, the PR touches files outside `data/` or its file count doesn't match, or the merge itself failed: the PR stays open with the `needs-review` label and a comment saying why, with the CI run link. A CI flake keeps the label until someone removes it; later clean runs don't merge a labeled PR.
  - The gate reads the PR's labels and changed files seconds before merging, so a label added while CI ran stops the merge. It isn't a lock: a label added in those last seconds can miss it. A renamed file counts as outside `data/` if either its old or new path is. A longer-term option is a read-only refresh job that uploads `data/` as an artifact for a separate job to commit.
  - Error (exit 1, e.g. a page failed to load): the run is marked failed. If anything else changed, its PR stays open with a comment but no `needs-review` label, so a later clean run can still merge it.
  - No net changes against `main`: the PR is closed with a comment.
- **Rollout of the required `ci` check:** the ruleset requires the `ci` check from the GitHub Actions app only, and must not require branches to be up to date before merging (the refresh PR would need another CI run after every main commit). Before turning it on, check for an open `data/refresh` PR. If there is one, run `gh workflow run ci.yml --ref data/refresh` so its head commit has a `ci` check. A refresh PR opened before this change needs the same dispatch before it can be merged by hand.
- **One PR at a time:** while the refresh PR is open, each daily run starts from the `data/refresh` branch rather than `main`. Its stored page text and held picks are the baseline, so nothing is re-extracted twice. New changes are added as another commit, and the PR body is replaced with the latest summary plus a comment. Once a PR is labeled `needs-review` it is never auto-merged, even if a later run is clean; merge it by hand after review. If the PR is closed without merging, the next run deletes the leftover branch and starts again from `main`.
  - Before refreshing, the run merges `main` into the open branch. If that conflicts, the run stops without refreshing, labels the PR `needs-review` and comments "Refresh branch conflicts with main; resolve by hand." Resolve the conflict on `data/refresh` and push; the next run continues.
  - Only this repository's own `data/refresh` PR is continued or merged. A fork's PR from a branch with the same name is ignored, and before merging the run checks that the PR is not from a fork and that its head is the commit it just pushed.

- **Needs a person but nothing to commit:** an issue titled "Data refresh needs review" is opened, or updated if one is open, with the summary and a cc to Sean. Examples: a guide's picks shrank to under half, or a page failed to load. When a later run is clean, the issue is closed automatically. Only an issue opened by the workflow (the `github-actions` app) counts; an issue someone else titles the same way is ignored.
- **Shrunk guides:** the extraction is not written and the guide's page text is not stored. The issue keeps a hash of the guide's pages in a hidden `shrunk-state` comment. While that guide's pages hash the same, later runs report it as "shrunk earlier, pages unchanged since; not re-extracted" and make no model call. Once the page changes, it is re-extracted. To clear one by hand, fix the input, or delete its entry from the hidden comment. If a run crashes before writing its result, the existing hashes are kept.

Nothing is ever pushed straight to `main`.

**Run it by hand:** GitHub → Actions → Daily data refresh → Run workflow.

**When a PR is left open:** read the summary in the PR body.

- **HELD** lines name the contest, the pick and the verifier's page evidence. If the pick is right, fix the input (a contest alias in `data/2026-11/ballot.yml`, more `extraSources`), or mark the guide `manual: true` and enter the pick by hand. A hold also clears when a later extraction returns a different pick for that contest, or when the guide's page changes again and the verifier, which re-checks held picks on every run that extracts the guide, now confirms it. Push the fix to the PR branch and merge.
- **Shrunk** means a guide's picks dropped to under half (usually a page that failed to render). Check the page; re-run locally with `--browser` or `--force` if the drop is real.
- **CI failed:** the PR comment links the CI run. Run `npm run validate` and `npm test` on the branch and fix what they report. If no CI run appeared within 2 minutes, the comment says so; rerun CI with `gh workflow run ci.yml --ref data/refresh`.

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

Guides with `manual: true` are skipped by `extract`. Their picks are hand-entered or hand-corrected, so re-check their pages by hand during the refresh. As of 2026-10-06 these are lwv-ca, d2-dems (slate is an image), uesf, housing-action-coalition (hand-corrected after review), smc-dems (slate is a PNG on its homepage), smc-labor-council (picks are Word documents) and svgop (slate is a JPG card). `npm run bb -- check` lists them.

When you widen a guide's `areas` and run `extract --force-extract`, the model re-extracts every contest, not just the new area's. Review the quote diff for contests outside the new area (`git diff data/2026-11/endorsements/<guide>.yml`): restore any quotes it changed there unless you meant to change them, and add bad new ones to `rejectedQuotes`.

To keep a bad quote out for good, add it to the guide's `rejectedQuotes` (`text` and `reason`) in its endorsement file. Extraction never writes a listed quote back, and `npm run validate` fails if a pick quotes one. The San Mateo audits of 2026-10-06 seeded this list for courage-california, lwv-ssmc, lwv-ncsmc, green-foothills and bay-rising-action.

Any hand edit to a guide that is **not** manual (picks, `ranked`, quotes, `hasReasoning`) is overwritten by the next `extract`. Either mark the guide `manual: true`, or fix the input instead: add a contest alias, or add the explanation pages to `extraSources`.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
- San Mateo County local candidate races are on the ballot only when a guide takes a position on them. When a guide covers a race that isn't there (the Daily Journal publishes one editorial at a time), add the race to `ballot.yml` from the registrar's roster (https://smcacre.gov/system/files/2026-09/52_candidateroster0903.pdf; a redacted text extract is in `data/2026-11/sources/SMC-Candidate-Roster-0903.txt`) and re-extract that guide. Refresh doesn't add races on its own yet.
- palo-alto-forward's page has only one-line taglines and no quotable reasons, so `hasReasoning` is set to false by hand (2026-10-06). A re-extract can set it back; check it after one.
- Santa Clara County contests come from sample ballots, not the registrar site: vote.santaclaracounty.gov and rovservices.sccgov.org block automated browsers. `data/2026-11/sources/SCC-Sample-Ballots-PA-MV.txt` lists the precincts and ballot styles sampled through the County Voter Information Guide (https://ca.omniballot.us/sites/06085/site/app/cvig/vg/info?pid=<precinct>). Omniballot throttles fast lookups, so sample one precinct at a time.
- Not yet published for Palo Alto and Mountain View as of 2026-10-06: Palo Alto Weekly / Palo Alto Online, Mountain View Voice, and Mercury News local picks. LWV Los Altos-Mountain View and the Los Altos Town Crier have no Palo Alto or Mountain View positions yet.
- Not yet published for San Mateo County as of 2026-10-06: The Almanac, Redwood City Pulse, Half Moon Bay Review, Coastsider (site down) and Mercury News local picks. Add them when they publish.
