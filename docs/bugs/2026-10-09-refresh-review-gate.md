# A fetch error hid held picks from the refresh merge gate

- **Date**: 2026-10-09
- **Area**: `src/pipeline/refresh.ts` (`exitCodeFor`, `resultJson`), `.github/workflows/refresh.yml` (gate job)

## Symptom

Refresh PR #91 had two held picks and one wrongly removed pick (Mercury News, Ross Town Council), but no `needs-review` label. Its comment said "the next clean run can merge it". Once CI passed, a quiet day's run could have auto-merged it unreviewed.

## Root cause

`exitCodeFor` returns 1 when any guide fails to fetch, before it checks for held or shrunk results (2). The gate job treated exit 1 as "a fetch error the next run can recover from" and only commented. The 2026-10-09 run had five fetch failures, so the held picks never reached the label. A removed pick or a verifier "missing" report never triggered review at all.

## Repro

`resultJson([{ status: "failed" }, { status: "changed", held: [...] }], 1)` had no field saying anything needed review, and the gate's exit-1 branch ran before any review check.

## Fix

- `reviewReasons(results)` in `src/pipeline/refresh.ts` lists held picks, shrunk guides, removed picks and verifier-missing picks. `resultJson` writes it as `review`.
- The refresh job exports `review`. The gate labels the PR `needs-review` and lists the reasons whenever it is non-empty, before it looks at the exit code.
- Runbook updated.

## Verification

- `npx vitest run`: 1021 passed, including new `reviewReasons` tests for a held pick next to a fetch failure, removed and missing picks, and shrunk guides.
- The gate's shell block, run with a stubbed `gh`: with a held pick and exit 1 it labels the PR and lists the reason; with an empty list and exit 1 it only comments, as before.
- `actionlint` passes.

## Guardrail

The gate checks `review` before the exit code, and `tests/refresh.test.ts` covers a held pick alongside a fetch failure. The refresh job also labels the PR as soon as it opens or updates it (#103), so the label holds even if `gate` never runs.
