# Site-level SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give other sites easy reasons to link to Bay Ballot (a badge snippet on each guide page, a press section on About) and guard the county-page links Google relies on, while every contest stays indexable.

**Architecture:** One pure function builds the badge HTML snippet from a guide's id and name. The guide page and About page render small server components, styled to the design Sean picks from three mockups. A Playwright test pins the county-page links to contests. Pitches and weekly tracking are non-code tasks.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before using unfamiliar APIs), React server components, Tailwind with the tokens in `src/app/globals.css`, Vitest (`tests/`), Playwright (`e2e/`).

**Spec:** `docs/superpowers/specs/2026-10-30-site-level-seo-design.md`

## Global Constraints

- Ship after Nov 3, 2026. Don't merge any of this before election day.
- Every contest stays indexable. No `noindex`, no sitemap removals.
- Contact address: `corrections@bayballot.com`.
- No text that restates what the page already says.
- No recurring paid cost.
- Visible changes get one changelog file, `data/changelog/<YYYY-MM-DD>-<slug>.yml`, with `date`, `type: new`, `title`, and optional `details` and `pr`.
- UI tasks (3 and 4) don't start until Sean has picked a design in Task 2.
- No `Claude-Session:` trailer or claude.ai URL in commits or the PR.

## Review Focus

1. A guide name containing `&`, `<` or `"`. The snippet must HTML-escape it so the pasted code doesn't break the guide's site. Pinned in Task 3's unit test.
2. Copying when the clipboard API is refused (some in-app browsers). The snippet stays visible as selectable text, and the button says "Select the code above to copy". Pinned in Task 3's e2e test.
3. The snippet's link must be the canonical guide URL, `https://bayballot.com/guides/<id>`, with no trailing slash and no query string, so outside links point at the URL Google indexes. Pinned in Task 3's unit test.
4. A county page whose contest list renders client-side only would hide contest links from Google. Pinned in Task 1 by fetching raw HTML, not the hydrated page.
5. The badge and press section in dark mode: text and borders must use theme tokens. Covered by the screenshot check in Tasks 3 and 4.

---

### Task 1: Guard county-page links to contests

**Files:**
- Modify: `e2e/search-appearance.spec.ts` (add a test)

**Interfaces:**
- Consumes: the election data loader the e2e suite already uses, or `BALLOT` from `e2e/helpers.ts`, to list the Contra Costa contest ids.
- Produces: nothing.

- [ ] **Step 1: Write the test** `"a county page links to every one of its contests in its server HTML"`. Use `request.get("/2026-11/contra-costa")`, not `page.goto`, so the test sees the HTML Google gets. For every contest id on the Contra Costa ballot (at least `cccd-ward-3` and `hercules-measure-p`, plus the full list if the helpers expose it), assert the body contains `href="/2026-11/<id>"`.
- [ ] **Step 2: Run** `npx playwright test e2e/search-appearance.spec.ts -g "server HTML"`. Expected: PASS. This test guards existing behavior, so it should pass right away. If it fails, stop and report: Google can't see those links.
- [ ] **Step 3: Commit** `test(seo): pin county pages linking to every contest in server HTML`.

### Task 2: Three design options for the guide badge and press section (gate)

**Files:** none in the repo. Publish one Artifact.

- [ ] **Step 1:** Following Sean's "Three design options before frontend work" rule, build one Artifact page with three genuinely different options. Each option covers both:
  - the "Link to this comparison" block on a guide page, using a real guide such as `/guides/sierra-club-sf-bay`;
  - the press section on `/about`.
  Draw each in the site's real look: render the live pages and edit them in the browser, as in the Oct 30 contest mockups. Show phone and desktop widths, and the copied and copy-failed states.
- [ ] **Step 2:** Ask Sean to pick with AskUserQuestion. Record the pick, and any copy he changes, at the top of Tasks 3 and 4 before starting them.

### Task 3: Guide badge snippet on guide pages

**Files:**
- Create: `src/lib/badge.ts`
- Create: `tests/badge.test.ts`
- Create: `src/components/LinkToComparison.tsx` (client component only for the copy button; the snippet text renders on the server)
- Modify: `src/app/guides/[guide]/page.tsx`, placed where the picked design puts it
- Modify: `e2e/guide-page.spec.ts`
- Create: `data/changelog/<ship-date>-link-to-bay-ballot.yml`

**Interfaces:**
- Consumes: `SITE` from `src/lib/seo.ts`.
- Produces: `guideBadgeSnippet({ guideId, guideName }: { guideId: string; guideName: string }): string`.

