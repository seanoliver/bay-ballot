#!/bin/zsh -f
# Usage and options: docs/runbook.md, "Local refresh on Sean's Mac".
set -u
setopt pipe_fail

SELF="${0:A}"
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
# claude-code (default): model calls on Sean's Claude subscription, using the API key only past its usage limit. api: every call on the API.
MODEL_VIA="${BAYBALLOT_MODEL_VIA:-claude-code}"
export GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=30'

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
[ "$ref" = "origin/main" ] || dry_run=true
case "$MODEL_VIA" in api|claude-code) ;; *) print -u2 "BAYBALLOT_MODEL_VIA must be api or claude-code, not '$MODEL_VIA'"; exit 64 ;; esac

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
notify() {
  command -v osascript >/dev/null || return 0
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "Bay Ballot"' -e 'end run' "$1" >/dev/null 2>&1
  return 0
}

mkdir -p "$SUPPORT" "${LOG:h}"

if ! mkdir "$LOCK" 2>/dev/null; then
  owner="$(cat "$LOCK/pid" 2>/dev/null)"
  age=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || date +%s) ))
  # A young lock with no PID is a run that has not written its PID yet, not a stale lock.
  if { [ -z "$owner" ] && [ "$age" -lt 60 ]; } ||
     { [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null && [ "$age" -lt "$LOCK_STALE_SECS" ]; }; then
    log "another local refresh is running; exiting" >> "$LOG"
    exit 0
  fi
  # Rename first: if two runs race for a stale lock, only the one whose rename succeeds goes on.
  mv "$LOCK" "$LOCK.stale.$$" 2>/dev/null || exit 0
  rm -rf "$LOCK.stale.$$"
  mkdir "$LOCK" 2>/dev/null || exit 0
fi
print -r -- $$ > "$LOCK/pid"

if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$MAX_LOG_LINES" ]; then
  # Rewritten in place so launchd's open handle keeps appending to the same file.
  trimmed="$(tail -n $((MAX_LOG_LINES / 2)) "$LOG")"
  print -r -- "$trimmed" > "$LOG"
fi
if [ "${BAYBALLOT_LAUNCHD:-}" != "1" ]; then exec > >(tee -a "$LOG") 2>&1; fi

work="$(mktemp -d)"
watchdog=""
cleanup() {
  [ -n "$watchdog" ] && kill "$watchdog" 2>/dev/null
  rm -rf "$work"
  [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"
}
trap cleanup EXIT
stopped() { log "stopped by $1"; notify "Bay Ballot: local refresh stopped (watchdog or signal)"; exit "$2"; }
trap 'stopped SIGTERM 143' TERM
trap 'stopped SIGINT 130' INT

main_pid=$$
( trap 'kill $nap 2>/dev/null; exit 0' TERM
  sleep "$WATCHDOG_SECS" & nap=$!
  wait $nap
  log "watchdog: run exceeded ${WATCHDOG_SECS}s; stopping"
  if [ "$(ps -o pgid= -p $main_pid | tr -d ' ')" = "$main_pid" ]; then kill -TERM -- -$main_pid; else kill -TERM $main_pid; fi
) </dev/null >>"$LOG" 2>&1 &
watchdog=$!

fail() { log "ERROR: $*"; notify "Bay Ballot: local refresh failed: $*"; exit 1; }
gh_() { gh "$@" --repo "$REPO"; }

log "local refresh starting (dry run: $dry_run, ref: $ref, models via: $MODEL_VIA)"
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

check_worktree() {
  local top wt_common wt_gitdir status_out entry file
  local -a dirty
  [ "${WORKTREE:A}" != "${SOURCE_REPO:A}" ] || fail "$WORKTREE is the source checkout, not a linked worktree"
  top="$(git -C "$WORKTREE" rev-parse --show-toplevel 2>/dev/null)" || fail "$WORKTREE is not a git worktree"
  [ "${top:A}" = "${WORKTREE:A}" ] || fail "$WORKTREE is inside another checkout ($top)"
  wt_common="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir)" || fail "cannot read $WORKTREE's repository"
  [ "${wt_common:A}" = "${common:A}" ] || fail "$WORKTREE belongs to a different repository"
  wt_gitdir="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-dir)" || fail "cannot read $WORKTREE's git dir"
  [ "${wt_gitdir:A}" != "${wt_common:A}" ] || fail "$WORKTREE is not a linked worktree"
  git -C "$WORKTREE" symbolic-ref -q HEAD >/dev/null && fail "$WORKTREE has a branch checked out; it must be detached"
  status_out="$(git -C "$WORKTREE" status --porcelain -z --untracked-files=all)" || fail "git status failed in $WORKTREE"
  # -z entries are "XY path", unquoted; a rename's source path follows as its own entry and is checked too.
  for entry in "${(@0)status_out}"; do
    [ -z "$entry" ] && continue
    if [ ${#entry} -ge 4 ] && [ "${entry[3]}" = " " ]; then file="${entry:3}"; else file="$entry"; fi
    [[ "$file" == data/* ]] || dirty+=("$file")
  done
  [ ${#dirty} -eq 0 ] || fail "$WORKTREE has changes outside data/: ${(j:, :)dirty}"
}
check_worktree
cd "$WORKTREE" || fail "no $WORKTREE"

pr=""
if ! $dry_run; then
  pr="$(gh_ pr list --head "$BRANCH" --base main --state open --json number,isCrossRepository \
    --jq 'map(select(.isCrossRepository | not)) | .[0].number // empty')" || fail "gh pr list failed"
fi

if [ -n "$pr" ]; then
  git reset -q --hard "origin/$BRANCH" && git clean -fdq || fail "could not reset to origin/$BRANCH"
  if ! git -c commit.gpgsign=false merge -q --no-edit origin/main >/dev/null 2>&1; then
    unmerged="$(git diff --name-only --diff-filter=U)"
    git merge --abort 2>/dev/null
    if [ -n "$unmerged" ]; then
      reason="Refresh branch conflicts with main in: ${(f)unmerged}. Resolve by hand."
    else
      reason="Merging main into the refresh branch failed."
    fi
    gh_ label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
    gh_ pr edit "$pr" --add-label needs-review >/dev/null || fail "could not label PR #$pr needs-review"
    gh_ pr comment "$pr" --body "$reason" >/dev/null
    fail "$reason"
  fi
  log "continuing open PR #$pr"
else
  git reset -q --hard "$ref" && git clean -fdq || fail "could not reset to $ref"
fi
check_worktree

outside="$(git diff --name-only --no-renames origin/main...HEAD)" || fail "could not list the branch's changes against main"
outside="$(print -r -- "$outside" | grep -v '^data/' | grep -v '^$' || true)"
if [ -n "$outside" ]; then
  reason="the refresh branch changes files outside data/ (${(f)outside}); not running its code"
  if [ -n "$pr" ]; then
    gh_ label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
    gh_ pr edit "$pr" --add-label needs-review >/dev/null || fail "could not label PR #$pr needs-review"
    gh_ pr comment "$pr" --body "Needs review: $reason." >/dev/null
  fi
  fail "$reason"
fi

stale_script=""
if ! cmp -s "$SELF" "$WORKTREE/scripts/local-refresh.sh"; then
  stale_script="the installed script differs from scripts/local-refresh.sh on main; re-run npm run local-refresh:install"
  log "WARNING: $stale_script"
fi

rm -f .env.local
if ! $dry_run; then
  [ -f "$SOURCE_REPO/.env.local" ] || fail "no .env.local in $SOURCE_REPO"
  grep -qE '^BAYBALLOT_ANTHROPIC_API_KEY=.' "$SOURCE_REPO/.env.local" ||
    fail "no BAYBALLOT_ANTHROPIC_API_KEY line in $SOURCE_REPO/.env.local"
  ( umask 077; grep -E '^BAYBALLOT_ANTHROPIC_API_KEY=' "$SOURCE_REPO/.env.local" | tail -n 1 > .env.local )
fi

lock_hash="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ "$(cat node_modules/.package-lock-hash 2>/dev/null)" != "$lock_hash" ]; then
  log "installing dependencies"
  npm ci --no-audit --no-fund --loglevel=error >/dev/null || fail "npm ci failed"
  print -r -- "$lock_hash" > node_modules/.package-lock-hash
fi
npx --no-install playwright install chromium >/dev/null 2>&1 || fail "playwright install failed"

git archive origin/main data | tar -x -C "$work" || fail "could not extract main's data as the baseline"

extra=()
$dry_run && extra=(--no-extract)
[ -f "$SHRUNK_STATE" ] && extra+=(--shrunk-state "$SHRUNK_STATE")
extra+=(--via "$MODEL_VIA")
npm run -s bb -- refresh --local-only --baseline "$work/data" --summary "$work/summary.md" --result "$work/result.json" "${extra[@]}"
code=$?
log "refresh exit code $code"
[ -f "$work/summary.md" ] && cat "$work/summary.md"
summary_line="$(grep -m1 '^\*\*Result:\*\*' "$work/summary.md" 2>/dev/null | sed 's/\*\*Result:\*\* //')"
[ -n "$summary_line" ] || summary_line="exit code $code"
api_cost="$(node -e 'try { console.log(require(process.argv[1]).apiCost ?? 0) } catch { console.log(0) }' "$work/result.json")"
if [ "$MODEL_VIA" = "claude-code" ] && [ "$api_cost" != "0" ]; then
  log "subscription usage limit reached; this run spent about \$$api_cost on the API"
  notify "Subscription limit reached: the refresh spent about \$$api_cost on the API"
fi

if [ -f "$work/result.json" ] && ! $dry_run; then
  node -e 'const r = require(process.argv[1]); console.log(JSON.stringify(Object.fromEntries(r.shrunk.map((s) => [s.id, s.pageHash]))))' \
    "$work/result.json" > "$work/shrunk.json" && mv "$work/shrunk.json" "$SHRUNK_STATE"
fi

data_changed="$(git status --porcelain -- 'data/*/endorsements' data/changelog)" || fail "git status failed"
extracted="$(node -e 'try { console.log(require(process.argv[1]).extracted.length) } catch { console.log(0) }' "$work/result.json")"

if $dry_run; then
  log "dry run: data changes the real run would start from:"
  git status --short -- data
  git checkout -q -- data && git clean -fdq -- data
  log "dry run done; worktree reset"
  exit "$code"
fi

issue="$(gh_ issue list --state open --author @me --search "in:title \"$ISSUE_TITLE\"" --json number,title \
  --jq "map(select(.title == \"$ISSUE_TITLE\")) | .[0].number // empty")" || fail "gh issue list failed"
if [ -n "$issue" ] && [ "$code" = "0" ] && [ -z "$stale_script" ]; then
  gh_ issue close "$issue" --comment "Local refresh $(date +%F) was clean; closing." >/dev/null || log "could not close issue #$issue"
  issue=""
fi

if [ -z "$data_changed" ] && [ "$extracted" = "0" ]; then
  git checkout -q -- data && git clean -fdq -- data
  if [ "$code" != "0" ] || [ -n "$stale_script" ]; then
    {
      cat "$work/summary.md" 2>/dev/null || print "The local refresh failed before writing a summary (exit code $code); see the log on Sean's Mac."
      [ -n "$stale_script" ] && print "\n**Warning:** $stale_script"
      print "\ncc @seanoliver"
    } > "$work/issue.md"
    if [ -n "$issue" ]; then
      gh_ issue edit "$issue" --body-file "$work/issue.md" >/dev/null || fail "could not update issue #$issue"
      gh_ issue comment "$issue" --body "Local refresh $(date +%F): exit code $code." >/dev/null
    else
      gh_ issue create --title "$ISSUE_TITLE" --body-file "$work/issue.md" >/dev/null || fail "could not open the review issue"
    fi
    log "no data to commit; review issue updated (exit code $code)"
    notify "Bay Ballot: local refresh needs review — $summary_line${stale_script:+ (installed script is out of date)}"
  else
    log "no relevant changes; nothing to commit"
  fi
  exit "$code"
fi

git add data
git -c commit.gpgsign=false commit -q -m "data: local refresh $(date +%F)" || fail "commit failed"
if [ -n "$pr" ]; then
  git push -q --no-follow-tags origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
else
  git push -q --no-follow-tags --force-with-lease origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
fi

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
[ "$code" = "0" ] || reasons+=("refresh exit code $code (2 = held picks, a changed unclear-match hold, or a shrunk result, 1 = error)")
# The contests behind the code, which a later run's body would no longer show.
review="$(node -e 'try { for (const r of require(process.argv[1]).review ?? []) console.log(r) } catch {}' "$work/result.json")"
[ -z "$review" ] || reasons+=("${(@f)review}")
outside="$(git diff --name-only --no-renames origin/main...HEAD)" || outside="(could not list the PR's files)"
outside="$(print -r -- "$outside" | grep -v '^data/' | grep -v '^$' || true)"
[ -z "$outside" ] || reasons+=("files outside data/: ${(f)outside}")
if [ ${#reasons} -gt 0 ]; then
  gh_ label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
  gh_ pr edit "$pr" --add-label needs-review >/dev/null || fail "could not label PR #$pr needs-review"
  gh_ pr comment "$pr" --body "Needs review: ${(j:; :)reasons}" >/dev/null
  log "PR #$pr needs review: ${(j:; :)reasons}"
fi

notify "Bay Ballot: local refresh PR #$pr ready — $summary_line${stale_script:+ (installed script is out of date)}"
[ "$code" = "0" ] && [ ${#reasons} -gt 0 ] && exit 2
exit "$code"
