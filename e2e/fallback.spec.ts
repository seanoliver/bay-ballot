import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { bayHeading, scopeName, skippedLabel } from "../src/lib/fallback";
import { ballotViewProps } from "../src/lib/site-data";
import { BALLOT, contestRow, guidesOn, isPhone, waitForKeys, watchErrors } from "./helpers";

const SAN_MATEO = `${BALLOT}/san-mateo`;
const GROBAN = "Supreme Court Associate Justice Joshua Groban";
const FROM_BAY = /^\d+ guides? from across the Bay Area$/;
const JUDICIAL = "section-state-judicial";

// Which judicial contests each area falls back on comes from the data, so a refresh can't break these tests.
const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const judicialFallback = (areaId: string) => {
  const area = data.areas.find((a) => a.id === areaId)!;
  return ballotViewProps(data, { area }).fallback?.sections.find((s) => s.id === JUDICIAL) ?? null;
};
// San Mateo when it falls back on a judicial contest, else the first area that does.
const fallbacks = data.areas.flatMap((a) => {
  const fb = judicialFallback(a.id);
  return fb ? [{ area: a, fb }] : [];
});
const chosen = fallbacks.find((x) => x.area.id === "san-mateo") ?? fallbacks[0];
const NO_FALLBACK = "No area falls back on a judicial contest in today's data";
const FB = chosen?.fb;
const AREA_URL = chosen ? `${BALLOT}/${chosen.area.id}` : "";
const NAME = chosen ? scopeName(chosen.area) : "";
const DEFAULT = FB?.initial === "bay" ? "Bay Area" : NAME;
const OTHER = FB?.initial === "bay" ? NAME : "Bay Area";
const titleOf = (id: string) => data.ballot.contests.find((c) => c.id === id)!.title;

async function chooseScope(page: Page, scope: "area" | "bay") {
  await page.goto("/about");
  await page.evaluate(([area, v]) => localStorage.setItem("bb-scope", `${area}:${v}`), [chosen!.area.id, `${JUDICIAL}=${scope}`]);
}

const judicial = (page: Page) => page.getByRole("region", { name: "California: Judicial" });
const scopeSwitch = (scope: ReturnType<typeof judicial>) => scope.getByRole("group", { name: "Show guides from" }).filter({ visible: true }).first();
const bayBlocks = (scope: ReturnType<typeof judicial>) => scope.getByRole("group", { name: FROM_BAY }).filter({ visible: true });
const bayBlockFor = (scope: ReturnType<typeof judicial>, contestId: string) =>
  scope.locator(`[role=group][aria-labelledby$="-${contestId}"]`).filter({ visible: true });