- [ ] **Step 1: Write failing tests** in `tests/badge.test.ts`:
  - `guideBadgeSnippet({ guideId: "sierra-club-sf-bay", guideName: "Sierra Club SF Bay Chapter" })` contains `href="https://bayballot.com/guides/sierra-club-sf-bay"` and the text `See how Sierra Club SF Bay Chapter compares with other Bay Area guides`. Change this copy only if Sean changed it in Task 2.
  - With `guideName: 'A & B "Guide" <x>'` the output contains `A &amp; B &quot;Guide&quot; &lt;x&gt;` and no raw `<x>`.
  - The href never ends in `/` and contains no `?`.
- [ ] **Step 2: Run** `npx vitest run tests/badge.test.ts`. Expected: FAIL, the module doesn't exist.
- [ ] **Step 3: Implement** `guideBadgeSnippet` in `src/lib/badge.ts`: a single `<a>` element with an escaped name, using whatever markup the picked design needs (text link or small inline badge).
- [ ] **Step 4: Run** the unit test. Expected: PASS.
- [ ] **Step 5: Write the e2e test** in `e2e/guide-page.spec.ts`, `"a guide page offers a link snippet back to itself"`: on `/guides/sierra-club-sf-bay` the block is visible, its code text contains `https://bayballot.com/guides/sierra-club-sf-bay`, and clicking Copy shows "Copied". Add a second test that stubs `navigator.clipboard.writeText` to reject; it asserts the code stays visible and the button says "Select the code above to copy".
- [ ] **Step 6: Build** the block and `LinkToComparison` to match the picked design, then run `npx playwright test e2e/guide-page.spec.ts`. Expected: PASS.
- [ ] **Step 7: Screenshot** the guide page at 390px and 1280px in light and dark mode and compare with the Task 2 mock. Fix any differences.
- [ ] **Step 8: Add the changelog file**: `type: new`, title "Guides can link to their Bay Ballot page".
- [ ] **Step 9: Commit** `feat(guides): let a guide copy a link back to its Bay Ballot page`.

### Task 4: Press section on About

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `e2e/about.spec.ts`
- Modify: the Task 3 changelog file (add a `details` line) if both ship in one PR; otherwise create one.

**Interfaces:**
- Consumes: the counts the About page already computes, if any. Otherwise count guides and contests from the latest election through `src/lib/site-data.ts` (`election(latestElection())`).
- Produces: nothing.

- [ ] **Step 1: Write the e2e test** `"About has a press section with live counts and a contact address"`. It asserts a heading matching the picked design's label (e.g. "For press and newsletters"), the text `corrections@bayballot.com` as selectable text, and guide and contest counts that equal the data's counts. Compute those in the test from the same data module, not hard-coded.
- [ ] **Step 2: Run** `npx playwright test e2e/about.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the section to match the picked design. It contains a one-paragraph description that doesn't repeat the About intro, the live counts, a screenshot if the design has one (a static image in `public/`), and the address.
- [ ] **Step 4: Run** the e2e test. Expected: PASS. Screenshot at 390px and 1280px in light and dark mode and compare with the mock.
- [ ] **Step 5: Commit** `feat(about): add a press section with live counts and a contact address`.

### Task 5: Ship

- [ ] **Step 1:** `npm run lint && npm test && npx playwright test`. Expected: all pass.
- [ ] **Step 2:** Open a PR after Nov 3, following the pre-push checklist in Sean's CLAUDE.md (`git log --oneline origin/main..HEAD`, `git diff origin/main...HEAD --stat`, the PR size check, the Claude-Session grep). Put Task 3 and 4 screenshots in the PR.
- [ ] **Step 3:** In `docs/seo.md`, mark "Guide badge, press section" shipped, with the PR number and title.

### Task 6: Pitches (no code)

- [ ] **Step 1:** Research local outlets that covered Bay Area voter guides or endorsements in the 2026 cycle: newsletters, subreddits such as r/bayarea and county subs, and reporters. List 5 to 10 with links, in `docs/seo.md` under a "Pitches" heading.
- [ ] **Step 2:** Use the `drafting-in-bear` skill to draft one pitch per outlet type, tagged `#drafts`, with the destination links at the top. Sean sends them.
- [ ] **Step 3:** Record each pitch Sean sends (date, outlet) in `docs/seo.md`.

### Task 7: Weekly tracking (recurring, no code)

- [ ] **Step 1:** Starting the week of Nov 6, 2026, add a row to the Measurements table in `docs/seo.md`. Get indexed and not-indexed counts from the Search Console Pages report, the `site:bayballot.com` result count, and Google visits per day from Vercel Analytics (`referrerHostname` starts with `www.google.`).
- [ ] **Step 2:** In the Experiments table, record whether the 10 Oct 30 re-index pages are on Google, using URL Inspection.
