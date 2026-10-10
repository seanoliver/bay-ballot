# A re-extract releases picks held by hand

- **Date**: 2026-10-09
- **Area**: `src/pipeline/verify.ts`, `src/pipeline/write.ts`, `src/pipeline/refresh.ts`

## Symptom

`npm run bb -- extract sv-dsa --only-areas san-mateo` removed sv-dsa's `held` entry for `smcccd-measure-v`, held by hand on 2026-10-07, and published the pick as `Y`. The daily refresh runs the same code, so it would publish any hand-made hold the same way, and the change would look like an ordinary added pick (#119).

## Root cause

Hold reasons were all verifier verdicts, so nothing marked a hold as a person's decision. The extract returned the same `Y`, so `nextFile` kept the hold. The hold then triggered a verify run, the verifier confirmed the pick from the page ("Yes on all school bond measures"), and `applyVerdicts` released every confirmed hold back into `picks`.

## Repro

On a commit before this fix, run the extract above and diff `data/2026-11/endorsements/sv-dsa.yml`: the `held` entry is gone and `smcccd-measure-v: pick: Y` is added. Cost about $0.63.

## Fix

- `src/lib/schema.ts`: new hold reason `unclear-match`, for a person's decision that the guide's text may not mean this contest.
- `src/pipeline/verify.ts`: `unclear-match` holds are not sent to the verifier and are never released or re-labeled.
- `src/pipeline/write.ts`: `nextFile` keeps an `unclear-match` hold even when the extracted pick changes.
- `src/pipeline/refresh.ts`: these holds don't trigger a verify. When the guide now picks differently or no longer picks the contest, `review` gets "unclear-match hold on …", the PR body and log say so, and the exit code is 2, so both the cloud refresh and `scripts/local-refresh.sh` label the PR for a person.
- Data: the four holds made in review (sv-dsa `smcccd-measure-v`, eqca `orchard-sd-trustee`, ca-wfp `santa-clara-mayor`, mercury-news `prop-40`) moved from `unverified` to `unclear-match`.

## Verification

- `npx vitest run`: 1058 passed, including new tests in `tests/write.test.ts`, `tests/verify.test.ts`, and `tests/refresh.test.ts`.
- The refresh test re-extracts a guide with an `unclear-match` hold and the same pick: only the extract model runs, the hold stays, and `review` is empty. With a different pick, the hold stays and `review` names it.

## Guardrail

The tests above. The runbook's "Holding a pick by hand" section says to use `unclear-match` for any hold a person makes.
