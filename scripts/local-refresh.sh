#!/bin/zsh
# Daily refresh of the guides whose sites block GitHub's runners (fetchFrom: local).
# Runs in its own worktree, opens or updates one PR, and lets it auto-merge only when every guard passes.
#
#   local-refresh.sh             refresh and open/update the PR
#   local-refresh.sh --dry-run   fetch and gate pages only: no model calls, no commit, no PR
#   --ref <git ref>              start from this ref instead of origin/main (testing a branch)
#
# To stop a pending auto-merge by hand: gh pr merge <number> --disable-auto (a label alone does not stop it).
set -u
setopt pipe_fail

REPO="${BB_REPO:-seanoliver/bay-ballot}"
SOURCE_REPO="${BB_SOURCE_REPO:-$HOME/code/projects/bay-ballot}"
WORKTREE="${BB_WORKTREE:-$HOME/code/projects/bay-ballot-refresh}"
SUPPORT="${BB_SUPPORT:-$HOME/Library/Application Support/bay-ballot}"
LOG="${BB_LOG:-$HOME/Library/Logs/bay-ballot-refresh.log}"
BRANCH="data/refresh-local"
ISSUE_TITLE="Local refresh needs review"
LOCK="$SUPPORT/lock"
SHRUNK_STATE="$SUPPORT/shrunk-state.json"
MAX_LOG_LINES=5000
LOCK_STALE_SECS=$((3 * 3600))
WATCHDOG_SECS="${BB_WATCHDOG_SECS:-7200}"
FETCH_RETRY_DELAY="${BB_FETCH_RETRY_DELAY:-30}"

dry_run=false
ref="origin/main"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=true ;;
    --ref) ref="$2"; shift ;;
    *) print -u2 "unknown option: $1"; exit 64 ;;
  esac
  shift
done

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
notify() {
  [ "${BB_NOTIFY:-1}" = "1" ] && command -v osascript >/dev/null &&
    osascript -e "display notification \"$1\" with title \"Bay Ballot local refresh\"" >/dev/null 2>&1
  return 0
}

mkdir -p "$SUPPORT" "${LOG:h}"

# Lock: a directory holding the owner's PID. Take it over if that process is gone or the lock is stale.
if ! mkdir "$LOCK" 2>/dev/null; then
  owner="$(cat "$LOCK/pid" 2>/dev/null)"
  age=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || date +%s) ))
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null && [ "$age" -lt "$LOCK_STALE_SECS" ]; then
    log "another local refresh (pid $owner) is running; exiting" >> "$LOG"
    exit 0
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK" || { print -u2 "could not take the lock at $LOCK"; exit 1; }
fi
print -r -- $$ > "$LOCK/pid"

if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$MAX_LOG_LINES" ]; then
  # Rewritten in place so launchd's open handle keeps appending to the same file.
  trimmed="$(tail -n $((MAX_LOG_LINES / 2)) "$LOG")"
  print -r -- "$trimmed" > "$LOG"
fi
# Under launchd the plist already sends stdout and stderr to the log.
if [ "${BAYBALLOT_LAUNCHD:-}" != "1" ]; then exec > >(tee -a "$LOG") 2>&1; fi

