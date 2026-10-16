import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { coverage, coverageSentence } from "../src/lib/coverage";
import { loadElection } from "../src/lib/data";
import { BALLOT } from "./helpers";

const REPO = "https://github.com/seanoliver/bay-ballot";
const data = loadElection(path.join(process.cwd(), "data"), "2026-11");

const question = (page: Page, name: string) => page.getByRole("main").getByRole("button", { name });

async function open(page: Page, name: string) {
  const q = question(page, name);
  await q.click();
  await expect(q).toHaveAttribute("aria-expanded", "true");
}

test("the About page says what the site is, then how to use it, then the questions", async ({ page }) => {
  await page.goto("/about");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toBeVisible();
  await expect(main.getByText("Every Bay Area voter guide for the November 3, 2026 election, side by side, one contest at a time")).toBeVisible();
  await expect(main.getByText("It doesn't tell you how to vote.", { exact: false }).first()).toBeVisible();
  expect(await main.getByRole("heading", { level: 2 }).allTextContents()).toEqual(["How to use it", "Questions"]);
});

test("the About page shows three numbered steps and a link to the ballot", async ({ page }) => {
  await page.goto("/about");
  const steps = page.getByRole("main").getByRole("list", { name: "How to use it" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Pick your area or enter your ZIP");
  await expect(steps.nth(0)).toContainText("Your ZIP stays on your device.");
  await expect(steps.nth(1)).toContainText("Open a contest");
  await expect(steps.nth(2)).toContainText("Pin the guides you trust");
  await expect(steps.nth(2)).toContainText("Tap the pin on up to 4 guides.");
  await expect(page.getByRole("main").getByRole("link", { name: "Go to the ballot" })).toHaveAttribute("href", BALLOT);
});

test("the About page's questions start closed and open to show their answers", async ({ page }) => {
  await page.goto("/about");
  const names = [
    "Is my area covered?",
    "How are guides counted?",
    "How are guides chosen?",
    "How do you check the quotes?",
    "Is it partisan?",
    "What do you track?",
    "Something's wrong. How do I report it?",
    "Who made Bay Ballot?",
  ];
  for (const name of names) await expect(question(page, name)).toHaveAttribute("aria-expanded", "false");
  const answer = page.getByRole("main").getByText("A guide that ranks candidates counts toward its first choice.");
  await expect(answer).toBeHidden();
  await open(page, "How are guides counted?");
  await expect(answer).toBeVisible();
  await question(page, "How are guides counted?").click();
  await expect(question(page, "How are guides counted?")).toHaveAttribute("aria-expanded", "false");
  await expect(answer).toBeHidden();
});

test("the About page's answers are in the server HTML", async ({ request }) => {
  const html = await (await request.get("/about")).text();
  expect(html).toContain("Guides that publish only a list of endorsements show no quotes.");
  expect(html).toContain("It never records addresses or ZIP codes.");
  expect(html).toContain('href="mailto:corrections@bayballot.com"');
});

test("Is my area covered? on the About page counts the data and links every area's ballot", async ({ page, request }) => {
  await page.goto("/about");
  await open(page, "Is my area covered?");
  const main = page.getByRole("main");
  await expect(main.getByText(coverageSentence(coverage(data)))).toBeVisible();
  for (const a of data.areas) {
    const link = main.getByRole("link", { name: a.name, exact: true });
    await expect(link).toHaveAttribute("href", `${BALLOT}/${a.id}`);
    expect((await request.get(`${BALLOT}/${a.id}`)).status()).toBe(200);
  }
});

test("the About page keeps every method fact and link", async ({ page }) => {
  await page.goto("/about");
  const main = page.getByRole("main");
  await open(page, "How are guides chosen?");
  await expect(main.getByText("A guide's endorsements appear once it publishes them for this election.")).toBeVisible();
  await open(page, "How do you check the quotes?");
  await expect(main.getByText("A separate check confirms each quote appears word for word on the guide's page.", { exact: false })).toBeVisible();
  await expect(main.getByText("Guides are checked for updates every day", { exact: false })).toBeVisible();
  await expect(main.getByRole("link", { name: "changelog" })).toHaveAttribute("href", "/changelog");
  await open(page, "Is it partisan?");
  await expect(main.getByText("Bay Ballot makes no endorsements of its own.")).toBeVisible();
  await expect(main.getByRole("link", { name: "public on GitHub" })).toHaveAttribute("href", REPO);
  await open(page, "What do you track?");
  await expect(main.getByText("Neither uses cookies.", { exact: false })).toBeVisible();
  await expect(main.getByText("A ZIP code you enter stays on your device.", { exact: false })).toBeVisible();
  await open(page, "Something's wrong. How do I report it?");
  await expect(main.getByRole("link", { name: "corrections@bayballot.com" })).toHaveAttribute("href", "mailto:corrections@bayballot.com");
  await expect(main.getByRole("link", { name: "Open an issue on GitHub" })).toHaveAttribute("href", `${REPO}/issues/new?template=data-correction.yml`);
  await expect(main.getByRole("link", { name: "pull request" })).toHaveAttribute("href", `${REPO}/pulls`);
});

test("the About page's last question holds Sean's signed letter", async ({ page }) => {
  await page.goto("/about");
  const main = page.getByRole("main");
  const story = main.getByText("I've lived in San Francisco since 2012, and both my kids are in SFUSD.");
  await expect(story).toBeHidden();
  await open(page, "Who made Bay Ballot?");
  await expect(story).toBeVisible();
  await expect(main.getByText("It shows you what the people who spend time on this are recommending, and why.")).toBeVisible();
  await expect(main.getByRole("link", { name: "seanoliver.dev" })).toHaveAttribute("href", "https://seanoliver.dev");
});

test("the About page never mentions AI or models", async ({ page }) => {
  await page.goto("/about");
  const text = await page.getByRole("main").textContent();
  expect(text).not.toMatch(/\b(AI|LLMs?|models?|Claude)\b/i);
});
