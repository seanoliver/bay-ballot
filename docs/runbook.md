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
  - Anything that needs a person, whatever the exit code: a held pick, an `unclear-match` hold the guide now picks differently, a shrunk result, a removed pick, or a pick the verifier found on the page but not in the picks (`review` in `result.json`). Also CI failed twice, didn't start within 2 minutes or timed out, the PR touches files outside `data/` or its file count doesn't match, or the merge itself failed: the PR stays open with the `needs-review` label and a comment saying why, with the CI run link. For anything in `review`, the refresh job also adds the label as soon as it opens or updates the PR, so the label holds even if `gate` never runs. A CI flake keeps the label until someone removes it; later clean runs don't merge a labeled PR.
  - The gate reads the PR's labels and changed files seconds before merging, so a label added while CI ran stops the merge. It isn't a lock: a label added in those last seconds can miss it. A renamed file counts as outside `data/` if either its old or new path is. A longer-term option is a read-only refresh job that uploads `data/` as an artifact for a separate job to commit.
  - Error (exit 1, e.g. a page failed to load) with nothing to review: the run is marked failed. If anything else changed, its PR stays open with a comment but no `needs-review` label, so a later clean run can still merge it.
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

- **HELD** lines name the contest, the pick and the verifier's page evidence. If the pick is right, fix the input (a contest alias in `data/2026-11/ballot.yml` or `data/2026-11/ballot/<county>.yml`, more `extraSources`), or mark the guide `manual: true` and enter the pick by hand. A hold (except `unclear-match`) also clears when a later extraction returns a different pick for that contest, or when the guide's page changes again and the verifier, which re-checks held picks on every run that extracts the guide, now confirms it. Push the fix to the PR branch and merge.
- **Quotes that need prior context:** a quote whose subject is "he", "she" or "they" is fine under a pick that names one candidate or one measure, since the pick names them. Reject it into `rejectedQuotes` when the subject is still unclear (the source discusses several candidates in turn), when "this" or "it" points back to an earlier passage, or when it opens with a connector such as "However" (decided 2026-10-10).
- **Holding a pick by hand:** when the guide's text may not mean this contest (a blanket rule whose reach is unclear, a write-up about a different measure, a name that doesn't match the ballot), add it under `held:` with `reason: unclear-match` and the evidence. No extract or verifier run releases it. If an extract returns a different pick for that contest, or none, the refresh keeps the hold, exits 2, and names it in `review` ("unclear-match hold on …"), which labels the PR. Only the run that re-extracts the guide flags it: later runs see the page unchanged, so act on the label before merging. Set the hold's `pick` to the guide's new pick to keep holding it, release it by moving the pick into `picks` and deleting the `held` entry (validation rejects a contest that is both), or delete a hold the guide no longer picks.
- **Shrunk** means a guide's picks dropped to under half (usually a page that failed to render). Check the page; re-run locally with `--browser` or `--force` if the drop is real.
- **CI failed:** the PR comment links the CI run. Run `npm run validate` and `npm test` on the branch and fix what they report. If no CI run appeared within 2 minutes, the comment says so; rerun CI with `gh workflow run ci.yml --ref data/refresh`.

**Cost:** model calls run on Sean's Claude subscription, so a normal run costs no API money; the PR summary counts the calls ("$0.00 API, plus 12 calls on the Claude subscription"). A day with no relevant change makes no model calls. Past the subscription's usage limit, the rest of the run uses the API at about $0.16 per re-extracted guide ($0.80 for the longest, growsf and spur), and the run opens a "Refresh used the API" issue.

**Setup it relies on:** the repository secrets `CLAUDE_CODE_OAUTH_TOKEN` (model calls on Sean's subscription; see "Model calls") and `BAYBALLOT_ANTHROPIC_API_KEY` (used only past the subscription's usage limit), optionally `BAYBALLOT_NTFY_TOPIC` (phone pushes; see "Run reports and alerts"), and Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests". The workflow file must be on `main` for the schedule to fire.

### When a guide fails to fetch on the runner

GitHub's runners use data-center addresses, and some sites put those behind a bot wall. A 403, 429 or 503, or a recognized bot-wall page (Cloudflare "Just a moment...", the Chronicle's "Client Challenge", and others), is retried in headless Chromium. A page still blocked after that fails the guide: nothing is extracted or stored, and the run's review issue lists it.

- `npm run bb -- fetch-check <guide...>` shows what each attempt got (status, bytes, which wall), writing nothing. Run it locally, and on a runner if needed, to compare.
- As of 2026-10-07, these are blocked on the runners even in the browser: cadc, d11-dems, league-pissed-off-voters and milk-club (NationBuilder sites behind a Cloudflare challenge), and sf-chronicle (client challenge). sf-green-party gets through via the browser retry.
- eqca (since 2026-10-08) is blocked differently: the runner gets a normal-looking page with no endorsements, so no wall is recognized and extraction returns 0 picks. The shrink guard catches it ("0 picks (previous 50)"). Treat an unexplained shrink on the runner as a possible wall and compare with a local `fetch-check`.
- Those guides are marked `fetchFrom: local` in their endorsement files. The GitHub job skips them and lists them as "local only" (not a failure); the local job below refreshes them. `npm run bb -- extract <guide>` still works on them from a laptop.

