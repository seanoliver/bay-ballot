#!/bin/zsh
# Install or remove the launchd job that runs scripts/local-refresh.sh daily at 07:00.
#   npm run local-refresh:install     copies the script to a stable location and loads the job
#   npm run local-refresh:uninstall   unloads the job and removes the copies
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
    mkdir -p "$SUPPORT" "${PLIST:h}" "${LOG:h}"
    # A copy, so resetting the refresh worktree never rewrites the script while it runs.
    cp "$HERE/local-refresh.sh" "$SCRIPT"
    chmod +x "$SCRIPT"
    sed -e "s|__SCRIPT__|'$SCRIPT'|" -e "s|__LOG__|$LOG|" "$HERE/$LABEL.plist" > "$PLIST"
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
