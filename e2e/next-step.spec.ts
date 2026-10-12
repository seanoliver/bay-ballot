import { expect, test } from "@playwright/test";
import { BALLOT } from "./helpers";

test.describe("contest page next step", () => {
  test("a local contest links to its area's ballot and keeps the filters", async ({ page }) => {
    await page.goto(`${BALLOT}/prop-b?why=1`);
    const link = page.getByRole("link", { name: /^See all \d+ San Francisco races$/ });
    await expect(link).toHaveAttribute("href", `${BALLOT}/sf?why=1`);
    await link.click();
    await expect(page).toHaveURL(`${BALLOT}/sf?why=1`);
  });

  test("a statewide contest offers every county's ballot", async ({ page }) => {
    await page.goto(`${BALLOT}/supreme-court-groban`);
    const nav = page.getByRole("navigation", { name: "See the rest of your ballot" });
    await expect(nav).toContainText("This race is on every Bay Area ballot.");
    await expect(nav.getByRole("link", { name: "San Mateo" })).toHaveAttribute("href", `${BALLOT}/san-mateo`);
    expect(await nav.getByRole("link").count()).toBeGreaterThan(1);
  });
});
