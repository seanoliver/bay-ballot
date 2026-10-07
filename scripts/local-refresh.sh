#!/bin/zsh
# Daily refresh of the guides whose sites block GitHub's runners (fetchFrom: local).
# Runs in its own worktree, opens or updates one PR, and lets it auto-merge only when clean.
#
#   scripts/local-refresh.sh             refresh and open/update the PR
#   scripts/local-refresh.sh --dry-run   fetch and gate pages only: no model calls, no commit, no PR
#   --ref <git ref>                      start from this ref instead of origin/main (for testing a branch)
set -u
setopt pipe_fail

SOURCE_REPO="$HOME/code/projects/bay-ballot"
WORKTREE="$HOME/code/projects/bay-ballot-refresh"
BRANCH="data/refresh-local"
LOG="$HOME/Library/Logs/bay-ballot-refresh.log"
LOCK="${TMPDIR:-/tmp}/bay-ballot-local-refresh.lock"
MAX_LOG_LINES=5000

dry_run=false
ref="origin/main"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=true ;;
    --ref) ref="$2"; shift ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
  shift
done

mkdir -p "${LOG:h}"
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt "$MAX_LOG_LINES" ]; then
  # Rewrite in place (same file) so launchd's open handle keeps appending to it.
  trimmed="$(tail -n $((MAX_LOG_LINES / 2)) "$LOG")"
  print -r -- "$trimmed" > "$LOG"
fi
# Under launchd the plist already sends stdout and stderr to the log.
if [ "${BAYBALLOT_LAUNCHD:-}" != "1" ]; then exec > >(tee -a "$LOG") 2>&1; fi

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
fail() { log "ERROR: $*"; exit 1; }

if ! mkdir "$LOCK" 2>/dev/null; then log "another local refresh is running; exiting"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

log "local refresh starting (dry run: $dry_run, ref: $ref)"
for cmd in git gh node npm; do command -v "$cmd" >/dev/null || fail "$cmd not on PATH"; done
[ -d "$SOURCE_REPO/.git" ] || fail "$SOURCE_REPO is not a git checkout"

git -C "$SOURCE_REPO" fetch -q --prune origin || fail "git fetch failed"
if [ ! -d "$WORKTREE" ]; then
  git -C "$SOURCE_REPO" worktree add -q --detach "$WORKTREE" "$ref" || fail "could not create $WORKTREE"
fi
cd "$WORKTREE" || fail "no $WORKTREE"

# One PR at a time: continue our own open PR's branch (its page text and held picks are the
# baseline) with main merged in; otherwise start from main.
pr="$(gh pr list --head "$BRANCH" --state open --json number,isCrossRepository \
  --jq 'map(select(.isCrossRepository | not)) | .[0].number // empty')" || fail "gh pr list failed"
if [ -n "$pr" ] && [ "$ref" = "origin/main" ]; then
  git reset -q --hard "origin/$BRANCH" && git clean -fdq || fail "could not reset to origin/$BRANCH"
  if ! git merge -q --no-edit origin/main; then
    git merge --abort
    log "refresh branch conflicts with main"
    if ! $dry_run; then
      gh label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
      gh pr edit "$pr" --add-label needs-review >/dev/null
      gh pr comment "$pr" --body "Refresh branch conflicts with main; resolve by hand." >/dev/null
    fi
    exit 1
  fi
  log "continuing open PR #$pr"
else
  git reset -q --hard "$ref" && git clean -fdq || fail "could not reset to $ref"
fi

[ -f .env.local ] || cp -n "$SOURCE_REPO/.env.local" .env.local 2>/dev/null || $dry_run || fail "no .env.local in $SOURCE_REPO"

lock_hash="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ "$(cat node_modules/.package-lock-hash 2>/dev/null)" != "$lock_hash" ]; then
  log "installing dependencies"
  npm ci --no-audit --no-fund --loglevel=error || fail "npm ci failed"
  print -r -- "$lock_hash" > node_modules/.package-lock-hash
fi

work="$(mktemp -d)"
trap 'rmdir "$LOCK" 2>/dev/null; rm -rf "$work"' EXIT
git archive origin/main data | tar -x -C "$work" || fail "could not extract main's data as the baseline"

extra=()
$dry_run && extra=(--no-extract)
npm run -s bb -- refresh --local-only --baseline "$work/data" --summary "$work/summary.md" --result "$work/result.json" "${extra[@]}"
code=$?
log "refresh exit code $code"
[ -f "$work/summary.md" ] && cat "$work/summary.md"

data_changed="$(git status --porcelain -- 'data/*/endorsements' data/changelog)"
extracted="$(node -e "try { console.log(require('$work/result.json').extracted.length) } catch { console.log(0) }")"

if $dry_run; then
  log "dry run: data changes the real run would start from:"
  git status --short -- data
  git checkout -q -- data && git clean -fdq -- data
  log "dry run done; worktree reset"
  exit 0
fi

if [ -z "$data_changed" ] && [ "$extracted" = "0" ]; then
  git checkout -q -- data && git clean -fdq -- data
  log "no relevant changes; nothing to commit"
  exit $([ "$code" = "1" ] && echo 1 || echo 0)
fi

git add data
git commit -q -m "data: local refresh $(date +%F)" || fail "commit failed"
if [ -n "$pr" ]; then
  git push -q origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
else
  git push -q --force-with-lease origin "HEAD:refs/heads/$BRANCH" || fail "push failed"
fi

{ cat "$work/summary.md"; print; print "cc @seanoliver"; } > "$work/pr-body.md"
if [ -n "$pr" ]; then
  gh pr edit "$pr" --body-file "$work/pr-body.md" >/dev/null || fail "could not update PR #$pr"
  gh pr comment "$pr" --body "New local refresh $(date +%F) (exit code $code); summary above is updated." >/dev/null
else
  url="$(gh pr create --base main --head "$BRANCH" --title "data: local refresh" --body-file "$work/pr-body.md")" || fail "gh pr create failed"
  pr="${url##*/}"
fi
log "PR #$pr updated"

outside="$(gh pr view "$pr" --json files --jq '.files[].path' | grep -v '^data/' || true)"
labels="$(gh pr view "$pr" --json labels --jq '[.labels[].name] | join(",")')"
if [ "$code" = "0" ] && [ -z "$outside" ] && [[ ",$labels," != *",needs-review,"* ]]; then
  gh pr merge "$pr" --auto --squash --delete-branch >/dev/null || fail "could not enable auto-merge on PR #$pr"
  log "auto-merge enabled on PR #$pr (merges after the required checks pass)"
else
  reason="refresh exit code $code"
  [ -n "$outside" ] && reason="$reason; files outside data/: $(print -r -- "$outside" | tr '\n' ' ')"
  gh label create needs-review --color d93f0b --description "Data refresh needs a human look" --force >/dev/null
  gh pr edit "$pr" --add-label needs-review >/dev/null
  gh pr comment "$pr" --body "Not auto-merged: $reason (2 = held picks or a shrunk result, 1 = error)." >/dev/null
  log "PR #$pr needs review: $reason"
fi
exit $([ "$code" = "1" ] && echo 1 || echo 0)
