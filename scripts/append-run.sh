#!/usr/bin/env bash
# Always exits 0: a run whose history could not be recorded still succeeded.
set -u

record="${1:-}" remote="${2:-}" name="${3:-}" email="${4:-}"
BRANCH=runs
ATTEMPTS=4

warn() { echo "warning: could not record the run history: $*" >&2; exit 0; }

[ -n "$remote" ] && [ -n "$name" ] && [ -n "$email" ] || warn "usage: append-run.sh <record.json> <remote url> <author name> <author email>"
[ -s "$record" ] || warn "no record at '$record'"
line="$(tr -d '\n' < "$record")"
case "$line" in "{"*"}") ;; *) warn "the record is not one JSON object" ;; esac

# A caller inside a hook or another repository could point git elsewhere.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_COMMON_DIR
tmp="$(mktemp -d)" || warn "mktemp failed"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
g() { git -C "$repo" -c user.name="$name" -c user.email="$email" -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"; }

for attempt in $(seq "$ATTEMPTS"); do
  rm -rf "$repo"
  git init -q "$repo" || warn "git init failed"
  heads="$(git ls-remote --heads "$remote" 2>/dev/null)" || warn "could not reach the remote"
  # A pattern would also match refs/heads/foo/runs; compare the full ref name.
  if printf '%s\n' "$heads" | awk -v ref="refs/heads/$BRANCH" '$2 == ref { found = 1 } END { exit !found }'; then
    g fetch -q --depth 1 "$remote" "refs/heads/$BRANCH" || warn "could not fetch the $BRANCH branch"
    g checkout -q -b "$BRANCH" FETCH_HEAD || warn "could not check out the $BRANCH branch"
  else
    g checkout -q --orphan "$BRANCH"
    cat > "$repo/README.md" <<'EOF'
# Refresh run history

One JSON line per data refresh run in `runs.ndjson`, appended by `scripts/append-run.sh` on `main`
after each run of the GitHub workflow (`scope: cloud`) and the local job on Sean's Mac (`scope: local`).

Each line has the run's Pacific date, finish time, exit code, duration, guide counts, model calls,
tokens, API spend and its API-rate equivalent, failed guides with short errors, and alerts.
No page text or quotes. The record's shape is `RunRecord` in `src/pipeline/report.ts`. `vercel.json` turns off
Vercel deploys for this branch.

Read it with `git show origin/runs:runs.ndjson`. This branch never merges into `main`.
EOF
    : > "$repo/runs.ndjson"
  fi
  # Vercel reads vercel.json from the pushed commit; without it every history push is a preview deploy.
  if [ ! -f "$repo/vercel.json" ]; then
    cat > "$repo/vercel.json" <<'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
EOF
  fi
  printf '%s\n' "$line" >> "$repo/runs.ndjson"
  g add README.md runs.ndjson vercel.json || warn "git add failed"
  g commit -q -m "run: $(date -u +%FT%TZ) [skip ci]" || warn "commit failed"
  if g push -q "$remote" "HEAD:refs/heads/$BRANCH" 2>"$tmp/push-error"; then
    echo "Recorded the run on the $BRANCH branch."
    exit 0
  fi
  echo "push to $BRANCH was rejected (attempt $attempt of $ATTEMPTS); retrying" >&2
done
warn "the push failed $ATTEMPTS times: $(grep -m1 -E 'rejected|error|fatal' "$tmp/push-error")"
