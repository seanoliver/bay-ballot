import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow } from "./helpers";

const SCC = `${BALLOT}/santa-clara-county`;

// Typing the fifth digit applies the ZIP; there is no button to press.
async function enterZip(page: Page, zip: string) {
  const open = page.getByRole("button", { name: "Your ZIP" });
  if (await open.isVisible()) await open.click();
  else await page.getByRole("button", { name: /^ZIP \d{5}\. Change$/ }).click();
  await page.getByLabel("Your ZIP code").pressSequentially(zip);
}

const status = (page: Page) => page.locator("[data-zip-status]");

test.describe("ZIP filter", () => {
  test("applies at the fifth digit, hides other cities' contests, marks address-dependent ones, and remembers the ZIP on this device only", async ({ page }) => {
    await page.goto(SCC);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await enterZip(page, "94040");
    await expect(status(page)).toContainText(/\d+ of \d+ contests can be on your ballot in 94040/);
    await expect(page.getByRole("button", { name: "ZIP 94040. Change" })).toBeFocused();
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
    await expect(contestRow(page, "Mountain View City Council")).toBeVisible();
    await expect(page.getByText("May be on your ballot").filter({ visible: true }).first()).toBeVisible();
    expect(page.url()).not.toContain("94040");

    await page.reload();
    await expect(status(page)).toContainText("in 94040");
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);

    await status(page).getByRole("button", { name: "Show all" }).click();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(page.getByText("Probably not on ballots in ZIP 94040").filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear ZIP" }).click();
    await expect(page.getByRole("button", { name: "Your ZIP" })).toBeFocused();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
  });

  test("Enter on a short ZIP says what's wrong, and Escape closes the field", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "940");
    await page.getByLabel("Your ZIP code").press("Enter");
    await expect(status(page).getByRole("alert")).toHaveText("Enter a 5-digit ZIP code.");
    await page.getByLabel("Your ZIP code").press("Escape");
    await expect(page.getByRole("button", { name: "Your ZIP" })).toBeFocused();
    await expect(status(page).getByRole("alert")).toHaveText("");
  });

  test("Change selects the old ZIP so typing replaces it; Escape keeps it; leaving an empty field doesn't pull focus back", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94040");
    await page.getByRole("button", { name: "ZIP 94040. Change" }).click();
    await page.getByLabel("Your ZIP code").pressSequentially("94301");
    await expect(page.getByRole("button", { name: "ZIP 94301. Change" })).toBeFocused();
    await page.getByRole("button", { name: "ZIP 94301. Change" }).click();
    await page.getByLabel("Your ZIP code").press("Escape");
    await expect(page.getByRole("button", { name: "ZIP 94301. Change" })).toBeFocused();
    await expect(status(page)).toContainText("in 94301");

    await page.getByRole("button", { name: "Clear ZIP" }).click();
    await page.getByRole("button", { name: "Your ZIP" }).click();
    await page.getByLabel("Your ZIP code").press("Tab");
    await expect(page.getByRole("button", { name: "Your ZIP" })).not.toBeFocused();
  });

  test("closing the field by clicking Show all still clicks Show all", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94040");
    await page.getByRole("button", { name: "ZIP 94040. Change" }).click();
    await status(page).getByRole("button", { name: "Show all" }).click();
    await expect(status(page).getByRole("button", { name: "Hide the others" })).toBeVisible();
    await expect(page.getByLabel("Your ZIP code")).toHaveCount(0);
  });

  test("an error from Enter clears once a click closes the field, and the click still lands", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94040");
    await page.getByRole("button", { name: "ZIP 94040. Change" }).click();
    await page.getByLabel("Your ZIP code").pressSequentially("9");
    await page.getByLabel("Your ZIP code").press("Enter");
    await expect(status(page).getByRole("alert")).toHaveText("Enter a 5-digit ZIP code.");
    await status(page).getByRole("button", { name: "Show all" }).click();
    await expect(status(page).getByRole("button", { name: "Hide the others" })).toBeVisible();
    await expect(status(page).getByRole("alert")).toHaveText("");
  });

  test("an error cleared by a click-away doesn't swallow the next one", async ({ page }) => {
    await page.goto(SCC);
    await page.getByRole("button", { name: "Your ZIP" }).click();
    await page.getByLabel("Your ZIP code").pressSequentially("9");
    await page.getByLabel("Your ZIP code").press("Enter");
    await page.getByRole("heading", { level: 1 }).click();
    await expect(status(page).getByRole("alert")).toHaveText("");
    await page.getByRole("button", { name: "Your ZIP" }).click();
    await page.getByLabel("Your ZIP code").press("Enter");
    await expect(status(page).getByRole("alert")).toHaveText("Enter a 5-digit ZIP code.");
  });

  test("a pasted address applies its ZIP", async ({ page, context, browserName }, info) => {
    test.skip(browserName !== "chromium" || info.project.name.includes("phone"), "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(SCC);
    await page.getByRole("button", { name: "Your ZIP" }).click();
    await page.evaluate(() => navigator.clipboard.writeText("10050 N Wolfe Rd, Cupertino, CA 95014-2033"));
    await page.getByLabel("Your ZIP code").press("ControlOrMeta+v");
    await expect(page.getByRole("button", { name: "ZIP 95014. Change" })).toBeVisible();
    for (const good of ["123 Castro St, Mountain View, CA 94041 1234, USA", "940411234"]) {
      await page.getByRole("button", { name: /^ZIP \d{5}\. Change$/ }).click();
      await page.evaluate((t) => navigator.clipboard.writeText(t), good);
      await page.getByLabel("Your ZIP code").press("ControlOrMeta+v");
      await expect(page.getByRole("button", { name: "ZIP 94041. Change" }), good).toBeVisible();
      await page.getByRole("button", { name: "ZIP 94041. Change" }).click();
      await page.evaluate(() => navigator.clipboard.writeText("95014"));
      await page.getByLabel("Your ZIP code").press("ControlOrMeta+v");
    }
    for (const bad of ["650-555-1234", "10050 N Wolfe Rd, Cupertino, CA", "PO Box 12345, Palo Alto"]) {
      await page.getByRole("button", { name: "ZIP 95014. Change" }).click();
      await page.evaluate((t) => navigator.clipboard.writeText(t), bad);
      await page.getByLabel("Your ZIP code").press("ControlOrMeta+v");
      await expect(status(page).getByRole("alert"), bad).toHaveText("Enter a 5-digit ZIP code.");
      await page.getByLabel("Your ZIP code").press("Escape");
    }
  });

  test("a shared link to a contest the ZIP hides still opens it", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94040");
    await expect(status(page).getByRole("button", { name: "Show all" })).toBeVisible();
    await page.goto(`${SCC}?c=palo-alto-council`);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(status(page).getByRole("button", { name: "Hide the others" })).toBeVisible();
  });

  test("on a county page, points to the other county a ZIP reaches", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "94303");
    await expect(status(page)).toContainText("Part of this ZIP is in San Mateo County.");
    await expect(status(page).getByRole("link", { name: "See the San Mateo County ballot" })).toHaveAttribute("href", `${BALLOT}/san-mateo`);
  });

  test("narrows the Bay Area page to the ZIP's county", async ({ page }) => {
    await page.goto(BALLOT);
    await enterZip(page, "94401");
    await expect(status(page)).toContainText(/\d+ of \d+ contests can be on your ballot in 94401/);
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
  });

  test("on another county's page, points to the ZIP's county instead of filtering", async ({ page }) => {
    await page.goto(`${BALLOT}/marin`);
    await enterZip(page, "94040");
    await expect(status(page)).toContainText("In Santa Clara County.");
    await status(page).getByRole("link", { name: "See the Santa Clara County ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
    await expect(status(page)).toContainText("can be on your ballot");
  });

  test("says when a ZIP can't be mapped", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "10001");
    await expect(status(page)).toContainText("isn’t a Bay Area ZIP");
  });
});
