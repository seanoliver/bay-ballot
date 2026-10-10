# Running local model calls through Claude Code

Investigated 2026-10-10 (Pacific), for issue #63 ("option 1"): let local `bb extract`, `bb refresh`, `bb verify` and `scripts/local-refresh.sh` make their model calls through Claude Code headless (`claude -p`) on Sean's personal subscription, with the API as fallback. The GitHub job stays on the API.

## Context

Heavy local runs (county launches, widening guides) bill the API key; the six-county launch cost roughly $15-25. The pipeline's only model seam is `ExtractClient` (`messages.stream(params).finalMessage()`), used by `extract()` and `verify()`. The new client implements that seam, so prompts, schemas, quote checks, placement checks and verifier logic don't change.

## Key findings

- **Structured output works.** `--json-schema` returns the parsed object in the result's `structured_output` field. Claude Code implements it as a `StructuredOutput` tool: the result's `stop_reason` is `tool_use` and `num_turns` is 2. The CLI validates against the schema and retries internally; if it gives up, the result subtype is `error_max_structured_output_retries`. The client still re-validates the object against the request's own schema (`z.fromJSONSchema`), since the callers rely on enums and nullables.
- **PDFs need stream-json.** Plain `-p` stdin is text only, and some guides send base64 PDF `document` blocks. `--input-format stream-json` takes a user message with the same content blocks the API gets, and it requires `--output-format stream-json` (`Error: --input-format=stream-json requires output-format=stream-json`), plus `--verbose`. The client reads the last `result` line. A test PDF's text was read correctly this way.
- **The models stay distinct.** `--model claude-sonnet-5-5` and `--model claude-opus-5-5` are accepted as full names. The verifier's `output_config.effort: "high"` maps to `--effort high`; extract sets no effort, as on the API.
- **Usage is reported.** The result carries `usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens` and `cache_read_input_tokens`, and a `total_cost_usd` at list price, which is not what the subscription is billed. Prompt caching works across separate CLI calls: a second verify of the same guide read 15,805 tokens from cache.
- **Subscription status is visible.** Each run emits a `rate_limit_event` line (`status: "allowed"`, `rateLimitType: "five_hour"`, utilization). A rejected status is treated as "usage limit reached".

## How it works

`src/pipeline/claudecode.ts`, `claudeCodeClient({ fallback })`:

