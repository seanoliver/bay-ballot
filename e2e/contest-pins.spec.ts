import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { ballotViewProps } from "../src/lib/site-data";
import { BALLOT, contestRow, isPhone, watchErrors } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
// A multi-seat race with more candidates picked than seats, so it has Other candidates.
const MULTI = data.ballot.contests.find((c) => {
  if (c.kind !== "candidate" || c.seats < 2) return false;
  const names = Object.values(data.endorsements).flatMap((e) => (e.status === "published" && Array.isArray(e.picks[c.id]?.pick) ? (e.picks[c.id].pick as string[]) : []));
  return new Set(names).size > c.seats + 1;
});
// A contest an area's list shows with Bay Area guides, because none of the area's own took a position.
const FALLBACK = data.areas.flatMap((a) => (ballotViewProps(data, { area: a }).fallback?.sections ?? []).flatMap((s) => s.contests.map((id) => ({ area: a.id, id }))))[0];

const PROP_D = `${BALLOT}/prop-d`;
const pinParam = (...ids: string[]) => new RegExp(`[?&]pin=${ids.join("(,|%2C)")}(&|$)`);

async function openContest(page: Page, query = "") {
  await page.goto(`${PROP_D}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Proposition D" })).toBeVisible();
}

async function filterPanel(page: Page, info: TestInfo) {
  if (!isPhone(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

async function closePanel(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Close" }).click();
}

const counted = (page: Page) => page.getByText(/\d+ of \d+ guides counted/).filter({ visible: true }).first();

test.describe("pinning from a contest page", () => {
  test("a guide chip pins the guide, which then shows in Your guides and on the ballot list", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openContest(page);
    const yes = page.getByRole("group", { name: "Guides for Yes" });
    const spur = yes.getByRole("button", { name: "Pin SPUR", exact: true });
    await expect(spur).toHaveAttribute("aria-pressed", "false");
    await spur.click();
    await expect(spur).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(pinParam("spur"));
    await expect(page.getByRole("status")).toHaveText("Pinned SPUR · 1 of 4 pinned");
    if (isPhone(info)) await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("group", { name: "Guides with no pick" }).getByRole("button").first()).toBeVisible();

    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveText(["SPUR"]);
    await closePanel(page, info);

    await page.getByRole("link", { name: "San Francisco ballot", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const chips = page.locator("li").filter({ has: contestRow(page, "Proposition D") }).getByRole("list", { name: "Your guides' picks" }).filter({ visible: true });
    await expect(chips.getByRole("listitem")).toHaveText([/^SPUR:\s*Yes$/]);

    await page.goBack();
    await spur.click();
    await expect(spur).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/[?&]pin=/);
    expect(errors).toEqual([]);
  });

  test("with four pinned, other chips are disabled and say why", async ({ page }) => {
    await openContest(page, "?pin=sf-chronicle,growsf,sf-dems,league-pissed-off-voters");
    await expect(page.getByText("4 of 4 pinned. Unpin one to pin another.")).toBeVisible();
    const fifth = page.getByRole("button", { name: "Pin SPUR", exact: true });
    await expect(fifth).toHaveAttribute("aria-disabled", "true");
    await expect(fifth).toHaveAccessibleDescription("4 of 4 pinned. Unpin one to pin another.");
    await fifth.click({ force: true });
    await expect(fifth).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(pinParam("sf-chronicle", "growsf", "sf-dems", "league-pissed-off-voters"));
    const pinned = page.getByRole("button", { name: "Pin GrowSF", exact: true });
    await expect(pinned).toHaveAttribute("aria-pressed", "true");
    await expect(pinned).not.toHaveAttribute("aria-disabled");
  });

  test("tapping a pin at the limit says why nothing changed", async ({ page }) => {
    await openContest(page, "?pin=sf-chronicle,growsf,sf-dems,league-pissed-off-voters");
    await page.getByRole("button", { name: "Pin SPUR", exact: true }).click({ force: true });
    await expect(page.getByRole("status")).toHaveText("You can pin up to 4 guides. Unpin one first.");
  });

  test("a guide chip still links to the guide's page", async ({ page }) => {
    await openContest(page);
    const link = page.getByRole("group", { name: "Guides for Yes" }).getByRole("link", { name: /^GrowSF/ });
    await expect(link).toHaveAttribute("href", "/guides/growsf");
  });

  test("focus stays on Count only when its side moves in a multi-seat race", async ({ page }) => {
    test.skip(!MULTI, "no multi-seat race with other candidates in today's data");
    await page.goto(`${BALLOT}/${MULTI!.id}`);
    await page.getByRole("button", { name: /^Other candidates/ }).click();
    const others = page.locator("[data-count-only]");
    const button = others.last();
    const key = (await button.getAttribute("data-count-only"))!;
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(":focus")).toHaveAttribute("data-count-only", key);
    await expect(page.locator(":focus")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(page.locator(":focus")).toHaveAttribute("aria-pressed", "false");
  });

  test("Count only counts just one side's guides, and pressing it again or Reset filters undoes it", async ({ page }, info) => {
    await openContest(page);
    const before = (await counted(page).textContent())!.match(/(\d+) of (\d+)/)!;
    const button = page.getByRole("button", { name: /^Count only these \d+ on the ballot$/ }).first();
    const n = (await button.textContent())!.match(/\d+/)![0];
    await expect(page.getByRole("button", { name: /^Count only these/ })).toHaveCount(2);

    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(counted(page)).toContainText(`${n} of ${before[2]} guides counted`);
    await expect(page.getByRole("status")).toHaveText(`Counting only the ${n} guides for Yes`);
    await expect(page.getByRole("heading", { level: 3, name: /^No\s*\d/ })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Guides with no pick" })).toHaveCount(0);

    await button.click();
    await expect(counted(page)).toContainText(`${before[1]} of ${before[2]} guides counted`);
    await expect(page).not.toHaveURL(/[?&]off=/);

    await button.click();
    await expect(counted(page)).toContainText(`${n} of ${before[2]}`);
    const panel = await filterPanel(page, info);
    await panel.getByRole("button", { name: "Reset filters" }).click();
    await closePanel(page, info);
    await expect(counted(page)).toContainText(`${before[1]} of ${before[2]} guides counted`);
    await expect(button).toHaveAttribute("aria-pressed", "false");
  });

  test("a candidate race has a pin list and a Count only button per candidate", async ({ page }) => {
    await page.goto(`${BALLOT}/supervisor-10`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const lists = page.getByRole("group", { name: /^Guides for / });
    expect(await lists.count()).toBeGreaterThan(1);
    await expect(lists.first().getByRole("button", { name: /^Pin / }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Count only these \d+ on the ballot$/ }).first()).toBeVisible();
  });
});

test.describe("pinning from the ballot list's contest detail", () => {
  const SF = `${BALLOT}/sf`;
  const rowPins = (page: Page) =>
    page.locator("li").filter({ has: contestRow(page, "Proposition D") }).getByRole("list", { name: "Your guides' picks" }).filter({ visible: true });

  test("the desktop pane pins guides into the list rows and counts one side", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    const errors = watchErrors(page);
    await page.goto(`${SF}?c=prop-d`);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await expect(pane).toBeVisible();
    await pane.getByRole("button", { name: "Pin SPUR", exact: true }).click();
    await expect(rowPins(page).getByRole("listitem")).toHaveText([/^SPUR:\s*Yes$/]);
    await expect(pane.getByRole("status")).toHaveText("Pinned SPUR · 1 of 4 pinned");
    const sidebar = page.getByRole("complementary", { name: "Filters" });
    await expect(sidebar.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveText(["SPUR"]);

    const countLabel = sidebar.getByText(/guides counted$/);
    const before = (await countLabel.textContent())!;
    const row = page.locator("li").filter({ has: contestRow(page, "Proposition B") }).first();
    const rowBefore = await row.textContent();
    const button = pane.getByRole("button", { name: /^Count only these \d+ on the ballot$/ }).first();
    const n = (await button.textContent())!.match(/\d+/)![0];
    await button.click();
    await expect(countLabel).toHaveText(new RegExp(`^${n} of `));
    await expect(row).not.toHaveText(rowBefore!);
    await sidebar.getByRole("button", { name: "Reset filters" }).click();
    await expect(countLabel).toHaveText(before);
    await expect(row).toHaveText(rowBefore!);
    expect(errors).toEqual([]);
  });

  test("No pick is left off the Bay Area list and a Bay Area fallback", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await expect(page.getByRole("region", { name: "Proposition D" }).getByRole("group", { name: "Guides with no pick" })).toBeVisible();
    await page.goto(`${BALLOT}?c=prop-d`);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await expect(pane.getByRole("group", { name: "Guides for Yes" })).toBeVisible();
    await expect(pane.getByRole("group", { name: "Guides with no pick" })).toHaveCount(0);
    test.skip(!FALLBACK, "no area falls back on Bay Area guides in today's data");
    await page.goto(`${BALLOT}/${FALLBACK!.area}?c=${FALLBACK!.id}`);
    await expect(page.locator("section[aria-labelledby='detail-title']")).toBeVisible();
    await expect(page.getByRole("group", { name: "Guides with no pick" })).toHaveCount(0);
  });

  test("the phone sheet pins guides and counts one side", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(SF);
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const filters = page.getByRole("button", { name: /^Filters/ });
    const before = (await filters.textContent())!;
    await contestRow(page, "Proposition D").tap();
    const sheet = page.getByRole("dialog", { name: "Proposition D" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Pin SPUR", exact: true }).click();
    await expect(sheet.getByRole("status")).toHaveText("Pinned SPUR · 1 of 4 pinned");
    await expect(sheet.getByRole("status")).toBeVisible();
    const button = sheet.getByRole("button", { name: /^Count only these \d+ on the ballot$/ }).first();
    const n = (await button.textContent())!.match(/\d+/)![0];
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(rowPins(page).getByRole("listitem")).toHaveText([/^SPUR:\s*Yes$/]);
    await expect(filters).toContainText(`${n} of `);
    await filters.click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Reset filters" }).click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Close" }).click();
    await expect(filters).toHaveText(before);
    await expect(page).toHaveURL(/[?&]pin=spur/);
  });
});
