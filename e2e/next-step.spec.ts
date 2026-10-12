import { expect, test } from "@playwright/test";
import { BALLOT } from "./helpers";

test.describe("contest page next step", () => {
  test("a local contest links to its area's ballot with that ballot's contest count, keeping the filters", async ({ page }) => {
    await page.goto(`${BALLOT}/prop-b?why=1`);
    const link = page.getByRole("link", { name: /^See all \d+ contests on the San Francisco ballot$/ });
    const n = (await link.textContent())!.match(/\d+/)![0];
    await expect(link).toHaveAttribute("href", `${BALLOT}/sf?why=1`);
    await link.click();
    await expect(page).toHaveURL(`${BALLOT}/sf?why=1`);
    await expect(page.getByText(new RegExp(` · ${n} contests · `))).toBeVisible();
  });

  test("a statewide contest offers every county's ballot, keeping the filters", async ({ page }) => {
    await page.goto(`${BALLOT}/supreme-court-groban?why=1`);
    const nav = page.getByRole("navigation", { name: "See the rest of your ballot" });
    await expect(nav).toContainText("This contest is on every Bay Area ballot.");
    await expect(nav.getByRole("link", { name: "San Mateo" })).toHaveAttribute("href", `${BALLOT}/san-mateo?why=1`);
    expect(await nav.getByRole("link").count()).toBeGreaterThan(1);
  });
});
