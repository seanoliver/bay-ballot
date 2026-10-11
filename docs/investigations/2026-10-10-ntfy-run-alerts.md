# Phone pushes for refresh runs through ntfy

Investigated 2026-10-10 (Pacific), while adding run reports and phone alerts to the daily refresh (`bb notify`, `scripts/append-run.sh`).

## Context

The refresh already opens GitHub issues and macOS notifications, but nothing reaches a phone, and a run that quietly stops working (an expired subscription token) shows up only as a review issue. ntfy publishes a push with one HTTP POST and no account, which suits a script that runs in CI and on a Mac.

## Key findings

Checked against https://docs.ntfy.sh/publish/ and https://docs.ntfy.sh/emojis/, then by posting to a random throwaway topic on ntfy.sh and reading it back.

- **Publish:** `POST https://ntfy.sh/<topic>` with the message as the plain-text body. Topics are created on first use.
- **Headers:** `Title` (alias of `X-Title`), `Priority` (alias of `X-Priority`; 1 to 5, or `min`, `low`, `default`, `high`, `max`/`urgent`; 3 when unset), `Tags` (alias of `X-Tags`; comma-separated), `Click` (alias of `X-Click`; a URL opened on tap).
- **Tags:** a tag that is an emoji short code becomes that emoji before the title. `white_check_mark`, `eyes` and `rotating_light` are on the emoji list.
- **Response:** HTTP 200 with the stored message as JSON. A test post returned `"title":"Bay Ballot refresh: clean"`, `"priority":2`, `"tags":["white_check_mark"]` and the `click` URL, so all four headers were read as intended.
- **Non-ASCII headers:** ntfy reads UTF-8 headers, and RFC 2047 encoded words (`=?UTF-8?B?<base64>?=`). A test title encoded that way came back as the original text. Node's `fetch` rejects header values outside Latin-1, so `bb notify` encodes any title that is not plain ASCII.
- **Size:** a message over 4,096 bytes is turned into an attachment. The body is cut to 4,000 characters; a digest and a few alerts are far below that.
- **Privacy:** "all topics on ntfy.sh are public", and the docs call the topic name "essentially a password". Topic names are letters, numbers, `_` and `-`, up to 64 characters.

## How it works

- `bb refresh` writes the run report into `result.json` (`src/pipeline/report.ts`): counts, calls, tokens, API-rate cost, Claude Code failures, a one-line digest and alerts.
- `bb notify` (`src/pipeline/notify.ts`) maps the alerts to a push: no alert is priority 2 with `white_check_mark`, a review alert is 3 with `eyes`, a high alert or a missing `result.json` is 5 with `rotating_light`. It posts with a 10 second `AbortSignal.timeout`, and any error only prints a warning.
- The local job uses `curl` with the same headers for failures before the worktree holds main's code, since it must not run that branch's `bb` yet.

## Gotchas

- Priority 2 is "low": on Android it makes no sound or vibration, and iOS shows it quietly. A clean run should be easy to ignore.
- Rate limits for publishing on ntfy.sh are not stated on the publish page. One or two posts a day is far from any limit the docs describe for e-mail (5 a day).
- Anyone with the topic can also post to it, so a push is not proof that a run happened. The `runs` branch history is the record.

## References

- https://docs.ntfy.sh/publish/
- https://docs.ntfy.sh/emojis/
- `docs/runbook.md`, "Run reports and alerts"
