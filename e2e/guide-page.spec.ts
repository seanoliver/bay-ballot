import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { TYPE_LABEL } from "../src/lib/filters";
import { BALLOT, openBallot } from "./helpers";

const GUIDE = "/guides/sf-chronicle";
const data = loadElection(path.join(process.cwd(), "data"), "2026-11");

// The card's look, read off the element: a change to CARD on one page only shows up as a mismatch.
const cardStyle = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { radius: s.borderRadius, background: s.backgroundColor, ring: s.boxShadow, padding: s.padding };
  });

test("the guide page header is a card with type, links and a stat line", async ({ page }) => {
  await page.goto(GUIDE);
  const card = page.locator("header", { has: page.getByRole("heading", { level: 1, name: "San Francisco Chronicle" }) });
  await expect(card.getByText("Newspaper", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /^Homepage/ })).toHaveAttribute("target", "_blank");
  await expect(card.getByRole("link", { name: /^Endorsements page/ })).toBeVisible();
  await expect(card.getByText(/^\d+ picks · \d+ with reasons · as of \w+ \d+, \d{4}$/)).toBeVisible();
});

test("a list-only guide's stat line says List only instead of a reasons count", async ({ page }) => {
  const listOnly = Object.values(data.endorsements).find((e) => e.status === "published" && !e.hasReasoning);
  test.skip(!listOnly, "every published guide explains its picks");
  await page.goto(`/guides/${listOnly!.guide}`);
  await expect(page.locator("header").getByText(/^\d+ picks? · List only · as of \w+ \d+, \d{4}$/)).toBeVisible();
});

for (const [type, label] of Object.entries(TYPE_LABEL)) {
  test(`a ${type} guide's page shows the ${label} label`, async ({ page }) => {
    const guide = data.guides.find((g) => g.type === type);
    test.skip(!guide, `no ${type} guide`);
    await page.goto(`/guides/${guide!.id}`);
    await expect(page.locator("header", { has: page.getByRole("heading", { level: 1 }) }).getByText(label, { exact: true })).toBeVisible();
  });
}

test("at 320px a long pick name stays on one line", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone width");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/guides/growsf");
  // No real label is long enough to wrap at 320px, so write one in.
  const lines = await page.locator("li [aria-hidden=true] > span").first().evaluate((part) => {
    const label = [...part.childNodes].find((n): n is Text => n.nodeType === Node.TEXT_NODE)!;
    label.data = "Maximiliana Christopherson-Montgomery Wellington";
    const r = document.createRange();
    r.selectNodeContents(label);
    return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
  });
  expect(lines).toBe(1);
});

test("the guide header and the contest page share the card look", async ({ page }) => {
  await page.goto(GUIDE);
  const guide = await cardStyle(page, "main header");
  await page.goto(`${BALLOT}/prop-d`);
  const contest = await cardStyle(page, "main section:has(h1)");
  expect(guide.radius).not.toBe("0px");
  expect(guide.ring).not.toBe("none");
  expect(contest).toEqual(guide);
});

test("the breadcrumb is 14px on the guide and contest pages", async ({ page }) => {
  for (const [url, name] of [[GUIDE, "Bay Area ballot"], [`${BALLOT}/prop-d`, "San Francisco ballot"]]) {
    await page.goto(url);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCSS("font-size", "14px");
  }
});

test("a guide spanning counties links back to the Bay Area ballot", async ({ page }) => {
  await page.goto(GUIDE);
  await page.getByRole("link", { name: "Bay Area ballot", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
});

test("a one-area guide links back to its area's ballot", async ({ page }) => {
  await page.goto("/guides/growsf");
  await expect(page.getByRole("link", { name: "San Francisco ballot", exact: true })).toHaveAttribute("href", `${BALLOT}/sf`);
});

test("picks sit under the ballot's place and section headings, in ballot order", async ({ page, isMobile }) => {
  test.skip(isMobile, "the ballot's row ids are read from the desktop list");
  await page.goto(GUIDE);
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("California");
  await expect(page.getByRole("region", { name: "California", exact: true }).getByRole("heading", { level: 3 }).first()).toHaveText("Federal");
  const labels = () => page.locator("section[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  const sections = await labels();
  const picked = await page.locator("ul a[href^='/2026-11/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("/").pop()!));
  expect(sections).toContain("San Francisco: Local propositions");
  expect(picked.length).toBeGreaterThan(10);

  await openBallot(page);
  expect((await labels()).filter((l) => sections.includes(l))).toEqual(sections);
  const ballot = await page.locator("[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
  expect(ballot.filter((id) => picked.includes(id))).toEqual(picked);
});

test("a pick row links to its contest", async ({ page }) => {
  await page.goto(GUIDE);
  const row = page.getByRole("link", { name: /^Proposition D: (Yes|No)$/ });
  await row.click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/prop-d$`));
  await expect(page.getByRole("heading", { level: 1, name: "Proposition D" })).toBeVisible();
});

test("the contest page has a breadcrumb back to its ballot", async ({ page }) => {
  await page.goto(`${BALLOT}/prop-d`);
  const crumb = page.getByRole("link", { name: "San Francisco ballot", exact: true });
  await expect(crumb).toHaveAttribute("href", `${BALLOT}/sf`);
  const box = (await crumb.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(40);
});