work="$(mktemp -d)"
watchdog=""
cleanup() {
  [ -n "$watchdog" ] && kill "$watchdog" 2>/dev/null
  rm -rf "$work"
  [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"
}
trap cleanup EXIT
trap 'log "stopped by signal"; exit 143' TERM INT

# Watchdog: end a run that hangs. Kill the whole process group only when this script leads it
# (launchd or an interactive job); otherwise just this script.
# Its output goes straight to the log so it never holds this run's stdout open.
main_pid=$$
( trap 'kill $nap 2>/dev/null; exit 0' TERM
  sleep "$WATCHDOG_SECS" & nap=$!
  wait $nap
  log "watchdog: run exceeded ${WATCHDOG_SECS}s; stopping"
  if [ "$(ps -o pgid= -p $main_pid | tr -d ' ')" = "$main_pid" ]; then kill -TERM -- -$main_pid; else kill -TERM $main_pid; fi
) </dev/null >>"$LOG" 2>&1 &
watchdog=$!

fail() { log "ERROR: $*"; notify "Failed: $*"; exit 1; }
gh_() { gh "$@" --repo "$REPO"; }

log "local refresh starting (dry run: $dry_run, ref: $ref)"
for cmd in git gh node npm npx pdftotext; do command -v "$cmd" >/dev/null || fail "$cmd not on PATH"; done
[ -d "$SOURCE_REPO" ] || fail "no source checkout at $SOURCE_REPO"
common="$(git -C "$SOURCE_REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" ||
  fail "$SOURCE_REPO is not a git checkout"

fetched=false
for attempt in 1 2 3; do
  if git -C "$SOURCE_REPO" fetch -q --prune origin; then fetched=true; break; fi
  log "git fetch failed (attempt $attempt of 3)"
  [ "$attempt" -lt 3 ] && sleep "$FETCH_RETRY_DELAY"
done
$fetched || fail "git fetch failed 3 times"

if [ ! -e "$WORKTREE" ]; then
  git -C "$SOURCE_REPO" worktree add -q --detach "$WORKTREE" "$ref" || fail "could not create $WORKTREE"
fi

# The worktree must be ours alone: a worktree of the source repo, its own top level, detached
# (so no branch is ever reset), with nothing but data/ changed.
check_worktree() {
  local top wt_common
  top="$(git -C "$WORKTREE" rev-parse --show-toplevel 2>/dev/null)" || fail "$WORKTREE is not a git worktree"
  [ "${top:A}" = "${WORKTREE:A}" ] || fail "$WORKTREE is inside another checkout ($top)"
  wt_common="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir)"
  [ "${wt_common:A}" = "${common:A}" ] || fail "$WORKTREE belongs to a different repository"
  git -C "$WORKTREE" symbolic-ref -q HEAD >/dev/null && fail "$WORKTREE has a branch checked out; it must be detached"
  local dirty
  dirty="$(git -C "$WORKTREE" status --porcelain --untracked-files=all | grep -v '^.. data/' || true)"
  [ -z "$dirty" ] || fail "$WORKTREE has changes outside data/:"$'\n'"$dirty"
}
check_worktree
cd "$WORKTREE" || fail "no $WORKTREE"

# Our own open PR (a fork's PR from a same-named branch is ignored).
pr="$(gh_ pr list --head "$BRANCH" --state open --json number,isCrossRepository \
  --jq 'map(select(.isCrossRepository | not)) | .[0].number // empty')" || fail "gh pr list failed"
# Never leave auto-merge armed while this run might push new data.
if [ -n "$pr" ] && ! $dry_run; then gh_ pr merge "$pr" --disable-auto >/dev/null 2>&1 || true; fi

hold() { # hold <reason>: keep the PR open for a person
  gh_ pr merge "$pr" --disable-auto >/dev/null 2>&1 || true
  gh_ label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
  gh_ pr edit "$pr" --add-label needs-review >/dev/null
  gh_ pr comment "$pr" --body "Not auto-merged: $1" >/dev/null
  log "PR #$pr needs review: $1"
  notify "PR #$pr needs review"
}

if [ -n "$pr" ] && [ "$ref" = "origin/main" ]; then
  git reset -q --hard "origin/$BRANCH" && git clean -fdq || fail "could not reset to origin/$BRANCH"
  if ! git -c commit.gpgsign=false merge -q --no-edit origin/main; then
    git merge --abort 2>/dev/null
    $dry_run || hold "Refresh branch conflicts with main; resolve by hand."
    exit 1
  fi
  log "continuing open PR #$pr"
else
  git reset -q --hard "$ref" && git clean -fdq || fail "could not reset to $ref"
fi
check_worktree

stale_script=""
if ! cmp -s "$0" "$WORKTREE/scripts/local-refresh.sh"; then
  stale_script="the installed script differs from scripts/local-refresh.sh on main; re-run npm run local-refresh:install"
  log "WARNING: $stale_script"
fi

# Only the one key the pipeline needs, never echoed.
if [ -f "$SOURCE_REPO/.env.local" ]; then
  ( umask 077; grep -E '^BAYBALLOT_ANTHROPIC_API_KEY=' "$SOURCE_REPO/.env.local" | tail -n 1 > .env.local )
elif ! $dry_run; then
  fail "no .env.local in $SOURCE_REPO"
fi

lock_hash="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ "$(cat node_modules/.package-lock-hash 2>/dev/null)" != "$lock_hash" ]; then
  log "installing dependencies"
  npm ci --no-audit --no-fund --loglevel=error >/dev/null || fail "npm ci failed"
  npx --no-install playwright install chromium >/dev/null 2>&1 || fail "playwright install failed"
  print -r -- "$lock_hash" > node_modules/.package-lock-hash
fi

git archive origin/main data | tar -x -C "$work" || fail "could not extract main's data as the baseline"

extra=()
$dry_run && extra=(--no-extract)
[ -f "$SHRUNK_STATE" ] && extra+=(--shrunk-state "$SHRUNK_STATE")
npm run -s bb -- refresh --local-only --baseline "$work/data" --summary "$work/summary.md" --result "$work/result.json" "${extra[@]}"
code=$?
log "refresh exit code $code"
[ -f "$work/summary.md" ] && cat "$work/summary.md"

# Remember shrunk guides so an unchanged shrunk page isn't re-extracted; keep the old state if the run crashed.
if [ -f "$work/result.json" ] && ! $dry_run; then
  node -e 'const r = require(process.argv[1]); console.log(JSON.stringify(Object.fromEntries(r.shrunk.map((s) => [s.id, s.pageHash]))))' \
    "$work/result.json" > "$work/shrunk.json" && mv "$work/shrunk.json" "$SHRUNK_STATE"
fi

data_changed="$(git status --porcelain -- 'data/*/endorsements' data/changelog)"
extracted="$(node -e 'try { console.log(require(process.argv[1]).extracted.length) } catch { console.log(0) }' "$work/result.json")"

if $dry_run; then
  log "dry run: data changes the real run would start from:"
  git status --short -- data
  git checkout -q -- data && git clean -fdq -- data
  log "dry run done; worktree reset"
  exit "$code"
fi

if [ -z "$data_changed" ] && [ "$extracted" = "0" ]; then
  git checkout -q -- data && git clean -fdq -- data
  if [ "$code" != "0" ] || [ -n "$stale_script" ]; then
    {
      cat "$work/summary.md" 2>/dev/null || print "The local refresh failed before writing a summary (exit code $code); see $LOG on Sean's Mac."
      [ -n "$stale_script" ] && print "\n**Warning:** $stale_script"
      print "\ncc @seanoliver"
    } > "$work/issue.md"
    issue="$(gh_ issue list --state open --author @me --search "in:title \"$ISSUE_TITLE\"" --json number,title \
      --jq "map(select(.title == \"$ISSUE_TITLE\")) | .[0].number // empty")"
    if [ -n "$issue" ]; then
      gh_ issue edit "$issue" --body-file "$work/issue.md" >/dev/null
      gh_ issue comment "$issue" --body "Local refresh $(date +%F): exit code $code." >/dev/null
    else
      gh_ issue create --title "$ISSUE_TITLE" --body-file "$work/issue.md" >/dev/null
    fi
    log "no data to commit; review issue updated (exit code $code)"
    notify "Local refresh needs review (exit code $code)"
  else
    log "no relevant changes; nothing to commit"
  fi
  exit "$code"
