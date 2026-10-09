import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { hiddenLabel } from "../src/lib/filters";
import { BALLOT, contestRow, guidesOn, isPhone, openBallot, watchErrors } from "./helpers";

const PROP_B = `${BALLOT}/prop-b`;
const ANSWER = /(voter guides? recommends?|voter guides split) .* on Prop B, as of /;
const SHOW_ALL = "Show all guides on this contest";

async function filterPanel(page: Page, info: TestInfo) {
  if (!isPhone(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

async function openContest(page: Page, query = "") {
  await page.goto(`${PROP_B}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Proposition B" })).toBeVisible();
}

test.describe("contest page filters", () => {
  test("the Filters menu lists only the guides that took a position on the contest", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openContest(page);
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("checkbox", { name: "Only guides that explain their endorsements" })).toBeVisible();
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await expect(panel.getByRole("checkbox", { name: /SF Republican Party/ })).toBeVisible();
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("abundant");
    await expect(panel.getByText(/No guides match/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("hiding a guide changes the counts and the answer, not the title or description, and says so", async ({ page }, info) => {
    await openContest(page);
    const answer = page.getByText(ANSWER);
    const no = page.getByRole("heading", { level: 3, name: /^No/ });
    const before = (await answer.textContent())!;
    const [, k, n] = before.match(/^(\d+) of (\d+) /)!;
    const noBefore = Number((await no.textContent())!.match(/(\d+) guides?/)![1]);
    const title = await page.title();
    const description = page.locator('meta[name="description"]');
    const descBefore = (await description.getAttribute("content"))!;
    expect(descBefore).toContain(`of ${n} `);
    const panel = await filterPanel(page, info);
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await panel.getByRole("checkbox", { name: /SF Republican Party/ }).click();
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    if (isPhone(info)) await panel.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    await expect(answer).toHaveText(before.replace(`${k} of ${n} `, `${k} of ${Number(n) - 1} `));
    await expect(no).toHaveText(new RegExp(`^No\\s*${noBefore - 1} guides?$`));
    expect(await page.title()).toBe(title);
    await expect(description).toHaveAttribute("content", descBefore);
    await expect(page.getByRole("link", { name: "SF Republican Party", exact: true })).toHaveCount(0);
  });

  test("a type that's all on for this contest shows on, and unchecking it turns the whole type off", async ({ page }, info) => {
    await openContest(page, "?off=smc-labor-council");
    const panel = await filterPanel(page, info);
    const unions = panel.getByRole("checkbox", { name: /^Unions/ });
    await expect(unions).toHaveAttribute("aria-checked", "true");
    await unions.click();
    await expect(page).toHaveURL(/[?&]off=[^&]*seiu-1021[^&]*smc-labor-council/);
  });

  test("with every guide hidden, the page says so and drops the answer sentence", async ({ page }, info) => {
    await openContest(page);
    const panel = await filterPanel(page, info);
    const types = panel.getByRole("group", { name: "Guides" }).getByRole("checkbox").filter({ visible: true });
    for (const box of await types.all()) await box.click();
    if (isPhone(info)) await panel.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText(/^\d+ guides hidden$/)).toBeVisible();
    await expect(page.getByText("No guide you're counting took a position.")).toBeVisible();
    await expect(page.getByText(ANSWER)).toHaveCount(0);
  });

  test("a type turned off on a contest page is off everywhere, not mixed on the list", async ({ page }, info) => {
    await openContest(page);
    const panel = await filterPanel(page, info);
    await panel.getByRole("checkbox", { name: /^Unions/ }).click();
    await expect(page).toHaveURL(/[?&]off=[^&]*smc-labor-council/);
    await page.evaluate(() => localStorage.setItem("bb-area", "bay-area"));
    await openBallot(page);
    const list = await filterPanel(page, info);
    await expect(list.getByRole("checkbox", { name: /^Unions/ })).toHaveAttribute("aria-checked", "false");
  });

  test("Show all turns the hidden guides back on and leaves other filters alone", async ({ page }) => {
    const propB = guidesOn("prop-b");
    expect(propB, "abundant-sf must have no Prop B pick").not.toContain("abundant-sf");
    expect(propB.length, "Prop B needs at least 3 guides").toBeGreaterThanOrEqual(3);
    await openContest(page, `?off=${propB[0]},${propB[1]},abundant-sf`);
    const note = page.getByText(hiddenLabel(2));
    await expect(note).toBeVisible();
    await expect(page.locator("[aria-live=polite]").filter({ has: note })).toHaveCount(1);
    await page.getByRole("button", { name: SHOW_ALL }).click();
    await expect(page.getByText(/guides? hidden/)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Proposition B" })).toBeFocused();
    await expect(page).toHaveURL(/[?&]off=abundant-sf(&|$)/);
    await expect(page.getByText(/(\d+) of \1 guides counted/).filter({ visible: true })).toBeVisible();
  });

  test("Show all turns off the reasons-only filter when it hid guides here", async ({ page }) => {
    await openContest(page, "?why=1&off=abundant-sf");
    await expect(page.getByText(/^\d+ guides hidden$/)).toBeVisible();
    await page.getByRole("button", { name: SHOW_ALL }).click();
    await expect(page.getByText(/guides? hidden/)).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(/[?&]off=abundant-sf/);
  });

  test("a filter change on a contest page keeps the hidden counties in the URL", async ({ page }, info) => {
    await openContest(page, "?offc=san-mateo");
    const panel = await filterPanel(page, info);
    await panel.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
    await expect(page).toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(/[?&]offc=san-mateo/);
  });

  test("a filter change on an area list keeps guides hidden outside that area", async ({ page }, info) => {
    await page.goto(`${BALLOT}/sf?off=courage-california`);
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const panel = await filterPanel(page, info);
    await panel.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
    await expect(page).toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(/[?&]off=courage-california/);
  });

  test("a type checked on an area list turns on that type's guides outside the area too", async ({ page }, info) => {
    await page.goto(`${BALLOT}/sf?off=seiu-1021,sf-building-trades,sf-labor-council,smc-labor-council,south-bay-labor,uesf`);
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const panel = await filterPanel(page, info);
    const unions = panel.getByRole("checkbox", { name: /^Unions/ });
    await expect(unions).toHaveAttribute("aria-checked", "false");
    await unions.click();
    await expect(unions).toHaveAttribute("aria-checked", "true");
    await expect(page).not.toHaveURL(/smc-labor-council|south-bay-labor/);
  });

  test("a contest no guide took a position on has no Filters", async ({ page }) => {
    await page.goto(`${BALLOT}/court-of-appeal-6`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Filters" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Filters/ })).toHaveCount(0);
    await expect(page.getByText(/No guides match|0 of 0/)).toHaveCount(0);
  });

  test("a filter set on the list applies on a contest page opened later, and comes back", async ({ page }, info) => {
    await openBallot(page);
    const panel = await filterPanel(page, info);
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await panel.getByRole("checkbox", { name: /SF Republican Party/ }).click();
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    await openContest(page);
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    await page.getByRole("button", { name: SHOW_ALL }).click();
    await page.getByRole("link", { name: "San Francisco ballot" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    const back = await filterPanel(page, info);
    await back.getByRole("searchbox", { name: "Search guides" }).fill("republican");
    await expect(back.getByRole("checkbox", { name: /SF Republican Party/ })).toBeChecked();
  });

  test("links between the list and a contest page keep the filter params", async ({ page }) => {
    await openBallot(page, "?off=sf-gop&why=1&c=prop-b");
    await expect(contestRow(page, "Proposition B")).toHaveAttribute("href", "/2026-11/prop-b?off=sf-gop&why=1");
    await page.goto(`${PROP_B}?off=sf-gop&why=1`);
    await expect(page.getByRole("link", { name: "San Francisco ballot" })).toHaveAttribute("href", "/2026-11/sf?off=sf-gop&why=1");
  });

  test("a stored filter renders without hydration errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => window.localStorage.setItem("bb-filters", "off=sf-gop"));
    await openContest(page);
    await expect(page.getByText("1 guide hidden")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("a filter set on a statewide contest page doesn't send the home page to an area", async ({ page }, info) => {
  await page.goto(`${BALLOT}/governor`);
  await expect(page.getByRole("link", { name: "Bay Area ballot" })).toBeVisible();
  const panel = await filterPanel(page, info);
  await panel.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
  await expect(page).toHaveURL(/[?&]why=1/);
  if (isPhone(info)) await panel.getByRole("button", { name: "Close" }).click();
  await page.getByRole("banner").getByRole("link", { name: "Bay Ballot" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
});

test.describe("a shared link's filters beat saved ones", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("bb-filters", "why=1"));
  });

  test("closing the phone Filters sheet keeps the link's filters", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await openContest(page, "?off=sf-gop");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    await expect(page).not.toHaveURL(/[?&]why=1/);
  });

  test("Back from a contest page keeps the link's filters", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop only");
    await openBallot(page, "?off=sf-gop");
    await contestRow(page, "Proposition B").click();
    await page.getByRole("link", { name: "Open contest page" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Proposition B" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/[?&]off=sf-gop/);
    await expect(page).not.toHaveURL(/[?&]why=1/);
  });
});

test.describe("desktop contest page layout", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("the contest column sits where the list column does, beside the filter column", async ({ page }) => {
    await openBallot(page);
    const listX = (await page.locator("[data-keys=list]").boundingBox())!.x;
    await openContest(page);
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
    const box = (await page.locator("[data-page-column]").boundingBox())!;
    expect(Math.round(box.x)).toBe(Math.round(listX));
    expect(Math.round(box.width)).toBe(768);
  });

  test("at 1024px the contest column is as wide as the list column", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openBallot(page);
    const list = (await page.locator("[data-keys=list]").boundingBox())!;
    await openContest(page);
    const column = (await page.locator("[data-page-column]").boundingBox())!;
    expect(Math.round(column.x)).toBe(Math.round(list.x));
    expect(Math.round(column.width)).toBe(Math.round(list.width));
  });

  test("a contest with no positions keeps the column where the list column is", async ({ page }) => {
    await page.goto(`${BALLOT}/court-of-appeal-6`);
    const box = (await page.locator("[data-page-column]").boundingBox())!;
    expect(Math.round(box.x)).toBe(312);
    expect(Math.round(box.width)).toBe(768);
  });

  test("without JavaScript the list and contest columns keep their place and width", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    for (const [url, column] of [[BALLOT, "[data-keys=list]"], [PROP_B, "[data-page-column]"]]) {
      await page.goto(url);
      const box = (await page.locator(column).boundingBox())!;
      expect(Math.round(box.x), url).toBe(312);
      expect(Math.round(box.width), url).toBe(768);
    }
    await context.close();
  });

  test("/ focuses the guide search", async ({ page }) => {
    await openContest(page);
    await page.keyboard.press("/");
    await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("searchbox", { name: "Search guides" })).toBeFocused();
  });
});

test.describe("phone contest page layout", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("the Filters button sits above the contest card and names the count", async ({ page }) => {
    await openContest(page, `?off=${guidesOn("prop-b")[0]}`);
    const button = page.getByRole("button", { name: /^Filters/ });
    const gap = async () => {
      const m = (await button.textContent())?.match(/(\d+) of (\d+) guides counted/);
      return m ? Number(m[2]) - Number(m[1]) : null;
    };
    await expect.poll(gap).toBe(1);
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeHidden();
  });

  test("the column spans the screen less the gutters", async ({ page }) => {
    await openContest(page);
    const box = (await page.locator("[data-page-column]").boundingBox())!;
    expect(box.x).toBe(16);
    expect(Math.round(box.width)).toBe(page.viewportSize()!.width - 32);
  });

  test("the Filters sheet opens on a contest page, and its changes stay after it closes", async ({ page }) => {
    await openContest(page);
    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await sheet.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/[?&]why=1/);
    await expect(page.getByText(/^\d+ guides hidden$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters/ })).toContainText(/\d+ of \d+ guides counted/);
  });
});
