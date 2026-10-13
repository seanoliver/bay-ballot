import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow, isPhone } from "./helpers";

const SCC = `${BALLOT}/santa-clara-county`;

// Typing the fifth digit applies the ZIP; there is no button to press.
async function enterZip(page: Page, zip: string) {
  const open = page.getByRole("button", { name: "Your ZIP" });
  if (await open.isVisible()) await open.click();
  else await page.getByRole("button", { name: /^ZIP \d{5}\. Change$/ }).click();
  await expect(page.getByLabel("Your ZIP code")).toBeVisible();
  await page.getByLabel("Your ZIP code").pressSequentially(zip);
}

const status = (page: Page) => page.locator("[data-zip-status]");

test.describe("ZIP filter", () => {
  test("applies at the fifth digit, moves to the ZIP's ballot, hides other places' contests, and remembers the ZIP on this device only", async ({ page }) => {
    await page.goto(SCC);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await enterZip(page, "94040");
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
    await expect(page).toHaveURL(`${BALLOT}?mine=1`);
    await expect(status(page)).toContainText(/\d+ of \d+ contests can be on your ballot in 94040/);
    await expect(page.getByRole("button", { name: "ZIP 94040. Change" })).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "Santa Clara" })).not.toHaveAttribute("aria-current", "page");
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);
    await expect(contestRow(page, "Proposition B")).toHaveCount(0);
    await expect(contestRow(page, "Mountain View City Council")).toBeVisible();
    await expect(page.getByText("May be on your ballot").filter({ visible: true }).first()).toBeVisible();
    expect(page.url()).not.toContain("94040");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
    await expect(contestRow(page, "Palo Alto City Council")).toHaveCount(0);

    await status(page).getByRole("button", { name: "Show all" }).click();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(page.getByText("Probably not on ballots in ZIP 94040").filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear ZIP" }).click();
    await expect(page.getByRole("button", { name: "Your ZIP" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await expect(page).toHaveURL(BALLOT);
  });

  test("picking an area chip sets the ZIP aside; the ZIP chip brings its ballot back; Back and reload agree", async ({ page }) => {
    await page.goto(BALLOT);
    await enterZip(page, "94040");
    const areas = page.getByRole("navigation", { name: "Area" });
    await areas.getByRole("link", { name: "Santa Clara" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(status(page)).not.toContainText("can be on your ballot");
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
    await areas.getByRole("link", { name: "Clear Santa Clara" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ZIP 94040. Show its ballot" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await page.getByRole("button", { name: "ZIP 94040. Show its ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
    await areas.getByRole("link", { name: "Bay Area" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
  });

  test("before the other areas' data loads, entering a ZIP still reaches its ballot with focus on the chip", async ({ page }) => {
    await page.route("**/snapshot.json", () => {});
    await page.goto(SCC);
    await enterZip(page, "94040");
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ZIP 94040. Change" })).toBeFocused();
  });

  test("an unknown ZIP stays on the page and says so", async ({ page }) => {
    await page.goto(SCC);
    await enterZip(page, "10001");
    await expect(status(page)).toContainText("isn’t a Bay Area ZIP");
    await expect(page.getByRole("heading", { level: 1, name: "Santa Clara County ballot" })).toBeVisible();
  });

  test("a filter change on the ZIP's ballot keeps it, and changing the ZIP adds no Back step", async ({ page }, info) => {
    await page.goto(BALLOT);
    await enterZip(page, "94040");
    await expect(page).toHaveURL(`${BALLOT}?mine=1`);
    const panel = isPhone(info)
      ? (await page.getByRole("button", { name: /^Filters/ }).click(), page.getByRole("dialog", { name: "Filters" }))
      : page.getByRole("complementary", { name: "Filters" });
    await panel.getByRole("checkbox", { name: /Only guides that explain/ }).click();
    await expect(page).toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(/[?&]mine=1/);
    if (isPhone(info)) await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94040 ballot" })).toBeVisible();

    await page.getByRole("button", { name: "ZIP 94040. Change" }).click();
    await page.getByLabel("Your ZIP code").pressSequentially("94301");
    await expect(page.getByRole("heading", { level: 1, name: "ZIP 94301 ballot" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
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
    await page.goto(BALLOT);
    await enterZip(page, "94040");
    await expect(status(page).getByRole("button", { name: "Show all" })).toBeVisible();
    await page.goto(`${BALLOT}?mine=1&c=palo-alto-council`);
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(status(page).getByRole("button", { name: "Hide the others" })).toBeVisible();
  });

  test("a ZIP reaching two counties keeps both counties' contests", async ({ page }) => {
    await page.goto(BALLOT);
    await enterZip(page, "94303");
    await expect(status(page)).toContainText("in 94303");
    await expect(contestRow(page, "Palo Alto City Council")).toBeVisible();
    await expect(contestRow(page, "Menlo Park City Council, District 1")).toBeVisible();
    await expect(contestRow(page, "Proposition B")).toHaveCount(0);
  });

  test("an SF ZIP keeps only the supervisor districts it reaches", async ({ page }) => {
    await page.goto(BALLOT);
    await enterZip(page, "94114");
    await expect(status(page)).toContainText("in 94114");
    await expect(contestRow(page, "Board of Supervisors, District 8")).toBeVisible();
    await expect(contestRow(page, "Board of Supervisors, District 4")).toHaveCount(0);
    await expect(contestRow(page, "Board of Supervisors, District 10")).toHaveCount(0);
    await enterZip(page, "94110");
    await expect(status(page)).toContainText("in 94110");
    await expect(contestRow(page, "Board of Supervisors, District 8")).toBeVisible();
    await expect(contestRow(page, "Board of Supervisors, District 10")).toBeVisible();
    await expect(contestRow(page, "Board of Supervisors, District 2")).toHaveCount(0);
  });


});
