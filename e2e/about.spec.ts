import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { coverage, coverageSentence } from "../src/lib/coverage";
import { loadElection } from "../src/lib/data";
import { BALLOT } from "./helpers";
import { MAX_PINS } from "../src/lib/filters";

const REPO = "https://github.com/seanoliver/bay-ballot";
const data = loadElection(path.join(process.cwd(), "data"), "2026-11");

const LETTER = [
  "I've lived in San Francisco since 2012, and both my kids are in SFUSD. Every election since 2016, I've sat down with my ballot and a dozen browser tabs: the Chronicle, the League of Women Voters, the local clubs and unions, a few advocacy groups. I kept a spreadsheet of who endorsed what, to see where the guides agreed and where they split.",
  "Over the years I started sharing that spreadsheet with friends and colleagues to help them vote, and kept running into the same problem. Many of them live outside San Francisco, all over the Bay Area, and my spreadsheet only covered the city.",
  "So I turned it into Bay Ballot: one place for every voter guide in the Bay Area, side by side, one contest at a time, with the reasons each guide gives in its own words. It starts with San Francisco, the Peninsula, the South Bay, the East Bay and the North Bay and will grow from there. It stays up to date as guides publish, and it's free for everyone.",
  "It doesn't tell you how to vote. It shows you what the people who spend time on this are recommending, and why.",
];

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
  await expect(steps.nth(0)).toContainText("Your area shows its contests. Add your ZIP to narrow them to the ones that can be on your ballot. Your ZIP stays on your device.");
  await expect(steps.nth(1)).toContainText("Open a contest");
  await expect(steps.nth(2)).toContainText("Pin the guides you trust");
  await expect(steps.nth(2)).toContainText(`Tap the pin on up to ${MAX_PINS} guides. Their picks then show on every contest.`);
  await expect(steps.nth(1)).toContainText("See how the guides split, then read their reasons.");
  await expect(page.getByRole("main").getByRole("link", { name: "Go to the ballot" })).toHaveAttribute("href", BALLOT);
});

test("the About page's steps are one list at reading width, drawings beside the text on desktop and under it on phones", async ({ page }) => {
  await page.goto("/about");
  const list = page.getByRole("main").getByRole("list", { name: "How to use it" });
  const steps = list.getByRole("listitem");
  const ys = await Promise.all([0, 1, 2].map(async (i) => (await steps.nth(i).boundingBox())!.y));
  expect(ys[0] < ys[1] && ys[1] < ys[2]).toBe(true);
  const intro = (await page.getByRole("main").locator("p").first().boundingBox())!;
  expect(Math.abs((await list.boundingBox())!.width - intro.width)).toBeLessThanOrEqual(1);
  expect(await list.evaluate((e) => parseFloat(getComputedStyle(e).borderTopWidth))).toBeGreaterThan(0);
  const dividers = await steps.evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).borderTopWidth)));
  expect(dividers[0]).toBe(0);
  expect(dividers.slice(1).every((w) => w > 0)).toBe(true);
  for (const el of await steps.locator("[data-slot=item-title], [data-slot=item-description]").all()) {
    expect(await el.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(true);
  }
  for (let i = 0; i < 3; i++) {
    const text = (await steps.nth(i).locator("[data-slot=item-content]").boundingBox())!;
    const drawing = (await steps.nth(i).locator("[data-slot=item-actions]").boundingBox())!;
    if (page.viewportSize()!.width < 640) expect(drawing.y).toBeGreaterThanOrEqual(text.y + text.height);
    else expect(drawing.x).toBeGreaterThanOrEqual(text.x + text.width);
  }
});

test("the About page hides the step drawings from screen readers", async ({ page }) => {
  await page.goto("/about");
  const drawings = page.getByRole("main").getByRole("list", { name: "How to use it" }).locator("[data-slot=item-actions]");
  await expect(drawings).toHaveCount(3);
  for (const d of await drawings.all()) await expect(d).toHaveAttribute("aria-hidden", "true");
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
  for (const a of data.areas) await expect(main.getByRole("link", { name: a.name, exact: true })).toHaveAttribute("href", `${BALLOT}/${a.id}`);
  const statuses = await Promise.all(data.areas.map(async (a) => (await request.get(`${BALLOT}/${a.id}`)).status()));
  expect(statuses).toEqual(data.areas.map(() => 200));
});

test("the About page keeps every method fact and link", async ({ page }) => {
  await page.goto("/about");
  const main = page.getByRole("main");
  await open(page, "How are guides counted?");
  for (const rule of [
    "Only guides that took a position on a contest count toward it.",
    "A guide that ranks candidates counts toward its first choice.",
    "In races with more than one seat, each name a guide endorses counts.",
    "Every page counts every guide that took a position, so a contest reads the same everywhere. On an area's page, a contest's details list the guides that cover that area first.",
  ])
    await expect(main.getByText(rule)).toBeVisible();
  await open(page, "How are guides chosen?");
  await expect(main.getByText("newspaper editorial boards, party committees, political clubs, labor councils, advocacy groups and civic groups.", { exact: false })).toBeVisible();
  await expect(main.getByText("A guide's endorsements appear once it publishes them for this election.")).toBeVisible();
  await open(page, "How do you check the quotes?");
  await expect(main.getByText("A separate check confirms each quote appears word for word on the guide's page.", { exact: false })).toBeVisible();
  await expect(main.getByText("For most guides, an automated process reads the guide's published pages", { exact: false })).toBeVisible();
  await expect(main.getByText("Quotes that fail are left out, and endorsements the check can't confirm stay off the site until they're confirmed.", { exact: false })).toBeVisible();
  await expect(main.getByText("A few guides publish their endorsements as images or documents, and I enter those by hand.", { exact: false })).toBeVisible();
  await expect(main.getByText("I monitor the whole process closely.", { exact: false })).toBeVisible();
  await expect(main.getByText("Each quote links to its source or an archived copy.", { exact: false })).toBeVisible();
  await expect(main.getByText("Guides are checked for updates every day, and the few that can't be checked automatically are checked by hand.", { exact: false })).toBeVisible();
  await expect(main.getByRole("link", { name: "changelog" })).toHaveAttribute("href", "/changelog");
  await open(page, "Is it partisan?");
  await expect(main.getByText("Bay Ballot makes no endorsements of its own.")).toBeVisible();
  await expect(main.getByRole("link", { name: "public on GitHub" })).toHaveAttribute("href", REPO);
  await expect(main.getByText("so anyone can see exactly how it works.", { exact: false })).toBeVisible();
  await expect(main.getByText("It is not affiliated with any guide or campaign.")).toBeVisible();
  await open(page, "What do you track?");
  await expect(main.getByText("Neither uses cookies.", { exact: false })).toBeVisible();
  await expect(main.getByText("Bay Ballot counts page views with Vercel Web Analytics and Ahrefs Web Analytics, which also counts link clicks.", { exact: false })).toBeVisible();
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
  for (const paragraph of LETTER) await expect(main.getByText(paragraph, { exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "seanoliver.dev" })).toHaveAttribute("href", "https://seanoliver.dev");
});

test("the About page never mentions AI or models", async ({ page }) => {
  await page.goto("/about");
  // Join text nodes with spaces: textContent runs adjacent elements together, hiding a word at an element edge.
  const text = await page.getByRole("main").evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
    return parts.join(" ");
  });
  expect(text).toContain("I monitor the whole process closely.");
  expect(text).not.toMatch(/\b(AI|LLMs?|models?|Claude)\b/i);
});