### Local refresh on Sean's Mac

A launchd job runs the local refresh every day at 07:00 local time. It refreshes only the `fetchFrom: local` guides, from a home connection the sites don't block. It never merges anything: it opens or updates a PR and notifies Sean, who merges it.

- **Where it runs:** its own worktree at `~/code/projects/bay-ballot-refresh`, created on first run and reset each run.
  - It first checks that the worktree is a linked worktree of this repository (not the source checkout itself), is its own top-level checkout, has no branch checked out, and has no changes outside `data/`. If a check fails (or `git status` itself fails), it stops with an error and touches nothing.
  - If the open refresh PR's branch changes anything outside `data/`, it runs none of that branch's code: it labels the PR `needs-review`, comments, and stops.
  - No other checkout is touched.
- **What it runs:** `bb refresh --local-only` with main's data as the changelog baseline. It is the same pipeline as the cloud job: page gate, extract, verify, shrink guard, summary and exit codes.
  - Each run recreates the worktree's `.env.local` with only `BAYBALLOT_ANTHROPIC_API_KEY` from `~/code/projects/bay-ballot/.env.local`, readable only by Sean's user. The key is never printed.
  - Shrunk-guide hashes are kept in `~/Library/Application Support/bay-ballot/shrunk-state.json`.
- **Nothing changed:** no commit, no PR.
- **Any clean run** (exit 0, installed copy up to date) closes a "Local refresh needs review" issue left open by an earlier failure.
- **Failed with nothing to commit:** it opens or updates the "Local refresh needs review" issue with a cc to Sean, and shows a notification.
- **Something changed:**
  - It commits to `data/refresh-local`, pushes only that branch, and opens or updates one PR with the summary and a cc to Sean.
  - It labels the PR `needs-review` if the refresh exited non-zero or the PR changes anything outside `data/`.
  - It shows a notification: "Bay Ballot: local refresh PR #N ready — <result>".
  - While that PR is open, later runs continue from its branch with `main` merged in.
- **Merging:** when the PR's `ci` check is green and the summary looks right, run `gh pr merge <N> --squash --delete-branch`, or use the GitHub button.
- **Installed copy out of date:** if the script the job runs differs from `scripts/local-refresh.sh` on main, the PR body and the notification say so. Re-run `npm run local-refresh:install`.
- **Exit codes:** 0 clean, 2 needs review, 1 error; any other code from the refresh is passed through.
- **Safety limits:**
  - A lock in `~/Library/Application Support/bay-ballot/lock` stops overlapping runs. It is taken over if its process is gone or it is more than 3 hours old.
  - A watchdog stops a run after 2 hours.
  - `git fetch` is retried 3 times, 30 seconds apart, and SSH never prompts.
- **By hand:** `npm run local-refresh` (or `scripts/local-refresh.sh`).
  - Model calls go through the Claude subscription (see "Model calls"). When a run used the API because the usage limit was reached, it sends a macOS notification with the amount. `BAYBALLOT_MODEL_VIA=api` puts every call on the API; for the launchd job, set it in the shell that runs `npm run local-refresh:install`, which records it (and `BAYBALLOT_CLAUDE_CONFIG_DIR` and `CLAUDE_BIN` if set) in the job.
  - `--dry-run` fetches and gates pages only: no model calls, no commit, no PR, no issue.
  - `--ref <branch>` tests another branch's code and is always a dry run.
- **Logs:** `~/Library/Logs/bay-ballot-refresh.log`, trimmed to the last 2,500 lines once it passes 5,000.
- **Install / uninstall:**
  - `npm run local-refresh:install` copies the script to `~/Library/Application Support/bay-ballot/` and loads `com.bayballot.local-refresh` into launchd.
    - It records in the job where this shell finds `node`, `npm`, `npx`, `gh`, `git` and `pdftotext`, because launchd starts with a bare PATH. It fails if any is missing.
    - Re-run it after the script changes.
  - `npm run local-refresh:uninstall` removes it; the log and the worktree stay.
  - `launchctl kickstart gui/$(id -u)/com.bayballot.local-refresh` runs it immediately.
- **Mac asleep at 07:00:** launchd runs a missed calendar job when the Mac next wakes (one run, however many days were missed). If the Mac is off, nothing runs until the next 07:00 after it is back on.

### Running it locally

- `npm run bb -- refresh --summary summary.md` does the same as the workflow, minus the PR.
- `npm run bb -- extract <guide...>` re-checks named guides; `--force-extract` extracts even when the pages look unchanged. `--only-areas <area>` extracts only the contests a widened guide's new area adds (see Manual guides).
- `npm run bb -- verify --all` re-audits every guide without re-extracting; `verify <guide>` does one.
- `npm run bb -- pages --seed` stores today's page text for every guide without extracting, e.g. after adding a guide's `extraSources` by hand.
- Locally the API key comes from `.env.local` (`BAYBALLOT_ANTHROPIC_API_KEY=...`), never from `ANTHROPIC_API_KEY`.
- `npm run bb -- discover` lists guides with no Nov 2026 source yet. Set `source:` for any that have published.