test.describe("Bay Area fallback", () => {
  test("a section the area's guides skipped entirely defaults to the Bay Area", async ({ page }) => {
    const skipped = data.areas.find((a) => judicialFallback(a.id)?.initial === "bay");
    test.skip(!skipped, "No area's guides skip the whole judicial section in today's data; tests/fallback.test.ts covers the rule");
    const errors = watchErrors(page);
    await page.goto(`${BALLOT}/${skipped!.id}`);
    const sw = scopeSwitch(judicial(page));
    await expect(sw.getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: scopeName(skipped!) })).toHaveAttribute("aria-pressed", "false");
    await expect(bayBlocks(judicial(page))).toHaveCount(judicialFallback(skipped!.id)!.contests.length);
    expect(errors).toEqual([]);
  });

  test("a section the area's guides partly covered defaults to the area, and only the skipped row changes", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    test.skip(FB!.initial !== "area", "the chosen section defaults to the Bay Area");
    const n = FB!.contests.length;
    await page.goto(AREA_URL);
    const section = judicial(page);
    const sw = scopeSwitch(section);
    await expect(sw.getByRole("button", { name: NAME })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByText(skippedLabel(NAME)).filter({ visible: true })).toHaveCount(n);
    await expect(bayBlocks(section)).toHaveCount(0);
    await sw.getByRole("button", { name: "Bay Area" }).click();
    await expect(bayBlocks(section)).toHaveCount(n);
    await expect(section.getByText(skippedLabel(NAME)).filter({ visible: true })).toHaveCount(0);
  });

  test("the switch toggles both ways, keeps focus, and is remembered across a reload", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    const n = FB!.contests.length;
    await page.goto(AREA_URL);
    const sw = () => scopeSwitch(judicial(page));
    await expect(sw().getByRole("button", { name: DEFAULT })).toHaveAttribute("aria-pressed", "true");
    const bay = sw().getByRole("button", { name: "Bay Area" });
    await bay.click();
    await expect(bay).toHaveAttribute("aria-pressed", "true");
    await expect(bay).toBeFocused();
    await expect(bayBlocks(judicial(page))).toHaveCount(n);
    await page.reload();
    await expect(sw().getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
    const area = sw().getByRole("button", { name: NAME });
    await area.click();
    await expect(area).toBeFocused();
    await expect(bayBlocks(judicial(page))).toHaveCount(0);
    await expect(judicial(page).getByText(skippedLabel(NAME)).filter({ visible: true })).toHaveCount(n);
    await expect(page).toHaveURL(new RegExp(`${AREA_URL}$`));
    await page.reload();
    await expect(sw().getByRole("button", { name: NAME })).toHaveAttribute("aria-pressed", "true");
  });

  test("a remembered choice renders without hydration errors", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    const errors = watchErrors(page);
    await chooseScope(page, FB!.initial === "bay" ? "area" : "bay");
    await page.goto(AREA_URL);
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: OTHER })).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test("the reasons-only filter applies to the Bay Area tally", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    const pool = guidesOn(FB!.contests[0]);
    expect(pool.some((g) => !data.endorsements[g].hasReasoning), "the Bay Area pool needs a guide without reasons").toBe(true);
    const count = async () => Number((await bayBlockFor(judicial(page), FB!.contests[0]).getByText(FROM_BAY).textContent())!.match(/^\d+/)![0]);
    await chooseScope(page, "bay");
    await page.goto(AREA_URL);
    const all = await count();
    // The page is server-rendered unfiltered; the filter applies after hydration, so poll for it.
    await page.goto(`${AREA_URL}?why=1`);
    await expect.poll(count).toBeLessThan(all);
  });

  test("local contests never fall back to the Bay Area", async ({ page }) => {
    await page.goto(SAN_MATEO);
    for (const place of ["San Mateo County", "Menlo Park", "Redwood City"]) {
      const region = page.getByRole("region", { name: place, exact: true });
      if ((await region.count()) === 0) continue;
      await expect(region.getByRole("group", { name: "Show guides from" })).toHaveCount(0);
      await expect(region.getByRole("group", { name: FROM_BAY })).toHaveCount(0);
    }
  });

  test("the contest details carry the switch, defaulting to the Bay Area", async ({ page }, info) => {
    test.skip(!FB, NO_FALLBACK);
    const title = titleOf(FB!.contests[0]);
    await page.goto(AREA_URL);
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: NAME })).toHaveAttribute("aria-pressed", "true");
    await contestRow(page, title).click();
    const detail = isPhone(info) ? page.getByRole("dialog", { name: title }) : page.getByRole("region", { name: title });
    const sw = detail.getByRole("group", { name: "Show guides from" });
    await expect(sw.getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
    await expect(detail.getByRole("group", { name: FROM_BAY })).toBeVisible();
    await sw.getByRole("button", { name: NAME }).click();
    await expect(sw.getByRole("button", { name: NAME })).toBeFocused();
    await expect(detail.getByText(skippedLabel(NAME))).toBeVisible();
    await expect(detail.getByRole("group", { name: FROM_BAY })).toHaveCount(0);
  });

  test("covered contests show no switch in their details", async ({ page }, info) => {
    test.skip(!FB, NO_FALLBACK);
    test.skip(FB!.contests.includes("supreme-court-groban"), "Groban falls back in the chosen area");
    await page.goto(AREA_URL);
    await contestRow(page, GROBAN).click();
    const detail = isPhone(info) ? page.getByRole("dialog", { name: GROBAN }) : page.getByRole("region", { name: GROBAN });
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("group", { name: "Show guides from" })).toHaveCount(0);
  });

  test("a contest page already counts every guide, so it has no switch", async ({ page }) => {
    await page.goto(`${BALLOT}/supreme-court-groban`);
    await expect(page.getByRole("heading", { level: 1, name: GROBAN })).toBeVisible();
    await expect(page.getByRole("group", { name: "Show guides from" })).toHaveCount(0);
  });

  test("desktop keyboard: arrow keys still step through contests after using the switch", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    test.skip(!FB, NO_FALLBACK);
    await page.goto(AREA_URL);
    await waitForKeys(page);
    await scopeSwitch(judicial(page)).getByRole("button", { name: NAME }).click();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[aria-current=true]")).toHaveCount(1);
  });

  test("the switch still works when the browser blocks storage", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("blocked", "SecurityError");
      };
    });
    await page.goto(AREA_URL);
    const section = judicial(page);
    const area = scopeSwitch(section).getByRole("button", { name: NAME });
    await area.click();
    await expect(area).toHaveAttribute("aria-pressed", "true");
    await expect(bayBlocks(section)).toHaveCount(0);
    await scopeSwitch(section).getByRole("button", { name: "Bay Area" }).click();
    await expect(bayBlocks(section)).toHaveCount(FB!.contests.length);
  });

  test("a Bay Area block says how many of its guides filters hide, and Show brings them back", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    const id = FB!.contests[0];
    const pool = guidesOn(id);
    expect(pool.length, `${id} needs at least 2 Bay Area guides`).toBeGreaterThanOrEqual(2);
    await chooseScope(page, "bay");
    await page.goto(`${AREA_URL}?off=${pool[0]}`);
    const block = bayBlockFor(judicial(page), id);
    await expect(block).toHaveAccessibleName(bayHeading(pool.length - 1, pool.length).label);
    await expect(block.getByText("1 guide hidden")).toBeVisible();
    await block.getByRole("button", { name: `Show all Bay Area guides on ${titleOf(id)}` }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-labelledby"))).toMatch(/^bay-[dm]-/);
    await expect(page).not.toHaveURL(/off=/);
    await expect(page).not.toHaveURL(/[?&]c=/);
    await expect(block).toHaveAccessibleName(bayHeading(pool.length, pool.length).label);
  });

  test("a Bay Area block whose guides are all hidden says so instead of showing zero", async ({ page }) => {
    test.skip(!FB, NO_FALLBACK);
    const id = FB!.contests[0];
    const pool = guidesOn(id);
    expect(pool.length, `${id} needs a Bay Area guide`).toBeGreaterThan(0);
    await chooseScope(page, "bay");
    await page.goto(`${AREA_URL}?off=${pool.join(",")}`);
    const section = judicial(page);
    await expect(section.getByText(/^0 guides from across/)).toHaveCount(0);
    const block = bayBlockFor(section, id);
    await expect(block).toHaveAccessibleName(bayHeading(0, pool.length).label);
    await block.getByRole("button", { name: /^Show all Bay Area guides on / }).click();
    await expect(page).not.toHaveURL(/off=/);
    await expect(bayBlockFor(section, id)).toHaveAccessibleName(bayHeading(pool.length, pool.length).label);
  });
});
