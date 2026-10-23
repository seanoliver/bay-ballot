---
name: daily-refresh
description: Use when Sean says "daily refresh", "do the refresh", "merge the refresh PR" or "any open refresh PRs" in bay-ballot, or a data refresh PR (branch data/refresh or data/refresh-local, titled "data: daily refresh" or "data: local refresh") is open, labeled needs-review, or lists HELD picks.
---

# Daily refresh

## Overview

Get every open refresh PR reviewed, fixed and merged. The bot's PR body says what needs a person. `docs/runbook.md` ("Daily refresh" through "Run reports and alerts") says how to fix each kind. Running this skill is Sean's go-ahead to merge each PR once `finalize-pr` comes back clean.

## Steps

1. **List the work.**
   ```bash
   gh pr list --state open --json number,title,headRefName,labels | jq '.[] | select(.headRefName|test("^data/refresh"))'
   gh issue list --state open --search "refresh needs review in:title"
   ```
   Nothing open: say so and stop. Take PRs one at a time, oldest first. `headRefName` is the branch: `data/refresh` (GitHub job) or `data/refresh-local` (the job on Sean's Mac).
2. **Check out the PR branch** from origin: `git fetch origin && git checkout -B <branch> origin/<branch>`. The tree must be clean first.
3. **Read the PR body.** The `**Result:**` line gives the verdict. Collect every line that needs a person: `HELD`, `- <contest>:` (a removed pick), `missing (reported only)`, `kept the published pick`, `unclear-match`, `pinned …, guide now picks`, shrunk, failed, validation errors.
4. **Check each line against the stored page**, never against the summary alone. The pages are in `data/2026-11/pages/<guide>/`. `git diff origin/main...HEAD -- <that dir>` shows what the site changed.

   | Line | What to check | Fix |
   |---|---|---|
   | `HELD … wrong-rank` | Page says "1st choice", "#1" or ranks names | Move the pick into `picks` with `ranked: true`, delete the `held` entry, and add a `pinned` entry (contestId, pick, `ranked`, reason with the review date). The extractor never ranks a one-name pick, so without the pin it is held again next run |
   | Other `HELD` | Does the page support the pick? | Yes: release and pin as above. No: leave it held |
   | Removed pick | Did the page drop it? | Dropped ("No endorsement", name gone): leave it. Page unchanged, or it names a seat the candidate isn't running for: restore the pick and pin it |
   | `missing (reported only)` | Find the name in `data/2026-11/ballot/<county>.yml` | It's the same candidate under a mislabeled seat: put the pick back in `picks` under the contest the ballot file has, and pin it |
   | `kept the published pick`, `name-mismatch`, `unclear-match`, pin conflicts | The matching runbook bullet under "When a PR is left open" | Follow it |
   | `q … removed`, "verifier dropped N quotes", name reorders in unranked picks | One spot check | Usually fine; leave |
   | Shrunk guide, fetch failure | | Out of scope: report it |

   Check every candidate name and contest id against the ballot file before pinning. A contest can have several lines (a `HELD` pick and a removal of the old pick): decide what the page says now and publish that once.
5. **Fix the changelog** for each guide you edited: `data/changelog/<date>-refresh-<guide>.yml` must describe that guide's change against `main`. Drop a change a pin undid. Add an entry when you published something the bot didn't announce: held picks aren't announced, so releasing one always needs an entry. Leave no entry for a pick that stays held. Copy the bot's format: `date`, `type: data`, `guide`, and a `title` that starts with the guide's name.
6. **Validate and push.** `npm run validate` must end with `data OK`. Commit with `data: <what you fixed>` and a body naming each pick and the page text that supports it. Push to the PR branch. The push starts CI; don't dispatch it.
7. **Run `finalize-pr`** on the PR. Keep the bot's run report as the PR body (Sean's decision); record Step 2 as "kept bot report". The merge hook blocks `gh pr merge` until finalize-pr writes its receipt.
8. **Merge** when the `ci` check passes: `gh pr merge <n> --squash`. The `needs-review` label doesn't block a manual merge.
9. **Clean up**: `git checkout main && git pull --ff-only`, delete the local PR branch, then the next PR.

## Output

One table, one row per PR, then one `Your next action:` line.

| PR | Hand fixes | Follow-ups | Result |
|---|---|---|---|
| #277 (data: daily refresh) | YIMBY Berkeley D1 released as ranked pin; Reform CA Marin pick pinned | #278 (the issue finalize-pr filed, or "none") | merged 03:50 |

## Common mistakes

- Merging without the finalize-pr receipt.
- Trusting the bot's removal: check the page diff first.
- Editing a pick by hand without pinning it. The next extract overwrites it.
- Leaving a changelog entry that announces a change a pin undid.
- Dispatching CI after a push that already started it.

## Out of scope

- Running the refresh itself (`bb refresh`, the workflow, the launchd job).
- Shrunk guides, fetch failures and "needs review" issues with nothing to commit: report them; Sean decides.
- Changing pipeline code, extractor or verifier prompts.
- Rewriting the bot's PR body.
- Quote-quality follow-ups: finalize-pr files them.
