import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot, watchErrors } from "./helpers";

test("ballot page has the header, logo, intro and footer", async ({ page }) => {
  const errors = watchErrors(page);
  await openBallot(page);
  const home = page.getByRole("banner").getByRole("link", { name: "Bay Ballot" });
  await expect(home).toBeVisible();
  await expect(home.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("banner").getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByText(/November 3, 2026 · \d+ guides · \d+ contests · \d+ picks/)).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Made with ❤️ in San Francisco by")).toBeVisible();
  await expect(footer.getByRole("link", { name: "Sean Oliver" })).toHaveAttribute("href", "https://seanoliver.dev");
  await expect(footer.getByText(/Data as of /)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the reasons filter goes into the URL and survives a reload", async ({ page }, info) => {
  await openBallot(page);
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const dialogOrPage = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await dialogOrPage.getByRole("checkbox", { name: "Only guides that explain their picks" }).click();
  await expect(page).toHaveURL(/[?&]why=1/);
  await page.reload();
  await expect(page).toHaveURL(/[?&]why=1/);
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  await expect(dialogOrPage.getByRole("checkbox", { name: "Only guides that explain their picks" })).toBeChecked();
});

test.describe("desktop detail pane", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("selecting a contest opens the pane with its result, chips and links", async ({ page }) => {
    await openBallot(page);
    await contestRow(page, "Proposition B").click();
    await expect(page).toHaveURL(/[?&]c=prop-b/);
    const pane = page.getByRole("region", { name: "Proposition B" });
    await expect(pane).toBeVisible();
    await expect(pane.getByText(/^(Yes|No) \d+%$|^Split$/).first()).toBeVisible();
    const chips = pane.getByRole("list").first().getByRole("link");
    expect(await chips.count()).toBeGreaterThan(0);
    const more = pane.getByRole("button", { name: /^\+\d+ more$/ }).first();
    const before = await chips.count();
    await more.click();
    // The button relabels itself once expanded.
    await expect(pane.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(await chips.count()).toBeGreaterThan(before);
    const href = await chips.first().getAttribute("href");
    expect(href).toMatch(/^\/guides\/[a-z0-9-]+$/);
    await chips.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("the close button closes the pane and drops the selection", async ({ page }) => {
    await openBallot(page, "?c=prop-b");
    const pane = page.getByRole("region", { name: "Proposition B" });
    await expect(pane).toBeVisible();
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(pane).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]c=/);
  });
});

test.describe("phone sheet", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("tapping a contest opens its sheet and Back closes it", async ({ page }) => {
    await openBallot(page);
    await contestRow(page, "Proposition B").tap();
    const sheet = page.getByRole("dialog", { name: "Proposition B" });
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}`));
  });
});

test("/about renders", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrections" })).toBeVisible();
});

test("an unknown contest is a 404", async ({ page }) => {
  const res = await page.goto(`${BALLOT}/nope`);
  expect(res?.status()).toBe(404);
});

test("dark mode renders without errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await openBallot(page, "?c=prop-b");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(255, 255, 255)");
  expect(errors).toEqual([]);
});