fi

git add data
git -c commit.gpgsign=false commit -q -m "data: local refresh $(date +%F)" || fail "commit failed"
if [ -n "$pr" ]; then
  git push -q origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
else
  git push -q --force-with-lease origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
fi
head_sha="$(git rev-parse HEAD)"

{
  cat "$work/summary.md"
  [ -n "$stale_script" ] && print "\n**Warning:** $stale_script"
  print "\ncc @seanoliver"
} > "$work/pr-body.md"
if [ -n "$pr" ]; then
  gh_ pr edit "$pr" --body-file "$work/pr-body.md" >/dev/null || fail "could not update PR #$pr"
  gh_ pr comment "$pr" --body "New local refresh $(date +%F) (exit code $code); summary above is updated." >/dev/null
else
  url="$(gh_ pr create --base main --head "$BRANCH" --title "data: local refresh" --body-file "$work/pr-body.md")" ||
    fail "gh pr create failed"
  pr="${url##*/}"
fi
log "PR #$pr updated"

reasons=()
[ "$code" = "0" ] || reasons+=("refresh exit code $code (2 = held picks or a shrunk result, 1 = error)")
outside="$(git diff --name-only --no-renames origin/main...HEAD | grep -v '^data/' || true)"
[ -z "$outside" ] || reasons+=("files outside data/: ${(f)outside}")
labels="$(gh_ pr view "$pr" --json labels --jq '[.labels[].name] | join(",")')"
[[ ",$labels," != *",needs-review,"* ]] || reasons+=("the PR is labeled needs-review")
[ -z "$stale_script" ] || reasons+=("$stale_script")
requires_ci="$(gh api "repos/$REPO/rules/branches/main" \
  --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context] | index("ci") != null' 2>/dev/null)"
[ "$requires_ci" = "true" ] || reasons+=("main's ruleset does not require the ci check, so auto-merge would not wait for it")

if [ ${#reasons} -eq 0 ]; then
  gh_ pr merge "$pr" --auto --squash --delete-branch --match-head-commit "$head_sha" >/dev/null ||
    { hold "could not enable auto-merge"; exit 2; }
  log "auto-merge enabled on PR #$pr at $head_sha (merges after the required ci check passes)"
  exit 0
fi
hold "${(j:; :)reasons}"
[ "$code" = "0" ] && exit 2
exit "$code"