### Model calls

- `extract`, `refresh` and `verify` run each model call through Claude Code headless (`claude -p`) on Sean's personal subscription, locally and in the GitHub job. `--via api` (or `BAYBALLOT_MODEL_VIA=api`) puts every call on the API instead.
  - Only the model call moves. Prompts, schemas, models (extract on Sonnet, verify on Opus), quote checks and the verifier are unchanged.
  - It runs `CLAUDE_BIN`, else `~/.local/bin/claude`, else `claude` on PATH, never through the shell, so the `claude` alias for the work account doesn't apply. It uses the login in `~/.claude-personal` (override with `BAYBALLOT_CLAUDE_CONFIG_DIR`), and strips every `ANTHROPIC_*`, `CLAUDE_CODE_*` and `BAYBALLOT_*` variable from the CLI's environment, so it can bill only that login. Check the login with `CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/bin/claude auth status`.
  - **GitHub job:** the runner has no login. It installs Claude Code 2.1.296 and authenticates with the `CLAUDE_CODE_OAUTH_TOKEN` secret, passed to the CLI as `BAYBALLOT_CLAUDE_CODE_OAUTH_TOKEN`. Create the token with `CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/bin/claude setup-token` and store it with `gh secret set CLAUDE_CODE_OAUTH_TOKEN`. It lasts a year; when it expires, every guide fails with "claude-code not logged in" and the review issue opens.
  - **Usage limit:** once the subscription's limit is reached, the rest of the run uses the API key (`.env.local` locally, the `BAYBALLOT_ANTHROPIC_API_KEY` secret in CI) and logs one line starting `claude-code usage limit reached`. `result.json` records the spend as `apiCost`. The GitHub job then opens or comments on a "Refresh used the API" issue that mentions Sean; the local job sends a notification. `--no-fallback` fails the guide instead.
  - **Usage limit, exactly:** a `rate_limit_event` with `status: "rejected"` and `isUsingOverage` false on a call that failed. A call served on extra usage reports `rejected` with `isUsingOverage: true` and succeeds; it is kept. `result.json` also records `apiFallbackCalls`, which counts API calls whose guide then failed, so the alert fires on either number.
  - **Any other failure** (CLI missing, not logged in, a 10-minute timeout, output that fails the schema twice, a throttle or billing error) fails that guide's call and never uses the API.
  - **launchd job:** it switches to the subscription when this lands, because `bb` now defaults to it. Check once that a background job can read the personal login: `launchctl kickstart gui/$(id -u)/com.bayballot.local-refresh`, then look for "claude-code not logged in" in the log.
  - Picks match the API path. Quotes vary more between runs, and on some guides it keeps about a quarter fewer per pick (spur: 35 to 46 against 55); see the investigation.
  - The cost line counts these calls instead of pricing them: "Estimated model cost $0.40 API, plus 6 calls on the Claude subscription".
  - Background: `docs/investigations/2026-10-10-claude-code-provider.md`.

### Run reports and alerts

