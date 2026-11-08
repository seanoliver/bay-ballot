import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { coverage } from "../src/lib/coverage";
import { loadElection } from "../src/lib/data";
import { dataAsOf } from "../src/lib/display";
import { publishedGuides } from "../src/lib/filters";
import { watchErrors } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const counts = coverage(data);
const guide = [...publishedGuides(data.guides, data.endorsements)].sort((a, b) => a.name.localeCompare(b.name)).at(-1)!;

const main = (page: Page) => page.getByRole("main");
const linkSection = (page: Page) => main(page).getByRole("region", { name: "Link to Bay Ballot" });
const snippet = (page: Page) => linkSection(page).locator("code");

test("the press kit has the paragraph, live counts, downloads, a link maker and the contact address", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/press");
  await expect(main(page).getByRole("heading", { level: 1, name: "Press kit" })).toBeVisible();
  expect(await main(page).getByRole("heading", { level: 2 }).allTextContents()).toEqual([
    "About Bay Ballot",
    "By the numbers",
    "Screenshots",
    "Logo",
    "Link to Bay Ballot",
    "Contact",
  ]);
  await expect(main(page).getByText(`shows the endorsements of ${counts.guides} Bay Area voter guides for the November 3, 2026 election`)).toBeVisible();

  const numbers = main(page).getByRole("region", { name: "By the numbers" });
  for (const [n, label] of [
    [counts.guides, "voter guides"],
    [counts.contests, "contests"],
    [counts.counties, "counties"],
  ] as const) {
    await expect(numbers.getByRole("definition").filter({ hasText: new RegExp(`^${n}$`) })).toHaveCount(1);
    await expect(numbers.getByRole("term").filter({ hasText: label })).toHaveCount(1);
  }
  await expect(numbers).toContainText(`As of ${dataAsOf(data.endorsements)}.`);

  const downloads = await main(page).locator("a[download]").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  expect(downloads).toHaveLength(5);
  for (const href of downloads) expect((await page.request.get(href)).ok()).toBe(true);
  await expect(main(page).getByText("Free to use with credit to Bay Ballot.")).toBeVisible();

  await expect(main(page).getByText("corrections@bayballot.com", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the link maker shows the whole-site link without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/press");
  await expect(snippet(page)).toHaveText('<a href="https://bayballot.com">Bay Ballot, every Bay Area voter guide side by side</a>');
  await context.close();
});

test("choosing a guide links to its page, and Copy copies it", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/press");
  const select = linkSection(page).getByLabel("Link to");
  await expect(select.locator("option").first()).toHaveText("The whole site");
  await expect(select.locator("option")).toHaveCount(counts.guides + 1);
  await select.selectOption({ label: guide.name });
  await expect(snippet(page)).toContainText(`href="https://bayballot.com/guides/${guide.id}"`);
  const copy = linkSection(page).getByRole("button", { name: "Copy" });
  await copy.click();
  await expect(linkSection(page).getByRole("button", { name: "✓ Copied" })).toBeVisible();
  if (browserName === "chromium") expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await snippet(page).textContent());
  await select.selectOption({ label: "The whole site" });
  await expect(linkSection(page).getByRole("button", { name: "Copy" })).toBeVisible({ timeout: 1000 });
  await copy.click();
  await expect(linkSection(page).getByRole("button", { name: "✓ Copied" })).toBeVisible();
  await expect(linkSection(page).getByRole("button", { name: "Copy" })).toBeVisible({ timeout: 4000 });
});

test("when the clipboard is refused, the code stays and the button says to select it", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
  });
  await page.goto("/press");
  await linkSection(page).getByRole("button", { name: "Copy" }).click();
  await expect(linkSection(page).getByRole("button", { name: "Select the code above to copy" })).toBeVisible();
  await expect(snippet(page)).toBeVisible();
  await expect(snippet(page)).toContainText("https://bayballot.com");
  const selected = () => page.evaluate(() => window.getSelection()?.toString());
  expect(await selected()).toBe(await snippet(page).textContent());
  const about = main(page).getByRole("region", { name: "About Bay Ballot" });
  await about.getByRole("button", { name: "Copy" }).click();
  await expect(about.getByRole("button", { name: "Select the paragraph above to copy" })).toBeVisible();
  expect(await selected()).toBe(await about.locator("p").textContent());
});

test("the footer's Press kit link reaches the press kit", async ({ page }) => {
  await page.goto("/about");
  const link = page.getByRole("contentinfo").getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Press kit" });
  await expect(link).toHaveAttribute("href", "/press");
  await link.click();
  await expect(page).toHaveURL(/\/press$/);
  await expect(page.getByRole("heading", { level: 1, name: "Press kit" })).toBeVisible();
});
