# Page gate missed verdict flips and order changes

**Date:** 2026-10-06
**Area:** `src/pipeline/pagestore.ts` (the check that decides whether a daily refresh re-extracts a guide)
**Found by:** independent review, before the daily refresh went live

## Symptom

The refresh decides whether to call the model by comparing a guide's page with its stored page text. Some real pick changes were classified as "same" or "irrelevant", so the refresh would have skipped re-extraction and the site would have kept publishing the old pick.

## Root cause

Four separate problems in page-text normalization and comparison:

1. **Duplicate lines were dropped.** On slates that print each measure's heading followed by a bare `YES` or `NO` line, only the first `YES` and the first `NO` survived. Flipping Prop C from `YES` to `NO` changed nothing in the stored text. The stored text for noe-valley-dems showed this: one `YES`, one `NO` for eleven measures.
2. **Lines were compared as sets.** Order was invisible, so two measures swapping verdicts looked identical.
3. **Whole "Updated / Posted / Published / Edited" lines were deleted** to strip freshness stamps. "Updated Oct 5: we now recommend No on Prop G" vanished with them.
4. **Boilerplate lines were deleted unconditionally.** Any short line containing "sign up", "subscribe" and similar went, even "Yes - sign up to volunteer".

## Reproduction

Each case is a test in `tests/pagestore.test.ts` under "relevantChange: real pick changes the gate must see". Before the fix, all of them returned "same" or "irrelevant":

- heading-then-bare-verdict layout, Prop C `YES` → `NO`
- Prop A and Prop B verdicts swap
- an "Updated Oct 5: … No on Prop G" line is added
- "Yes - sign up to volunteer" → "No - sign up to volunteer"

## Fix

- Stored text keeps duplicate lines and their order.
- Pages are compared with an ordered line diff (longest common subsequence, after trimming the common prefix and suffix).
- A changed line is relevant if it:
  - carries a verdict at its start (yes, no, support, oppose, neutral, "No position", check or cross marks),
  - contains an endorsement word,
  - mentions a contest or candidate,
  - or is a short label (4 words or fewer) within 3 lines below a contest or candidate line.
- For "Updated …" style lines, only the prefix and date are removed. The line is dropped only if nothing else is left.
- Boilerplate patterns remove a line only when it carries no verdict, endorsement word or contest/candidate mention. Breadcrumb navigation is always removed.
- The stored page text for every guide was re-seeded in the new format (fetch only, no model calls).

## Verification

- The four reproduction tests and a short-label test pass. The existing tests that dates, counters, banners, whitespace and unrelated text stay "irrelevant" still pass.
- Same-minute re-fetch after re-seeding: 31 guides "same" and 1 "irrelevant" (bay-area-reporter, whose pages carry a rotating ad and related-story widget).
  - The first re-fetch flagged bay-area-reporter as relevant. Keeping duplicates exposed a second copy of an editorial's title inside the widget; it disappeared on re-fetch and contains "recommendations".
  - Follow-up rule: a long line (more than 4 words, not a verdict) that still appears elsewhere in the other version only moved or lost a duplicate copy, so it does not count. Verdicts and short labels still count when they move, which keeps swaps visible.

## Recurrence guardrail

- Any change to `normalizePageText` or `relevantChange` must keep the "real pick changes" tests green. Those tests encode the layouts that broke here.
- Normalization may remove noise but must never drop lines that can carry a pick (verdicts, endorsement words, contest or candidate mentions), and must never reorder or deduplicate.
