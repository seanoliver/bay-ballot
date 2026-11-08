# Site-level SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give other sites easy reasons to link to Bay Ballot (a standalone `/press` press kit with a link snippet for the whole site or any guide) and guard the county-page links Google relies on, while every contest stays indexable.

**Architecture:** Pure functions build the link HTML snippet for the whole site or a guide. A server-rendered `/press` page shows it, with small client components only for the guide dropdown and the copy buttons. A Playwright test pins the county-page links to contests. Pitches and weekly tracking are non-code tasks.

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
5. The press kit in dark mode: text and borders must use theme tokens. Covered by the screenshot check in Task 3.

---

### Task 1: Guard county-page links to contests

**Files:**
- Modify: `e2e/search-appearance.spec.ts` (add a test)

**Interfaces:**
- Consumes: `loadElection` from `src/lib/data.ts` and `areaContests(contests, area)` from `src/lib/area-view.ts`, the filter the county page itself uses, to list the Contra Costa contest ids. (`BALLOT` in `e2e/helpers.ts` is just the string `"/2026-11"`, and `contestIds()` returns every contest on the ballot, not one county's.)
- Produces: nothing.

- [x] **Step 1: Write the test** `"a county page links to every one of its contests in its server HTML"`. Use `request.get("/2026-11/contra-costa")`, not `page.goto`, so the test sees the HTML Google gets. For every contest id on the Contra Costa ballot (`areaContests(d.ballot.contests, contraCosta)`, which includes `cccd-ward-3` and `hercules-measure-p`), assert the body contains `href="/2026-11/<id>"`. `BallotView` appends `${carry}` (the carried filter query) to contest hrefs; the server has no query, so it renders an empty string and the exact href matches.
- [x] **Step 2: Run** `npx playwright test e2e/search-appearance.spec.ts -g "server HTML"`. Expected: PASS. This test guards existing behavior, so it should pass right away. If it fails, stop and report: Google can't see those links.
- [x] **Step 3: Commit** `test(seo): pin county pages linking to every contest in server HTML`.

### Task 2: Three design options for the guide badge and press section (gate)

**Files:** none in the repo. Publish one Artifact.

- [ ] **Step 1:** Following Sean's "Three design options before frontend work" rule, build one Artifact page with three genuinely different options. Each option covers both:
  - the "Link to this comparison" block on a guide page, using a real guide such as `/guides/sierra-club-sf-bay`;
  - the press section on `/about`.
  Draw each in the site's real look: render the live pages and edit them in the browser, as in the Oct 30 contest mockups. Show phone and desktop widths, and the copied and copy-failed states.
- [ ] **Step 2:** Ask Sean to pick with AskUserQuestion. Record the pick, and any copy he changes, at the top of Tasks 3 and 4 before starting them.

### Task 3: Link snippet and press kit page

> **Design pick (Task 2).** Round 1 put a "Link to this comparison" block on each guide page. Sean rejected it: it assumed the reader runs that guide. Guide, contest and area pages don't change. Instead, one standalone page, `/press`, holds a press kit, reached from a "Press kit" link in the footer's Site list (after About) and listed in the sitemap. Sections, in order: Press kit (h1 and intro), About Bay Ballot (a paragraph built from live data, with a Copy button), By the numbers, Screenshots, Logo, Link to Bay Ballot (a guide dropdown that changes a copyable link snippet), Contact.

**Files:**
- Create: `src/lib/link-snippet.ts` (not `badge.ts`: `src/lib/badges.ts` already holds the count badges)
- Create: `tests/link-snippet.test.ts`
- Create: `src/components/CopyButton.tsx`, `src/components/LinkMaker.tsx` (client components only for the select and copy behavior; the default snippet renders on the server)
- Create: `src/app/press/page.tsx`
- Create: `public/press/` (three screenshots and the logo as SVG and PNG)
- Modify: `src/components/SiteFooter.tsx` (the "Press kit" link), `src/lib/seo.ts` and `tests/seo.test.ts` (`/press` in the sitemap)
- Create: `e2e/press.spec.ts`
- Create: `data/changelog/2026-11-08-press-kit.yml`

**Interfaces:**
- Consumes: `SITE` from `src/lib/seo.ts`; `coverage(d)` from `src/lib/coverage.ts` for the counts, the same source the About page uses; `publishedGuides` for the dropdown.
- Produces: `siteLinkSnippet(): string` and `guideLinkSnippet({ guideId, guideName }: { guideId: string; guideName: string }): string`.

- [x] **Step 1: Unit tests** in `tests/link-snippet.test.ts`: the exact copy for the whole site (`<a href="https://bayballot.com">Bay Ballot, every Bay Area voter guide side by side</a>`) and for a guide (`<a href="https://bayballot.com/guides/<id>">See how <Guide Name> compares with other Bay Area guides</a>`); `A & B "Guide" <x>` becomes `A &amp; B &quot;Guide&quot; &lt;x&gt;` with no raw `<x>`; the href has no trailing slash and no `?`.
- [x] **Step 2: Implement** `src/lib/link-snippet.ts`.
- [x] **Step 3: Screenshots.** Captured from https://bayballot.com with Playwright: phone 390x844 at deviceScaleFactor 3 (`/2026-11/governor` with the Your vote box; `/2026-11/sf`, then "Your ballot"), desktop 1440x900 at 2 (`/2026-11/sf?c=governor`). For the Your ballot shots, `localStorage["bb-ballot-2026-11"]` was seeded with 13 statewide picks. PNG was smaller than JPEG for these flat UI shots (220–450 KB each).
- [x] **Step 4: Build** the page. The paragraph and counts come from `coverage(d)` and the latest data date; the year in the intro comes from the ballot date. Copy buttons say "Copy", then "✓ Copied" for about 2 seconds. When `navigator.clipboard.writeText` is missing or rejects, the text stays, gets selected, and the button says "Select the code above to copy" (or "Select the paragraph above to copy"). Contact says "Email corrections@bayballot.com", with no response-time promise.
- [x] **Step 5: e2e** in `e2e/press.spec.ts`: headings in order, counts equal `coverage()` of the same data, five downloads resolve, the email as text, the snippet shows without JavaScript, choosing a guide changes the code to its URL, Copy shows "✓ Copied", a stubbed rejecting clipboard keeps the code visible with "Select the code above to copy", and the footer link reaches `/press`.
- [x] **Step 6: Screenshot** `/press` at 390px and 1280px in light and dark mode.
- [x] **Step 7: Changelog** `data/changelog/2026-11-08-press-kit.yml`, `type: new`.

### Task 4: Press section on About (folded into Task 3)

> **Design pick (Task 2).** No press section on About. Everything it was to hold (description, live counts, screenshots, contact address) lives on `/press` (Task 3), so the About page doesn't change.

### Task 5: Ship

- [ ] **Step 1:** `npm run lint && npm test && npx playwright test`. Expected: all pass.
- [ ] **Step 2:** Open a PR after Nov 3, following the pre-push checklist in Sean's CLAUDE.md (`git log --oneline origin/main..HEAD`, `git diff origin/main...HEAD --stat`, the PR size check, the Claude-Session grep). Put the Task 3 screenshots in the PR.
- [ ] **Step 3:** In `docs/seo.md`, mark "Press kit page" shipped, with the PR number and title.

### Task 6: Pitches (no code)

- [ ] **Step 1:** Research local outlets that covered Bay Area voter guides or endorsements in the 2026 cycle: newsletters, subreddits such as r/bayarea and county subs, and reporters. List 5 to 10 with links, in `docs/seo.md` under a "Pitches" heading.
- [ ] **Step 2:** Use the `drafting-in-bear` skill to draft one pitch per outlet type, tagged `#drafts`, with the destination links at the top. Sean sends them.
- [ ] **Step 3:** Record each pitch Sean sends (date, outlet) in `docs/seo.md`.

### Task 7: Weekly tracking (recurring, no code)

- [ ] **Step 1:** Starting the week of Nov 6, 2026, add a row to the Measurements table in `docs/seo.md`. Get indexed and not-indexed counts from the Search Console Pages report, the `site:bayballot.com` result count, and Google visits per day from Vercel Analytics (`referrerHostname` starts with `www.google.`).
- [ ] **Step 2:** In the Experiments table, record whether the 10 Oct 30 re-index pages are on Google, using URL Inspection.
