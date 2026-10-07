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
    # launchd starts with a bare PATH; record where this shell finds each tool the job needs.
    dirs=()
    for cmd in node npm npx gh git pdftotext; do
      found="$(command -v "$cmd")" || { echo "$cmd not found on PATH; install it first" >&2; exit 1; }
      [[ "$found" = /* ]] || { echo "$cmd resolves to '$found', not an absolute path; fix PATH first" >&2; exit 1; }
      dirs+=("${found:h}")
    done
    unique=(${(u)dirs})
    job_path="${(j.:.)unique}:/usr/bin:/bin:/usr/sbin:/sbin"

    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    mkdir -p "$SUPPORT" "${PLIST:h}" "${LOG:h}"
    # Run a copy, replaced atomically: zsh reads a script as it runs.
    tmp_script="$(mktemp "$SUPPORT/.local-refresh.XXXXXX")"
    cp "$HERE/local-refresh.sh" "$tmp_script"
    chmod 755 "$tmp_script"
    mv -f "$tmp_script" "$SCRIPT"

    tmp_plist="$(mktemp "${PLIST:h}/.$LABEL.XXXXXX")"
    cp "$HERE/$LABEL.plist" "$tmp_plist"
    args_json="$(node -e 'console.log(JSON.stringify(["/bin/zsh", process.argv[1]]))' "$SCRIPT")"
    plutil -replace ProgramArguments -json "$args_json" "$tmp_plist"
    plutil -replace StandardOutPath -string "$LOG" "$tmp_plist"
    plutil -replace StandardErrorPath -string "$LOG" "$tmp_plist"
    plutil -replace EnvironmentVariables.PATH -string "$job_path" "$tmp_plist"
    plutil -lint "$tmp_plist" >/dev/null
    mv -f "$tmp_plist" "$PLIST"

    # bootstrap can fail with EIO right after a bootout while launchd finishes tearing down.
    if ! launchctl bootstrap "$DOMAIN" "$PLIST" 2>"$SUPPORT/.bootstrap-error"; then
      grep -qi "input/output error\|: 5:" "$SUPPORT/.bootstrap-error" || { cat "$SUPPORT/.bootstrap-error" >&2; exit 1; }
      sleep 2
      launchctl bootstrap "$DOMAIN" "$PLIST"
    fi
    rm -f "$SUPPORT/.bootstrap-error"
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
