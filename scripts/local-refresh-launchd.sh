#!/bin/zsh
set -eu

LABEL="com.bayballot.local-refresh"
HERE="${0:A:h}"
SUPPORT="$HOME/Library/Application Support/bay-ballot"
SCRIPT="$SUPPORT/local-refresh.sh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/bay-ballot-refresh.log"
DOMAIN="gui/$(id -u)"

case "${1:-}" in
  install)
    dirs=()
    for cmd in node npm npx gh git pdftotext; do
      found="$(command -v "$cmd")" || { echo "$cmd not found on PATH; install it first" >&2; exit 1; }
      dirs+=("${found:h}")
    done
    unique=(${(u)dirs})
    job_path="${(j.:.)unique}:/usr/bin:/bin:/usr/sbin:/sbin"
    mkdir -p "$SUPPORT" "${PLIST:h}" "${LOG:h}"
    # Run a copy: zsh reads a script as it runs, so a checkout rewriting it mid-run breaks the run.
    cp "$HERE/local-refresh.sh" "$SCRIPT"
    chmod +x "$SCRIPT"
    sed -e "s|__SCRIPT__|'$SCRIPT'|" -e "s|__LOG__|$LOG|" -e "s|__PATH__|$job_path|" "$HERE/$LABEL.plist" > "$PLIST"
    plutil -lint "$PLIST" >/dev/null
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Installed $LABEL: runs daily at 07:00; log at $LOG"
    echo "Run it now with: launchctl kickstart $DOMAIN/$LABEL"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST" "$SCRIPT"
    echo "Removed $LABEL (the log and the refresh worktree are left in place)"
    ;;
  *)
    echo "usage: $0 install|uninstall" >&2
    exit 64
    ;;
esac