- **Binary:** `CLAUDE_BIN`, else `~/.local/bin/claude` (the native install), else `claude` on PATH. Spawned directly, never through a shell, so Sean's `claude` alias for the work account can't apply.
- **Flags (checked against `claude --help`, v2.1.296):** `-p --input-format stream-json --output-format stream-json --verbose --model <request model> --system-prompt-file <tmp> --tools "" --strict-mcp-config --safe-mode --setting-sources "" --no-session-persistence --json-schema <schema> --effort <effort>`.
  - `--effort` is always passed: the request's effort, else the API's default for the model (`high` for Sonnet 5.5, `medium` for Opus 5.5 and Haiku 5.5, per the API's effort docs). Without it Claude Code uses the user's `effortLevel` setting; see "Quality comparison".
  - `--setting-sources ""` loads no user, project or local settings file, so their `effortLevel`, `model` or `env` can't change the call. The login still works.
  - `--system-prompt-file` replaces the default system prompt, like `--system-prompt`. It isn't listed in `--help`, but `--bare`'s help text names `--system-prompt[-file]` and a test call confirmed it. A file because the extract prompt holds the guide's ballot as JSON (97 KB for the whole ballot), too long to pass safely as one argument.
  - `--tools ""` leaves only `StructuredOutput` (the init line lists `"tools": ["StructuredOutput"]`).
  - `--safe-mode` turns off CLAUDE.md, skills, plugins, hooks and MCP servers while keeping the normal login. Not `--bare`: it reads only `ANTHROPIC_API_KEY` or an `apiKeyHelper`, never the subscription login.
  - The user message goes on stdin as one stream-json line. The working directory is an empty temp dir.
- **Environment:** every `ANTHROPIC_*` and `CLAUDE_CODE_*` variable, `CLAUDE_CONFIG_DIR` and `BAYBALLOT_ANTHROPIC_API_KEY` are removed; `CLAUDE_CONFIG_DIR` is set to `~/.claude-personal` (or `BAYBALLOT_CLAUDE_CONFIG_DIR`), and `CLAUDE_CODE_MAX_OUTPUT_TOKENS` to the request's `max_tokens`. A stray `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` or Bedrock/Vertex switch would otherwise decide who pays.
- **Result mapping:** one text block holding `JSON.stringify(structured_output)`, which is what `extract()` and `verify()` parse; `stop_reason` `end_turn` (or `refusal` / `max_tokens` passed through); usage from the CLI, zero where absent. The usage object is marked as subscription usage, so `costOf` doesn't price it and the summary says "$0.40 API, plus 6 calls on the Claude subscription".
- **Fallback:** CLI missing, not logged in (`error: "authentication_failed"`), usage limit (`rate_limit` / `billing_error` or a rejected rate-limit event): this call and the rest of the run go to the API, logged once. Timeout (30 minutes) or other failure: this call only. Output that fails the schema is retried once, then that call falls back. A refusal is returned to the caller, which throws as it does on the API path. `--no-fallback` throws instead.
- **Switch:** `--via api|claude-code` on `extract`, `refresh` and `verify`, or `BAYBALLOT_MODEL_VIA`; default `api`. `local-refresh.sh` passes `BAYBALLOT_MODEL_VIA` through as `--via`, and `npm run local-refresh:install` records it in the launchd job when set in the installing shell.

## Terms and limits

- Anthropic's help article "Use the Claude Agent SDK with your Claude plan" (update of 2026-10-07) says Max and Team plans now include monthly API credits covering `claude -p`, and "You can still use the Claude Agent SDK, `claude -p`, and third-party apps with your subscription limits." Its 2026-06-15 note says the earlier plan to move `claude -p` to a separate credit was paused.
- This use is Sean running Claude Code himself on his own Mac with his own login. CI keeps the API key: the GitHub job never passes `--via`, and a subscription login shouldn't be copied to shared runners.
- `claude -p` usage draws from the same five-hour and weekly limits as interactive use. A burst of ~20 guides is about 40 calls; when the limit is hit, the run finishes on the API (or fails per guide with `--no-fallback`).
- `--json-schema` enforcement is Claude Code's, not the API's constrained decoding. The API path can't return schema-invalid JSON; the CLI path can, which is why the client re-validates and retries.
- No temperature or thinking control beyond `--effort`. The API path doesn't set temperature either.
- Claude Code adds about 580 input tokens of its own to every call, even with the system prompt replaced and no tools ("Be brief." / "Say hi." measured 596 input tokens; the API would see about 10). `--json-schema` adds about 490 more for the `StructuredOutput` tool. The model would not quote that text back, so what it says is unknown.

## Smoke test

One guide (bike-east-bay, 5 picks, one HTML page) in a throwaway copy of the repo with no `.env.local` and no API key in the environment, so no API call was possible:

- `bb extract bike-east-bay --force-extract --via claude-code --no-fallback`: 20 s wall time for fetch, extract (Sonnet) and verify (Opus). Structured output parsed; the quote checks ran and dropped three quotes (one not-standalone, two wrong-contest); the verifier confirmed all 5 picks. Summary line: "Estimated model cost $0.00 API, plus 2 calls on the Claude subscription".
- `bb verify bike-east-bay --via claude-code --no-fallback`: 10 s; "5 confirmed, 0 held, 0 quotes dropped, 0 missing (cache_read=15805 cache_write=363 in=2 out=938)". The CLI reported usage.
- No rate limiting was seen. Five-hour utilization was 11% before the smoke test.
- One quality note: the Claude Code extract kept "Without Measure RTM's operations funding, the Bay Area will face a true emergency:", a sentence ending in a colon, which the verifier confirmed. No API run was made to compare, so this may be ordinary run-to-run variation.

## Quality comparison

The coordinator ran spur, ca-wfp and east-bay-dsa with `--force-extract` on both paths from the same commit. Picks were identical on base, API and Claude Code for all three. Quotes were not:

| Guide | Committed | API | Claude Code, before fix | Claude Code, after fix |
|---|---|---|---|---|
| spur | 50 | 54 | 21 | 30 |
| east-bay-dsa | 27 | 31 | 0 | 11 |
| ca-wfp | 0 | 0 | 0 | not rerun |

The quote checks were not the cause: the Claude Code run of east-bay-dsa dropped no quotes, because the model returned none.

**Root cause (confirmed): effort.** The extract request sets no effort, so the API uses Sonnet 5.5's default, `high`. Claude Code instead applied `"effortLevel": "medium"` from `~/.claude-personal/settings.json`; `--safe-mode` doesn't skip settings. Raw output for east-bay-dsa, same pages and prompt, captured from the CLI before `toEntries`:

- Before (medium): 64 picks, 0 quotes; 952 thinking tokens, 4,862 output tokens.
- With `--effort high`: 64 picks, 40 quotes; 4,103 thinking tokens, 8,881 output tokens.

**Repeat runs after the fix.** Extract only (no verifier), on one cached copy of each guide's pages, counting quotes the extractor returned and quotes that passed the code checks:

| Guide | API (1 run) | Claude Code (3 runs) | Claude Code, schema in prompt (3 runs) |
|---|---|---|---|
| east-bay-dsa, 43 picks | 27 raw, 26 kept | 24 / 36 / 23 raw; 22 / 34 / 21 kept | 48 / 36 / 43 raw; 46 / 33 / 41 kept |
| spur, 23 picks | 56 raw, 55 kept | 36 / 47 / 41 raw; 35 / 46 / 41 kept | 27 / 29 / 31 raw, all kept |

Picks were identical in every run. On spur every pick kept at least one quote on both paths, so the gap is fewer quotes per pick (about 1.8 against 2.4). On east-bay-dsa, picks without a quote were 17 on the API and 9 to 22 on Claude Code.

The earlier "11 quotes" was one low run followed by verifier drops: east-bay-dsa varies between runs on this path, and its average is close to the API's.

**Schema in the prompt (rejected).** Dropping `--json-schema` and putting the schema in the system prompt, so the answer arrives as plain text, raised east-bay-dsa and lowered spur. It also adds a parse step the API path doesn't have. The code was not kept.

Treat `--via claude-code` as giving the same picks, and on some guides about a quarter fewer quotes per pick. That is fine for new guides and widening. For a run whose main purpose is quotes, use the API.

## Gotchas

- `--safe-mode` keeps the user's settings files. Without `--setting-sources ""`, `effortLevel` and `env` from `~/.claude-personal/settings.json` applied to every call.
- In this sandboxed agent environment, a `#!/usr/bin/env node` script given an argument over ~1,000 characters was SIGKILLed on exec (exit 137), from a shell, from tsx and from vitest. The real Claude Code binary was not affected with a 3 KB `--json-schema`. Tests use `#!/bin/sh` stubs for that reason.
- A not-logged-in CLI exits 1 but still prints a `result` line with `is_error: true` and `result: "Not logged in · Please run /login"`, and `subtype: "success"`. Check `is_error`, not `subtype`.
- The launchd job needs the personal login readable from a background session (macOS keychain). Run `BAYBALLOT_MODEL_VIA=claude-code npm run local-refresh` by hand once before relying on the scheduled job.

## References

- Issue #63
- `src/pipeline/claudecode.ts`, `tests/claudecode.test.ts`
- https://code.claude.com/docs/en/headless (structured output, `--bare` auth, result fields)
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
