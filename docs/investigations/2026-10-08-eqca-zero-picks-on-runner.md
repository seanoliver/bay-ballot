# eqca returned 0 picks on the GitHub refresh

Investigated 2026-10-08 (Pacific), after refresh run 37884707139 opened PR #91.

## Context

The daily refresh reported `eqca: 0 picks (previous 50), file left unchanged`. The shrink guard kept the old picks, so the site was unaffected. This was eqca's first refresh on a runner: the guide arrived with the county launches (#57 to #60).

## Key findings

- **The live page is fine.** `https://www.eqca.org/our-endorsements/` redirects to `/elections/` and lists the general-election endorsements, plus a few new ones.
- **Local extraction is fine.** `npm run bb -- extract eqca --force-extract` on a home connection returned the same 50 picks, and `verify` confirmed all 50.
- **The runner got a different page.** The refresh stores a hash of the page text it extracted (the `shrunk-state` comment on issue #25). The runner's hash was `663e8c3f…`, and the same computation on the locally fetched page gave `55299b5a…`.
- **The runner's page had almost no content.** Fetch, extraction and the shrink check for eqca took 1.7 seconds in the run log. An extraction of the real 20,000-character page takes far longer.

The exact page the runner received was not saved, so the bot-wall explanation is inferred from the hash and the timing.

## How it works

`fetchSource` retries in Chromium only on a 403, 429 or 503 or a recognized wall page. eqca answered 200 with an unrecognized page, so the text went straight to the gate. The gate saw contest lines disappear (a relevant change), extraction found nothing, and `shrinkWarning` refused to write 0 picks.

## Fix

eqca is marked `fetchFrom: local`, like cadc and sf-chronicle, so the job on Sean's Mac refreshes it. The stored page text is updated to the 2026-10-08 home fetch, so that job sees no change and does not re-extract.

## Gotchas

- Re-extracting eqca drops the held `orchard-sd-trustee` pick and its review note ("Lyseria Kursave" is not a ballot name). The endorsement file was left as it was on main to keep that note.
- A 200 response with no endorsements looks like a guide withdrawing its picks. The shrink guard is the only thing that catches it.

## References

- Refresh run: https://github.com/seanoliver/bay-ballot/actions/runs/37884707139
- Refresh PR #91, review issue #25
- `src/pipeline/refresh.ts` (per-guide flow), `src/pipeline/write.ts` (`shrinkWarning`)
