# Refresh run history

One JSON line per data refresh run in `runs.ndjson`, appended by `scripts/append-run.sh` on `main`
after each run of the GitHub workflow (`scope: cloud`) and the local job on Sean's Mac (`scope: local`).

Each line has the run's Pacific date, finish time, exit code, duration, guide counts, model calls,
tokens, API spend and its API-rate equivalent, failed guides with short errors, and alerts.
No page text or quotes. The record's shape is `RunRecord` in `src/pipeline/report.ts`. `vercel.json` turns off
Vercel deploys for this branch.

Read it with `git show origin/runs:runs.ndjson`. This branch never merges into `main`.
