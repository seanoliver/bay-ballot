import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, openBallot } from "./helpers";

test("the Bay Area list groups contests by place and the picker opens an area", async ({ page }) => {
  await openBallot(page);
  await expect(page).toHaveTitle("Bay Area endorsements (Nov 2026)");
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toBeVisible();
  await expect(contestRow(page, "Proposition B")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Area" });
  await expect(nav.getByRole("link", { name: "Bay Area" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "San Francisco" }).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
  await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
});

test("the SF page has its own title, canonical URL and contests", async ({ page }) => {
  await page.goto(`${BALLOT}/sf`);
  await expect(page).toHaveTitle("San Francisco endorsements (Nov 2026)");
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bayballot.com${BALLOT}/sf`);
  await expect(page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "San Francisco" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/November 3, 2026 · \d+ guides · \d+ contests · \d+ endorsements/)).toBeVisible();
  await expect(contestRow(page, "Proposition B")).toBeVisible();
});

test("old contest links still work and link back to their area", async ({ page }) => {
  for (const id of ["prop-b", "supervisor-8", "governor"]) {
    const res = await page.goto(`${BALLOT}/${id}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto(`${BALLOT}/prop-b`);
  await expect(page.getByRole("link", { name: "San Francisco ballot" })).toHaveAttribute("href", `${BALLOT}/sf`);
});

test("a returning visitor with saved filters lands on the SF page once", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("bb-filters", "why=1"));
  await page.goto(BALLOT);
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
  await page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "Bay Area" }).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
});

test("share image alt text names no place on contest and area pages", async ({ page }) => {
  for (const path of [`${BALLOT}/prop-b`, `${BALLOT}/governor`, `${BALLOT}/sf`]) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", "How voter guides split, side by side");
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute("content", "How voter guides split, side by side");
  }
});

test("?c= on the SF page opens that contest's details, and Back on a phone closes the sheet", async ({ page, isMobile }) => {
  if (!isMobile) {
    await page.goto(`${BALLOT}/sf?c=prop-b`);
    await expect(page.getByRole("region", { name: "Proposition B" })).toBeVisible();
    return;
  }
  await page.goto(`${BALLOT}/sf`);
  await contestRow(page, "Proposition B").tap();
  const sheet = page.getByRole("dialog", { name: "Proposition B" });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf\\?c=prop-b$`));
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf`));
});

test("a visitor whose first list page is /sf is never redirected from the Bay Area list", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("bb-filters", "why=1"));
  await page.goto(`${BALLOT}/sf`);
  await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
  await page.goto(BALLOT);
  await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
});
