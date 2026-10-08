# Page gate slow enough to time out CI

- **Date**: 2026-10-08
- **Area**: `src/pipeline/pagestore.ts` (`relevantChange`, `pageGate`), `src/pipeline/placement.ts` (`contestMarkers`)

## Symptom

`tests/pagestore.test.ts` "ignores date, relative-time, counter and boilerplate changes" took about 1.4s locally (1.7s with Alameda's contests) against about 20ms for its neighbours, and passed vitest's 5s default on GitHub runners, blocking PR #60. Any process that gates pages pays the same cost, including the daily refresh.

## Root cause

Not building patterns once per changed line: `relevantChange` built its markers once per call (three times, counting the two `normalizePageText` calls), and a warm rebuild costs only about 3ms. Nearly all the time was V8 compiling about 2,000 regexes (1,236 contest markers and the name and surname markers for 323 contests) the first time each one ran. V8 compiles a RegExp lazily on its first `exec` and compiles it again to native code on the second. Every marker ran against the first line of every page, so every one compiled, whatever the page said. Profiling on the 2026-11 ballot: building the contest markers cold took 139ms, their first and second runs 190ms each, and the first `normalizePageText` with a ballot 650ms.

Joining the markers into one alternation per flag set made it worse. A 237k-character pattern took 1.75s to compile, because compile time grows faster than pattern length.

## Repro

On `4dc1a88`, run `npx vitest run tests/pagestore-speed.test.ts` from this fix. Gating a 199-line new page plus one candidate line takes about 1.75s of CPU and fails the 1.5s bound.

## Fix

- Every candidate-name marker now carries a needle: one whole lowercased word that any match must contain (`Matcher`, `needleOf`, `lowerWords` in `placement.ts`). `contestMarkerSet` returns those matchers, and `contestMarkers` still returns plain RegExps for its other callers.
- `ballotMarkers` in `pagestore.ts` sorts markers into `always` (no needle: headings, districts, measures) and `byNeedle`, and caches the result per ballot object (WeakMap) and aliases key. `hits` runs the `always` regexes, then only the regexes whose needle is a word on the line. Most name regexes never run, so they never compile.

## Verification

- Old against new on every line of every stored page (25k lines, each also uppercased and lowercased, with and without an extra alias), probing both the single-line gate and the contest-or-candidate `mentions` check: all 88,854 probes agreed (scratch test, not committed).
- "ignores date…" test: 1359ms before, about 460ms after. 200-line cold gate: about 1.75s of CPU before, about 0.52s after.
- `npx vitest run` with the default timeout, `npx tsc --noEmit` and `npx eslint` all pass.

## Guardrail

`tests/pagestore-speed.test.ts` gates a 200-line new page from a cold start in its own file. It fails above 1.5s of worker CPU time locally, or 4s under `CI`. CPU time rather than wall time, because the parallel suite pushed wall time to 1.6s. Any marker added with a needle must match text that contains that word verbatim, apart from case, between word boundaries. If not, leave the needle off.
