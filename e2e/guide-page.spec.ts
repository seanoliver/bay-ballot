import { expect, test } from "@playwright/test";
import { BALLOT, openBallot } from "./helpers";

const GUIDE = "/guides/sf-chronicle";

test("the guide page header is a card with type, links and a stat line", async ({ page }) => {
  await page.goto(GUIDE);
  const card = page.locator("header", { has: page.getByRole("heading", { level: 1, name: "San Francisco Chronicle" }) });
  await expect(card.getByText("Newspaper", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /^Homepage/ })).toHaveAttribute("target", "_blank");
  await expect(card.getByRole("link", { name: /^Endorsements page/ })).toBeVisible();
  await expect(card.getByText(/^\d+ picks · \d+ with reasons · as of \w+ \d+, \d{4}$/)).toBeVisible();
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
