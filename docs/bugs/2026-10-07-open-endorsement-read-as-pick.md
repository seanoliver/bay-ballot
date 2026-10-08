# "Open Endorsement" read as a pick

- **Date**: 2026-10-07
- **Area**: `src/pipeline/extract.ts`, `src/pipeline/verify.ts` (extraction and verification prompts)

## Symptom

When South Bay Labor was widened to Santa Clara County, the extractor turned its "Open Endorsement" candidates into picks:
- San Jose D7 came out as Doan **and** Van Le. The page says "Bien Doan — Sole Endorsement / Van Le — Open Endorsement".
- Alum Rock TA3, MHUSD TA3 and WVM TA7 became two-name picks the same way.
- County Board of Education TA7 (Lari) and Campbell Union SD TA4 (Vora) got picks, although each lists only an "Open Endorsement".

The verifier confirmed all of these.

## Root cause

Neither prompt said what "Open Endorsement" means. In labor-council slates it marks a candidate the council lets members support but does not itself endorse. The models read it as a weaker endorsement and listed the candidate as part of a dual pick.

## Repro

On the old prompts, run `npm run bb -- extract south-bay-labor --only-areas santa-clara-county,san-jose` against https://www.southbaylabor.org/2026_endorsements. The six contests above come back with the open candidates included.

## Fix

- The extraction prompt now says: a candidate labelled "Open Endorsement" (or "Open" in a column of endorsement statuses) is not endorsed. Leave that candidate out, and skip the contest if no one else is endorsed. An "open seat" (a vacancy) does not affect the pick.
- The verifier's wrong-pick rule says the same.
- South Bay Labor was re-extracted for Santa Clara only. Results:
  - D7 is Doan alone; Alum Rock TA3 Oseguera, MHUSD TA3 Cohen, WVM TA7 Robb.
  - County BOE TA7 and Campbell Union SD TA4 have no pick.

## Verification

- The re-run's diff shows exactly those six contests changing.
- `tests/verify.test.ts` asserts both prompt sentences ("open endorsements in the extraction prompt" and the verifierPrompt case).

## Guardrail

- The prompt tests above fail if the wording is dropped or loosened back to a bare "Open".
- The Alameda Labor Council uses the same label, and its next extraction gets the same rule.
