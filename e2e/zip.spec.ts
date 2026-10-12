import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow } from "./helpers";

const SCC = `${BALLOT}/santa-clara-county`;

async function enterZip(page: Page, zip: string) {
  await page.getByLabel("Your ZIP code").fill(zip);
  await page.getByRole("button", { name: "Show my contests" }).click();
}

const status = (page: Page) => page.getByRole("status").filter({ hasText: /^ZIP / });

test.describe("ZIP filter", () => {
  test("hides other cities' contests, marks address-dependent ones, and remembers the ZIP on this device only", async ({ page }) => {
    await page.goto(SCC);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await enterZip(page, "94040");
    await expect(status(page)).toContainText(/ZIP 94040 · \d+ contests can be on your ballot · \d+ others hidden/);
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
    await expect(contestRow(page, "Mountain View City Council")).toBeVisible();
    await expect(page.getByText("May be on your ballot").first()).toBeVisible();
    expect(page.url()).not.toContain("94040");

    await page.reload();
    await expect(status(page)).toContainText("ZIP 94040");
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);

    await status(page).getByRole("button", { name: "Show all" }).click();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await status(page).getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("Your ZIP code")).toBeVisible();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
  });

  test("on another county's page, points to the ZIP's county instead of filtering", async ({ page }) => {
    await page.goto(`${BALLOT}/marin`);
    await enterZip(page, "94040");
    await expect(status(page)).toContainText("In Santa Clara County.");
    await status(page).getByRole("link", { name: "See the Santa Clara County ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
    await expect(status(page)).toContainText("can be on your ballot");
  });

  test("says when a ZIP is outside the Bay Area, and rejects anything but five digits", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "940");
    await expect(page.getByText("Enter a 5-digit ZIP code.")).toBeVisible();
    await enterZip(page, "10001");
    await expect(status(page)).toContainText("Not in the nine Bay Area counties this site covers.");
  });
});
