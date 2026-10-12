import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow } from "./helpers";

const SCC = `${BALLOT}/santa-clara-county`;

async function enterZip(page: Page, zip: string) {
  await page.getByLabel("Your ZIP code").fill(zip);
  await page.getByRole("button", { name: "Show my contests" }).click();
}

const box = (page: Page) => page.getByRole("region", { name: "Your ZIP code" });

test.describe("ZIP filter", () => {
  test("hides other cities' contests, marks address-dependent ones, and remembers the ZIP on this device only", async ({ page }) => {
    await page.goto(SCC);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await enterZip(page, "94040");
    await expect(box(page)).toContainText(/ZIP 94040 · \d+ contests can be on your ballot · \d+ others? hidden/);
    await expect(box(page).locator("p").first()).toBeFocused();
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
    await expect(contestRow(page, "Mountain View City Council")).toBeVisible();
    await expect(page.getByText("May be on your ballot").filter({ visible: true }).first()).toBeVisible();
    expect(page.url()).not.toContain("94040");

    await page.reload();
    await expect(box(page)).toContainText("ZIP 94040");
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);

    await box(page).getByRole("button", { name: "Show all" }).click();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(page.getByText("Probably not on ballots in ZIP 94040").filter({ visible: true }).first()).toBeVisible();
    await box(page).getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("Your ZIP code")).toBeFocused();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
  });

  test("a shared link to a contest the ZIP hides still opens it", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94040");
    await expect(box(page)).toContainText("others hidden");
    await page.goto(`${SCC}?c=palo-alto-council`);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(box(page)).toContainText("others shown");
    await page.goto(SCC);
    await expect(box(page)).toContainText("others hidden");
  });

  test("on a county page, points to the other county a ZIP reaches", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94303");
    await expect(box(page)).toContainText("Part of this ZIP is in San Mateo County.");
    await expect(box(page).getByRole("link", { name: "See the San Mateo County ballot" })).toHaveAttribute("href", `${BALLOT}/san-mateo`);
  });

  test("narrows the Bay Area page to the ZIP's county", async ({ page }) => {
    await page.goto(BALLOT);
    await enterZip(page, "94401");
    await expect(box(page)).toContainText(/\d+ contests can be on your ballot · \d+ others? hidden/);
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
  });

  test("on another county's page, points to the ZIP's county instead of filtering", async ({ page }) => {
    await page.goto(`${BALLOT}/marin`);
    await enterZip(page, "94040");
    await expect(box(page)).toContainText("In Santa Clara County.");
    await box(page).getByRole("link", { name: "See the Santa Clara County ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
    await expect(box(page)).toContainText("can be on your ballot");
  });

  test("says when a ZIP can't be mapped, and rejects anything but five digits", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "940");
    await expect(page.getByRole("form", { name: "Filter by ZIP code" }).getByRole("alert")).toHaveText("Enter a 5-digit ZIP code.");
    await enterZip(page, "10001");
    await expect(box(page)).toContainText("Not a Bay Area ZIP, or one this site can’t map");
  });
});
