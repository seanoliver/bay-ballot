import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow, isPhone, watchErrors } from "./helpers";

// San Mateo's guides skipped every Judicial contest; Contra Costa's covered two of three.
const SAN_MATEO = `${BALLOT}/san-mateo`;
const CONTRA_COSTA = `${BALLOT}/contra-costa`;
const GROBAN = "Supreme Court Associate Justice Joshua Groban";
const APPEAL = "1st District Court of Appeal (11 justices)";
const FROM_BAY = /^\d+ guides? from across the Bay Area$/;

const judicial = (page: Page) => page.getByRole("region", { name: "California: Judicial" });
const scopeSwitch = (scope: ReturnType<typeof judicial>) => scope.getByRole("group", { name: "Show guides from" }).filter({ visible: true }).first();
const bayBlocks = (scope: ReturnType<typeof judicial>) => scope.getByRole("group", { name: FROM_BAY }).filter({ visible: true });

test.describe("Bay Area fallback", () => {
  test("a section the area's guides skipped entirely defaults to the Bay Area", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(SAN_MATEO);
    const section = judicial(page);
    const sw = scopeSwitch(section);
    await expect(sw.getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
    await expect(sw.getByRole("button", { name: "San Mateo" })).toHaveAttribute("aria-pressed", "false");
    await expect(bayBlocks(section)).toHaveCount(3);
    await expect(section.getByText("No San Mateo guide has taken a position yet.").filter({ visible: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a section the area's guides partly covered defaults to the area, and only the skipped row changes", async ({ page }) => {
    await page.goto(CONTRA_COSTA);
    const section = judicial(page);
    const sw = scopeSwitch(section);
    await expect(sw.getByRole("button", { name: "Contra Costa" })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByText("No Contra Costa guide has taken a position yet.").filter({ visible: true })).toHaveCount(1);
    await expect(bayBlocks(section)).toHaveCount(0);
    await sw.getByRole("button", { name: "Bay Area" }).click();
    await expect(bayBlocks(section)).toHaveCount(1);
    await expect(section.getByText("No Contra Costa guide has taken a position yet.").filter({ visible: true })).toHaveCount(0);
  });

  test("the switch toggles both ways, keeps focus, and is remembered across a reload", async ({ page }) => {
    await page.goto(SAN_MATEO);
    const section = judicial(page);
    const area = scopeSwitch(section).getByRole("button", { name: "San Mateo" });
    await area.click();
    await expect(area).toHaveAttribute("aria-pressed", "true");
    await expect(area).toBeFocused();
    await expect(bayBlocks(section)).toHaveCount(0);
    await expect(section.getByText("No San Mateo guide has taken a position yet.").filter({ visible: true })).toHaveCount(3);
    await expect(page).toHaveURL(new RegExp(`${SAN_MATEO}$`));
    await page.reload();
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: "San Mateo" })).toHaveAttribute("aria-pressed", "true");
    const bay = scopeSwitch(judicial(page)).getByRole("button", { name: "Bay Area" });
    await bay.click();
    await expect(bay).toBeFocused();
    await expect(bayBlocks(judicial(page))).toHaveCount(3);
    await page.reload();
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a remembered choice renders without hydration errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/about");
    await page.evaluate(() => localStorage.setItem("bb-scope", "san-mateo:section-state-judicial=area"));
    await page.goto(SAN_MATEO);
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: "San Mateo" })).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test("the reasons-only filter applies to the Bay Area tally", async ({ page }) => {
    await page.goto(`${SAN_MATEO}?why=1`);
    const label = bayBlocks(judicial(page)).first().getByText(FROM_BAY);
    const filtered = Number((await label.textContent())!.match(/^\d+/)![0]);
    await page.goto(`${SAN_MATEO}`);
    await page.evaluate(() => localStorage.removeItem("bb-filters"));
    await page.reload();
    const all = Number((await bayBlocks(judicial(page)).first().getByText(FROM_BAY).textContent())!.match(/^\d+/)![0]);
    expect(filtered).toBeLessThan(all);
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
    await page.goto(CONTRA_COSTA);
    await expect(scopeSwitch(judicial(page)).getByRole("button", { name: "Contra Costa" })).toHaveAttribute("aria-pressed", "true");
    await contestRow(page, APPEAL).click();
    const detail = isPhone(info) ? page.getByRole("dialog", { name: APPEAL }) : page.getByRole("region", { name: APPEAL });
    const sw = detail.getByRole("group", { name: "Show guides from" });
    await expect(sw.getByRole("button", { name: "Bay Area" })).toHaveAttribute("aria-pressed", "true");
    await expect(detail.getByRole("group", { name: FROM_BAY })).toBeVisible();
    await sw.getByRole("button", { name: "Contra Costa" }).click();
    await expect(sw.getByRole("button", { name: "Contra Costa" })).toBeFocused();
    await expect(detail.getByText("No Contra Costa guide has taken a position yet.")).toBeVisible();
    await expect(detail.getByRole("group", { name: FROM_BAY })).toHaveCount(0);
  });

  test("covered contests show no switch in their details", async ({ page }, info) => {
    await page.goto(CONTRA_COSTA);
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
    await page.goto(SAN_MATEO);
    await scopeSwitch(judicial(page)).getByRole("button", { name: "San Mateo" }).click();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[aria-current=true]")).toHaveCount(1);
  });
});