After every refresh, the GitHub job and the local job send a phone push through [ntfy](https://ntfy.sh) and add one line to the run history. Neither can fail a run.

- **Set up:**
  1. Make a topic name that can't be guessed: `openssl rand -hex 16`, for example `bayballot-3f9c...`.
  2. Store it for the GitHub job: `gh secret set BAYBALLOT_NTFY_TOPIC`.
  3. For the local job, export `BAYBALLOT_NTFY_TOPIC` in the shell, then run `npm run local-refresh:install`, which records it in the launchd job.
  4. Install the ntfy app on the phone and subscribe to the topic on ntfy.sh.
- **Anyone who knows the topic name can read the pushes and post to it.** ntfy.sh topics are public; the name is the only password. Keep it out of the repository and logs, and pick a new one if it leaks. `BAYBALLOT_NTFY_SERVER` points at another ntfy server.
- **The push:** one line, such as `126 checked · 4 changed · 2 held · 5 failed · 7 calls · 412k tokens (~$1.90 at API rates) · $0.00 API`, with any alerts below it. It links to the refresh PR, or else the run. Pushes from the Mac start with "Local".
  - **Priority 2 (low, no sound): clean.** Fetch failures (a 403 and the like) count here only: several guides fail every day by design.
  - **Priority 3: needs review.** Held picks, a shrunk guide, an unclear-match change, a removed pick, or a refresh branch that conflicts with main.
  - **Priority 5 (urgent): alert.** The run used the API; guides failed in Claude Code (when every one says "not logged in", the subscription token likely expired, see "Model calls"); or the refresh crashed or was stopped before writing `result.json`.
  - "~$1.90 at API rates" prices every call, subscription calls included. It is not money spent; "$0.00 API" is.
- **History:** each run appends a JSON line to `runs.ndjson` on the `runs` branch, which holds nothing else and never merges into `main`. Read it with `git fetch origin runs && git show origin/runs:runs.ndjson`. A line has the Pacific date, finish time, scope (`cloud` or `local`), exit code, duration, counts, calls, tokens, API cost and its API-rate equivalent, failed guides with errors cut to 200 characters, alerts, and the run URL and PR when there are any. It holds no page text or quotes. `scripts/append-run.sh` writes it from a temporary clone and retries if the other job pushed first.
- **Without a topic:** no push is sent and the run says so in one line. History is still recorded. Dry runs send nothing and record nothing.
- `result.json` carries the same numbers (`counts`, `calls`, `tokens`, `apiEquivalentCost`, `modelFailures`, `digest`, `alerts`, `durationSec`) next to its older fields. `npm run bb -- notify` sends the push by hand.

## Manual guides

Guides with `manual: true` are skipped by `extract`. Their picks are hand-entered or hand-corrected, so re-check their pages by hand during the refresh. As of 2026-10-06 these are lwv-ca, d2-dems (slate is an image), uesf, housing-action-coalition (hand-corrected after review), smc-dems (slate is a PNG on its homepage), smc-labor-council (picks are Word documents), svgop (slate is a JPG card), and since 2026-10-07 contra-costa-gop (two PNG slates), lamorinda-dems (city JPGs; only checkmarked names are endorsements) and contra-costa-labor-council (federal and state picks are headshot images), and since 2026-10-08 acdp and apadc (Alameda; their sites return 403 to plain and headless fetches, so picks are hand-entered from pages read in a real browser) and acgop (only two Union City picks are for November), and since 2026-10-09 sonoma-gop (two PNG slates), sonoma-farm-bureau (one PNG voter guide) and northern-solano-dems (19 image cards on a Google Site). `npm run bb -- check` lists them.

When you widen a guide's `areas`, add the area to `data/guides/<guide>.yml` (and any new `extraSources`). Don't run `pages --seed` first: it would store the new page text, and the scoped run could no longer tell what changed. Then run `npm run bb -- extract <guide...> --only-areas <area>[,<area>]`, for example `--only-areas san-mateo`. The area must already have a file in `data/areas/`.

- In scope are the contests the new areas add to the guide's ballot: their county and city contests, and a shared district (a new Congress or Assembly district) that none of the guide's other areas covers. Statewide contests and shared contests the guide already had are out of scope.
- The extractor and the verifier still see the guide's whole ballot, so another area's measure with the same letter (SF Prop J, San Mateo County Measure J) isn't read as the new one. Picks they return outside scope are discarded.
- Only those contests are added, replaced or dropped. Every other pick, quote, `ranked`/`rankedCount`, held pick and `hasReasoning` stays byte-for-byte as it was, so the diff and the changelog show only the new area.
- Only the new or changed picks, and holds in those contests, are sent to `verify`. Its "missing" list is limited to in-scope contests with no pick or hold.
- Pages are fetched and archived as for a normal extract, and it always extracts, even when the pages look unchanged. If a page also changed in a way that touches the guide's other areas, its page text is not stored and the summary warns, so the next refresh sees the change and re-extracts the whole guide. A new page (such as a new extra source) whose text names a contest in the guide's other areas is treated the same way, so it triggers one full re-extract on the next refresh. Otherwise the page text is stored.
- It refuses an area id that doesn't exist, one the guide doesn't list in `areas`, a guide with no other area (use a normal extract), and an unknown flag or `--only-areas=<area>`. A flag given twice is refused too. With `--all`, it runs only the guides that list every given area and at least one other, and exits with an error if there are none.

Use a full `extract --force-extract` only to re-read a guide whose page changed. It re-extracts every contest, so the model may reword quotes, re-rank or have picks held in the guide's other areas: review `git diff data/2026-11/endorsements/<guide>.yml`, restore anything it changed by mistake, and add bad new quotes to `rejectedQuotes`.

To keep a bad quote out for good, add it to the guide's `rejectedQuotes` (`text` and `reason`) in its endorsement file. Extraction never writes a listed quote back, and `npm run validate` fails if a pick quotes one. The San Mateo audits of 2026-10-06 seeded this list for courage-california, lwv-ssmc, lwv-ncsmc, green-foothills and bay-rising-action.

Any hand edit to a guide that is **not** manual (picks, `ranked`, quotes, `hasReasoning`) is overwritten by the next `extract`. Either mark the guide `manual: true`, or fix the input instead: add a contest alias, or add the explanation pages to `extraSources`.

## Ballot and area files

Each county's data lives in files of its own, so branches adding different counties don't touch the same file.

- `data/2026-11/ballot.yml`: the election header and the contests every county shares: state offices and propositions, Congress, State Senate, Assembly, Board of Equalization and Court of Appeal districts (`STATE_DISTRICTS` in `src/lib/areas.ts`), and `level: region` measures.
- `data/2026-11/ballot/<county-slug>.yml` (`san-francisco.yml`, `san-mateo.yml`, `santa-clara.yml`, `contra-costa.yml`, `alameda.yml`, `marin.yml`, `sonoma.yml`, `napa.yml`, `solano.yml`): a `contests:` list for one county. A contest belongs to the county of its jurisdiction: the county itself, a city in it, or a district whose first `within` place is in it. This includes BART and other special districts.
- `data/areas/<area-id>.yml`: one area, with an `order` number. Areas are listed by `order` (then id), and that also sets the county order on the ballot pages.

A local district (school, water, transit ward) may list several places in `within`. Usually they are all in one county: it appears on every area page that lists one of them and sits under the county heading on the Bay Area page. The exception is a district that spans counties (an EBMUD ward in Contra Costa and Alameda): it lists places in each, lives in the ballot file of the first county in its `within`, and is listed with the regional contests on the Bay Area page. List cities rather than the county when a county has city pages (Santa Clara: San Jose, Palo Alto, Mountain View), or the district shows on city pages it doesn't cover. A contest wholly inside one city page's city is that page's contest (back link, title and home), even though the county page lists it too.

**Ballot styles are the source of truth for `within`.** A city goes in a district's `within` if and only if at least one ballot style used in that city carries the contest. District maps and descriptions are a fallback only where a style can't be tied to a city. To regenerate for Santa Clara County: fetch every published style, `https://ca.omniballot.us/published/06085/1968/styles/<id>.json` (ids 294259 to 294585, one request at a time). Tag each style with the city whose own council, mayor or city measure is on it, and list for each contest the cities whose styles carry it. The result for Nov 2026 is `data/2026-11/sources/SCC-Ballot-Styles-Nov2026.txt`. No scraper is committed.

The site merges them: `ballot.yml`'s contests first, then each county file in area order. A county file's optional `placement:` maps one of its sections to a section of `ballot.yml`; those contests go right after that section instead of at the end. Only `san-francisco.yml` uses it, to keep the SF ballot worksheet's order.

`npm run validate` fails on a contest id used twice (naming both files), a contest in the wrong file, a county file whose name matches no area's county, and an area file whose name differs from its id.

To add a county (Contra Costa, Alameda, Marin, Sonoma, Napa, Solano):

1. Add `data/areas/<id>.yml` for each new area, with an `order` after the existing ones (now 10 to 40, 50 for Contra Costa, 70 for Marin, 80 for Sonoma, 90 for Napa County and 100 for Solano). Two areas with the same `order` are sorted by id. Every county needs a `kind: county` area (or, like SF, a city that is its own county): the area picker links counties only, and `validate` fails if a city page's county has no page.
2. Add `data/2026-11/ballot/<county-slug>.yml` (for example `contra-costa.yml`) holding every contest that belongs to that county.
3. Edit `ballot.yml` only for a shared contest: a new Congress or Assembly district, or a district or regional measure that now lists the new county in `within`.
4. Edit another county's file only to add the new county's places to a local district that spans both (as Alameda did for EBMUD Wards 3 and 7 in `contra-costa.yml`), or to add a candidate name alias.

## Pending follow-ups

- Re-run potrero-hill-dems on or after 2026-10-07 (endorsement votes ongoing).
- mercury-news `ross-council` (Julie A McMillan, Robert Herbst) was added by hand on 2026-10-07 from the IJ's 9/27 Ross editorial, which the extractor missed. After the next re-extract of mercury-news, check that the pick and its quote survived; if not, add them back by hand.
- Added by hand on 2026-10-07 after the Santa Clara widening audit, because the scoped extract missed them:
  - sccdp `lgsuhsd-measure-n` = Y, from "YES on Measures N / Los Gatos-Saratoga UHSD School Bonds" in its November local measures list.
  - south-bay-labor `fremont-uhsd-trustee-area-3` = Rosa Kim, from "Fremont Union High School District — Trustee Area 3 / Rosa Kim — Sole Endorsement".
  - ca-wfp holds `santa-clara-mayor` (Kevin Park): its PDF labels him "Santa Clara City Council", but he runs only for mayor.
  - After the next re-extract of these guides, check that the picks survived and the hold is still there. Add them back by hand if not.
- Marin County races follow the San Mateo rule: a local race is on the ballot only when a guide takes a position. The Marin IJ publishes one editorial at a time; when a guide covers a Marin race that isn't in `data/2026-11/ballot/marin.yml`, add it from `data/2026-11/sources/Marin-Candidates-Nov2026.txt` and re-extract that guide. New IJ editorials need adding to mercury-news's `extraSources`.
- Sonoma County races follow the same rule. Add a missing race from `data/2026-11/sources/Sonoma-Candidates-Nov2026.txt` and re-extract the guide. The Press Democrat publishes one editorial at a time: add each new Nov 2026 "endorsement-" editorial by its own Editorial Board to press-democrat's `extraSources` (still to come as of 2026-10-09: CD1, AD12 and the supervisor runoffs). Leave out its reprints of Mercury News / East Bay Times statewide editorials (bylined "Mercury News East Bay Times Editorial Boards") and its May primary editorials. The 2026-10-09 extract read a Barrera superintendent pick from a related-article headline to one of those reprints; it was removed by hand. Remove it again if a re-extract returns it. The 2026-10-10 refresh did the same with No on Props 41 and 42, from the sidebar headline "Endorsement: If you support the billionaire tax, vote no on Props. 41 and 42"; both were removed. If that editorial carries the Press Democrat's own Editorial Board byline, add its URL to `extraSources` and re-extract.
- The Sonoma County Democrats' Cotati City Council pick (Kimberlyn Moffet) and NBCLC's SRJC (Maggie Fishman, Ezrah Chabaan) and Roseland SD (Anthony Mendoza) picks have no contest on the Nov 2026 ballot and are not recorded.
- Napa County races follow the same rule. The area id is `napa-county` (Napa is also a city); the ballot file is `data/2026-11/ballot/napa.yml` (the county slug). Add a missing race from `data/2026-11/sources/Napa-Candidates-Nov2026.txt` and re-extract the guide. Left out as of 2026-10-09 because no guide covers it: Calistoga Joint USD. St. Helena Measure S and Yountville Measure Y were added after review because Reform California takes positions on them. napacounty.gov and americancanyon.gov return 403 to curl; read them in a browser.
- Napa picks not recorded because their contests are not on Napa ballots: the Napa County Democrats' Lotte Cosca (NVC Area 5), Katherine Hyde Shelton (NVUSD Area 3), Kevin Eisenberg (Calistoga mayor) and Lana Richardson (Calistoga council), all "On Ballot: No"; and the Napa County GOP's CD1, State Senate 4 and BOE 1 picks. The Napa GOP labels its Measure B "Measure B City of Napa"; the only Measure B on Napa ballots is the countywide one, and its No is recorded there. Its "Matt Gates" is matched to Michael E. Gates by an alias in `ballot.yml`.
- Reform California quirks in Sonoma and Napa, from the 2026-10-09 review; check them after a re-extract:
  - Its Sonoma page lists Paul Carey under Rohnert Park "Council District 1". Rohnert Park has only Districts 2 and 5 on the ballot and Carey runs in District 2, so the pick is recorded on `rohnert-park-council-2`.
  - It calls Two Rock Union School District "Two Rock Unified". The contest is `two-rock-union-sd-trustee`.
  - Its `court-of-appeal-6` pick was removed by hand. The Santa Clara page lists seven 6th District justices as DO NOT RETAIN but never names Frederick S. Chung, so a contest-wide No would credit it with a position it did not take (the same reason it has no `court-of-appeal-1` pick). Remove it again if a re-extract returns it.
  - The scoped Sonoma extract dropped the quotes on `sonoma-county-measure-h`, `windsor-measure-i`, `rohnert-park-measure-k`, `santa-rosa-measure-l` and `schell-vista-fire-measure-n`; they were restored by hand from the Sonoma page. Add them back if a re-extract drops them again.
  - The quotes on `cabrillo-usd-measure-z` and `berkeley-measure-z` were re-pointed by hand to https://www.reformcalifornia.org/voter-guides/san-mateo and https://www.reformcalifornia.org/voter-guides/alameda. The same sentence is on the Solano page under Benicia's Measure Z, so an extract cites Solano; re-point them again after a re-extract.
  - `yountville-measure-y` has no quote: its sentence ("Expands the spending ceiling…") also appears under Marin Measures AA and EE on the Marin page, so the wrong-contest guard drops it.
  - Marin Measures O, Q, T, Z, AA, EE and FF and Santa Clara Measures A, C, G, H and I were added on 2026-10-09 (#111) because it takes positions on them. The scoped extract (`--only-areas marin,santa-clara-county`, $1.16) returned the picks with no quotes and also dropped the quotes on the twelve Marin measures it already had. All of them were restored or added by hand from the Marin and Santa Clara pages after checking each against the extractor's own quote guards. `sunnyvale-measure-h` has no quote: its sentence ("Lets the council raise by ordinance — never returning to voters — …") trips the attributed-speech guard. Add the quotes back if a re-extract drops them again.
  - Its Alameda page lists County Board of Education Trustee Area 2 (Rohan Marfatia) and Area 4 (Mark Harvey) and "Flood & Water Board District 7" (Sean Roberts). None is on the Nov 3 ballot: the registrar's candidate list (election 260) has no county races at all, and all three were in the June 2 primary (election 259): Marfatia for Supervisor District 2, Harvey for Board of Education Trustee Area 4, and Roberts for Zone 7 Water Agency (Flood Control & Water Conservation District Director, Zone 7). The section is left over from the primary guide. The picks are not recorded; an extract drops them as unknown contests.
- nbclc `srjc-measure-ab` = Y was added by hand (2026-10-09) from https://www.nbclc.org/2026endorsements ("Measure AB - SRJC District Bond" / "YES", under "Sonoma Measures"). The extract missed it. After the next re-extract of this guide, check that the pick survived and add it back by hand if not.
- 350-bay-area-action `napa-county-measure-b` = Y was added by hand (2026-10-09) from https://350bayareaaction.org/napa_county_wildfire_preparedness_act ("is a clear Yes for us. Please Vote Yes."). The page never prints the letter B, so two scoped extracts returned nothing. After the next re-extract of this guide, check that the pick survived and add it back by hand if not.
- sv-dsa `east-palo-alto-measure-o` = Y describes a 1.5% tax on landlords' rental revenue, which was East Palo Alto's 2016 Measure O. The 2026 Measure O is a general obligation bond of up to $125M for a civic center (police station, library, City Hall), water and stormwater systems, and park land (registrar list, city press release of July 21, 2026, and the impartial analysis). The pick is held as `unclear-match` (decision 2026-10-09). Release it if the guide corrects its write-up.
- sv-dsa: a scoped re-extract (2026-10-09, `--only-areas san-mateo`, $0.63) dropped the `held` entry for `smcccd-measure-v` and published the pick (#119). The hold was restored by hand; since #120 both sv-dsa holds are `unclear-match`, which re-extracts keep.
- The Press Democrat's Napa editorials (American Canyon P, Napa County B) are in press-democrat's `extraSources`. Add new Napa "endorsement-" editorials there as they appear (none yet for AD4, the Napa city and school races, or Measures S and Y).
- napa-dems (http://napadems.org/home/) works over http only, and it is the party's homepage, so unrelated homepage edits trip the refresh. North Bay Labor Council is widened to Napa only for its Congress 4 and Assembly 4 picks; its page has no Napa section.
- Solano County races follow the same rule. The area id is `solano`; the ballot file is `data/2026-11/ballot/solano.yml`. Add a missing race from `data/2026-11/sources/Solano-Candidates-Nov2026.txt` (OFF THE BALLOT seats never go on the ballot) and re-extract the guide. Left out as of 2026-10-09 because no guide covers them: San Joaquin Delta College Trustee Area 4, River Delta USD Trustee Area 1 and the Dixon elected city clerk. Solano is in Board of Equalization District 1 (`board-of-equalization-1`, Solano only so far) and is not in the Regional Transit Measure.
- Solano guide quirks, all matched correctly by the 2026-10-09 extract; check them after a re-extract. The Solano County Democrats label Kedarisetty's County Board of Education seat "Area 4" (she runs in Trustee Area 6) and copy the uncorrected Benicia titles (Y as the transfer tax, Z as the business license tax); both picks are Yes either way. Reform California labels Rio Vista's Measure O "Measure H" and Craig Stuart Adams "Marin County Board of Education Trustee Area 5" (he runs in Trustee Area 3). The Napa Solano Central Labor Council lists Measures E, H, P, X, Y and Z under "Endorsements" with no Yes or No; they are recorded as Yes.
- Solano picks not recorded because their contests are not on Solano ballots: Reform California's Solano College Trustee Area 6 (Amber Cargo-Reed, off the ballot), its eight extra 1st District justices, and its CD4, CD7, AD4 and AD7 lines; the Northern Solano Democratic Club's three "ELECTED!" cards (Wanda Williams, Nancy Dunn, Kai Eusebio). Reform California splits the 1st District Court of Appeal (retain Banke and Richman, not the rest), so it has no `court-of-appeal-1` pick.
- Skipped until they publish their own page (they are known only from news articles): Solano Orderly Growth Committee, the Vacaville Chamber of Commerce and the Vallejo Chamber's ValPAC. Not yet published as of 2026-10-09: Vallejo Times-Herald, The Reporter and the Daily Republic.
- napa-solano-labor was widened to `napa-county` after review (2026-10-09) for its Napa County section (American Canyon council, Napa council D3, Napa Valley College and NVUSD trustees) and its Congress 4 and Assembly 4 picks. The Vallejo USD trustees under its Napa heading are Solano contests.
- reform-california covers every county area from its county pages (`/voter-guides/<county>`; the source is Solano's and the other counties are `extraSources`). Its pages contradict each other on Assembly 19 and Congress 15 (the San Mateo page names Philip Louis Wing and Charles Hoelter; the San Francisco page says "You are Doomed"); the picks follow the San Mateo page and the statewide page. Its Alameda page also lists Santa Clara races (Milpitas, Alum Rock, Oak Grove, Franklin-McKinley). Aliases were added for its spellings in Assembly 21 and 23, Oak Grove SD Area 5 and Novato council D4.
- Alameda County races follow the same rule, and unopposed seats printed on the ballot count when a guide picks them. Add a missing race from `data/2026-11/sources/ALA-Candidates-Nov2026.txt` (Not On Ballot seats never go on the ballot). Newark Mayor and Pleasanton D1 are left out until a guide picks them. EBMUD Wards 3 and 7 span Contra Costa and Alameda and live in `contra-costa.yml`.
- wellstone and acce-action list their Alameda picks without quotable reasons, so `hasReasoning` is set to false by hand (2026-10-07). A re-extract can set it back; check it after one.
- Picks released from `held` by hand on 2026-10-07, which a re-extract may hold again: empower-oakland `oakland-usd-2` (Fleisher, "rank #1, leave #2 blank", a one-name pick with `ranked: true`) and alameda-labor-council `berkeley-council-1` and `oakland-usd-4` ("Dual Endorsement | Rank Both Candidates", no order, two names with `ranked: false`). ebyd's `albany-council` pick stays held: it ranks two names for a two-seat race, which the schema can't express.
- courage-california `us-rep-17` = Ro Khanna was added by hand (2026-10-08) from its Alameda county page ("Re-elect Congressional Representative Ro Khanna…"); the scoped Alameda extract skipped it because the guide's Santa Clara areas already cover CD17. After the next re-extract of this guide, check that the pick survived and add it back by hand if not.
- east-bay-dsa: picks its guide marks "Recommendation Source: California DSA" (statewide offices and propositions, some districts) are California DSA's positions, not East Bay DSA's, and stay out. Reject them if an extract returns them.
- Not yet published for Alameda as of 2026-10-08: East Bay Times local picks (its endorsements index is in mercury-news's `extraSources`), LWV Oakland (Oct 13), and the Alameda County GOP's general-election page.
- Contra Costa County races follow the same rule, and unopposed seats printed on the ballot count when a guide picks them. Add a missing race from `data/2026-11/sources/CCC-Candidate-List-0827.txt`. Seats decided in June (Richmond council) or not printed (uncontested, appointed in lieu of election) never go on the ballot, so guide picks for them are not recorded. Livermore Valley JUSD Area 3 is left out until it is confirmed on Contra Costa ballots.
- Not yet published for Contra Costa as of 2026-10-07: Lift Up Contra Costa Action, LWV Diablo Valley (Walnut Creek U, Acalanes W), East Bay Times local picks, and more ContraCosta.news cities. Contra Costa Jewish Democrats is left out until its page names the election.
- San Mateo County local candidate races are on the ballot only when a guide takes a position on them. When a guide covers a race that isn't there (the Daily Journal publishes one editorial at a time), add the race to `data/2026-11/ballot/san-mateo.yml` from the registrar's roster (https://smcacre.gov/system/files/2026-09/52_candidateroster0903.pdf; a redacted text extract is in `data/2026-11/sources/SMC-Candidate-Roster-0903.txt`) and re-extract that guide. Refresh doesn't add races on its own yet.
- palo-alto-forward's page has only one-line taglines and no quotable reasons, so `hasReasoning` is set to false by hand (2026-10-06). A re-extract can set it back; check it after one.
- yimby-action's `hasReasoning` is set to false by hand (2026-10-07). Its only reason quote is the Marin YIMBY one on AD12, out of more than 40 picks, and true would count it as a guide that explains on SF and Peninsula contests. A re-extract can set it back; check it after one.
- Santa Clara County contests come from sample ballots, not the registrar site: vote.santaclaracounty.gov and rovservices.sccgov.org block automated browsers. `data/2026-11/sources/SCC-Sample-Ballots-PA-MV.txt` lists the precincts and ballot styles sampled through the County Voter Information Guide (https://ca.omniballot.us/sites/06085/site/app/cvig/vg/info?pid=<precinct>). Omniballot throttles fast lookups, so sample one precinct at a time.
- Not yet published for Palo Alto and Mountain View as of 2026-10-06: Palo Alto Weekly / Palo Alto Online, Mountain View Voice, and Mercury News local picks. (The Los Altos Town Crier has since endorsed in Mountain View races, Measures E and F and Valley Water 7; LWV Los Altos-Mountain View takes a position only on Los Altos Measure D.)
- Not yet published for San Mateo County as of 2026-10-06: The Almanac, Redwood City Pulse, Half Moon Bay Review, Coastsider (site down) and Mercury News local picks. Add them when they publish.
- Santa Clara County (2026-10-07): each district's `within` comes from the registrar's ballot styles (see "Ballot and area files"). San Jose outside Districts 5, 7 and 9, Campbell outside Districts 3 to 5, and Monte Sereno can't be told apart on a style; San Jose is taken from its precinct range (0007xxx and 0008xxx), and Campbell and Monte Sereno are kept from district descriptions only where an unidentified precinct nearby carries the contest. `assembly-23` and `us-rep-16` stay county-wide.
- Silicon Valley DSA's guide is a Google Doc whose race headings are bare ("District 17", "Mountain View"), so the extractor's placement check can't tie most quotes to their race and drops them; the picks are kept. Its Measure V pick (SMCCCD) is held as `unclear-match`: the blanket "Yes on all school bonds" names school districts only. Its East Palo Alto Measure O pick is held too (see above).
- Not yet published for Santa Clara County as of 2026-10-07: Mercury News local editorials and Planned Parenthood Advocates Mar Monte's 2026 guide.
