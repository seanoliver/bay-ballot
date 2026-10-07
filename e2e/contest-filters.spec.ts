import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot, watchErrors } from "./helpers";

const PROP_B = `${BALLOT}/prop-b`;
const ANSWER = /(voter guides? recommends?|voter guides split) .* on Prop B, as of /;
const TITLE = /^SF Prop B endorsements \(Nov 2026\)/;

async function filterPanel(page: Page, info: TestInfo) {
  if (!isPhone(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

async function openContest(page: Page, query = "") {
  await page.goto(`${PROP_B}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Proposition B" })).toBeVisible();
}

test.describe("contest page filters", () => {
  test("the Filters menu lists only the guides that took a position on the contest", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openContest(page);
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("checkbox", { name: "Only guides that explain their endorsements" })).toBeVisible();
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await expect(panel.getByRole("checkbox", { name: /SF Republican Party/ })).toBeVisible();
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("abundant");
    await expect(panel.getByText(/No guides match/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("hiding a guide changes the counts and the answer, not the title, and says so", async ({ page }, info) => {
    await openContest(page);
    const answer = page.getByText(ANSWER);
    const before = await answer.textContent();
    const panel = await filterPanel(page, info);
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await panel.getByRole("checkbox", { name: /SF Republican Party/ }).click();
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    if (isPhone(info)) await panel.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    await expect(answer).not.toHaveText(before!);
    await expect(page).toHaveTitle(TITLE);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toMatch(/ on Prop B/);
    await expect(page.getByRole("link", { name: "SF Republican Party", exact: true })).toHaveCount(0);
  });

  test("a type turned off on a contest page is off everywhere, not mixed on the list", async ({ page }, info) => {
    await openContest(page);
    const panel = await filterPanel(page, info);
    await panel.getByRole("checkbox", { name: /^Unions/ }).click();
    await expect(page).toHaveURL(/[?&]off=[^&]*smc-labor-council/);
    await page.evaluate(() => localStorage.setItem("bb-area", "bay-area"));
    await openBallot(page);
    const list = await filterPanel(page, info);
    await expect(list.getByRole("checkbox", { name: /^Unions/ })).toHaveAttribute("aria-checked", "false");
  });

  test("Show all turns the hidden guides back on and leaves other filters alone", async ({ page }) => {
    await openContest(page, "?off=sf-gop,spur,abundant-sf");
    await expect(page.getByText("2 guides hidden")).toBeVisible();
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByText(/guides? hidden/)).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]off=abundant-sf(&|$)/);
    await expect(page.getByText("29 of 29 guides counted").filter({ visible: true })).toBeVisible();
  });

  test("a filter set on the list applies on a contest page opened later, and comes back", async ({ page }, info) => {
    await openBallot(page);
    const panel = await filterPanel(page, info);
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await panel.getByRole("checkbox", { name: /SF Republican Party/ }).click();
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    await openContest(page);
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.getByRole("link", { name: "San Francisco ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const back = await filterPanel(page, info);
    await back.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await expect(back.getByRole("checkbox", { name: /SF Republican Party/ })).toBeChecked();
  });

  test("links between the list and a contest page keep the filter params", async ({ page }) => {
    await openBallot(page, "?off=sf-gop&why=1&c=prop-b");
    await expect(contestRow(page, "Proposition B")).toHaveAttribute("href", "/2026-11/prop-b?off=sf-gop&why=1");
    await page.goto(`${PROP_B}?off=sf-gop&why=1`);
    await expect(page.getByRole("link", { name: "San Francisco ballot" })).toHaveAttribute("href", "/2026-11/sf?off=sf-gop&why=1");
  });

  test("a stored filter renders without hydration errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => window.localStorage.setItem("bb-filters", "off=sf-gop"));
    await openContest(page);
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("desktop contest page layout", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("the contest column sits where the list column does, beside the filter column", async ({ page }) => {
    await openBallot(page);
    const listX = (await page.locator("[data-keys=list]").boundingBox())!.x;
    await openContest(page);
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
    const box = (await page.locator("[data-page-column]").boundingBox())!;
    expect(Math.round(box.x)).toBe(Math.round(listX));
    expect(Math.round(box.width)).toBe(768);
  });

  test("/ focuses the guide search", async ({ page }) => {
    await openContest(page);
    await page.keyboard.press("/");
    await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("searchbox", { name: "Search guides" })).toBeFocused();
  });
});

test.describe("phone contest page layout", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("the Filters button sits above the contest card and names the count", async ({ page }) => {
    await openContest(page, "?off=sf-gop");
    const button = page.getByRole("button", { name: /^Filters/ });
    await expect(button).toContainText(/28 of 29 guides counted/);
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeHidden();
  });
});
