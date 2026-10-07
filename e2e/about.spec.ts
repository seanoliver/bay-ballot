import { expect, test } from "@playwright/test";

const REPO = "https://github.com/seanoliver/bay-ballot";

test("the About page opens with Sean's signed letter", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByText("I've lived in San Francisco since 2012, and both my kids are in SFUSD.")).toBeVisible();
  await expect(main.getByText("It shows you what the people who spend time on this are recommending, and why.")).toBeVisible();
  await expect(main.getByRole("link", { name: "seanoliver.dev" })).toHaveAttribute("href", "https://seanoliver.dev");
});

test("the About page explains how it works before the reference sections", async ({ page }) => {
  await page.goto("/about");
  const headings = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
  expect(headings).toEqual([
    "How guides are found",
    "How endorsements are collected",
    "Staying current",
    "Open source",
    "Counting",
    "Independence",
    "Privacy",
    "Corrections",
  ]);
  await expect(page.getByRole("main").getByRole("link", { name: "changelog" })).toHaveAttribute("href", "/changelog");
  await expect(page.getByRole("main").getByRole("link", { name: "public on GitHub" })).toHaveAttribute("href", REPO);
});

test("the About page never mentions AI or models", async ({ page }) => {
  await page.goto("/about");
  const text = await page.getByRole("main").innerText();
  expect(text).not.toMatch(/\b(AI|LLMs?|models?|Claude)\b/i);
});
