import { expect, test } from "@playwright/test";

const REPO = "https://github.com/seanoliver/bay-ballot";

test("the About page opens with Sean's signed letter", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(
    main.getByText("Endorsements for the November 3, 2026 election from voter guides in San Francisco, San Mateo County, Santa Clara County (including San Jose, Palo Alto and Mountain View), Alameda County (including Oakland and Berkeley), Contra Costa County and Marin County."),
  ).toBeVisible();
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
  await expect(page.getByRole("main").getByText("A guide's endorsements appear once it publishes them for this election.")).toBeVisible();
  await expect(page.getByRole("main").getByText("For most guides, an automated process reads the guide's published pages")).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Quotes that fail are left out, and endorsements the check can't confirm stay off the site until they're confirmed."),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("A few guides publish their endorsements as images or documents, and I enter those by hand.")).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Guides are checked for updates every day, and the few that can't be checked automatically are checked by hand."),
  ).toBeVisible();
  await expect(page.getByRole("main").getByText("Each quote links to its source or an archived copy.")).toBeVisible();
  await expect(page.getByRole("main").getByText("Guides that publish only a list of endorsements show no quotes.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "changelog" })).toHaveAttribute("href", "/changelog");
  await expect(page.getByRole("main").getByRole("link", { name: "public on GitHub" })).toHaveAttribute("href", REPO);
});

test("the About page never mentions AI or models", async ({ page }) => {
  await page.goto("/about");
  const text = await page.getByRole("main").innerText();
  expect(text).not.toMatch(/\b(AI|LLMs?|models?|Claude)\b/i);
});
