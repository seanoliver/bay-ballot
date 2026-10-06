import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot } from "./helpers";

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

test("the area picker doesn't prefetch other list pages", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith(`${BALLOT}/sf`)) fetched.push(r.url());
  });
  await openBallot(page);
  await page.waitForLoadState("networkidle");
  await page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "San Francisco" }).hover();
  await page.waitForLoadState("networkidle");
  expect(fetched).toEqual([]);
});

test("arrow keys walk the SF page in its grouped order", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  await page.goto(`${BALLOT}/sf`);
  await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", /ArrowDown/);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf\\?c=us-rep-15$`));
  await expect(page.locator("#row-d-us-rep-15")).toBeFocused();
});

const guideCount = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path);
  const line = await page.getByText(/November 3, 2026 · \d+ guides? ·/).textContent();
  return Number(line!.match(/· (\d+) guides? ·/)![1]);
};

test("each area page counts only its own guides", async ({ page }) => {
  const all = await guideCount(page, BALLOT);
  const sf = await guideCount(page, `${BALLOT}/sf`);
  const sm = await guideCount(page, `${BALLOT}/san-mateo`);
  expect(sf).toBeLessThan(all);
  expect(sm).toBeLessThan(all);
  expect(sf + sm).toBeGreaterThanOrEqual(all);
});

test("the San Mateo page shows state and San Mateo contests only", async ({ page }) => {
  await page.goto(`${BALLOT}/san-mateo`);
  await expect(page).toHaveTitle("San Mateo County endorsements (Nov 2026)");
  await expect(page.getByRole("heading", { level: 1, name: "San Mateo County ballot" })).toBeVisible();
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toHaveCount(0);
  await expect(contestRow(page, "Proposition B")).toHaveCount(0);
});

test("the Bay Area list shows both counties, with the regional measure in its own group", async ({ page }) => {
  await openBallot(page);
  await expect(page.getByRole("region", { name: "Bay Area", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Francisco", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
});

test("the Counties filter hides a county's contests, keeps statewide ones, and persists", async ({ page }, info) => {
  await openBallot(page);
  const open = async () => {
    if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
    return isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  };
  let panel = await open();
  await panel.getByRole("group", { name: "Counties" }).getByRole("checkbox", { name: "San Mateo", exact: true }).click();
  await expect(page).toHaveURL(/[?&]offc=san-mateo/);
  if (isPhone(info)) await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "California", exact: true })).toBeVisible();
  await page.goto(BALLOT);
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  panel = await open();
  await panel.getByRole("button", { name: "All counties" }).click();
  if (isPhone(info)) await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
});

test("area pages have no Counties filter", async ({ page }, info) => {
  test.skip(isPhone(info), "the sidebar is the same component on phone");
  await page.goto(`${BALLOT}/san-mateo`);
  await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("group", { name: "Counties" })).toHaveCount(0);
});

test("a San Mateo measure page names its place and links back to the San Mateo list", async ({ page }) => {
  await page.goto(`${BALLOT}/menlo-park-measure-p`);
  await expect(page.getByRole("heading", { level: 1, name: "Menlo Park Measure P" })).toBeVisible();
  await expect(page).toHaveTitle(/^Menlo Park Measure P endorsements \(Nov 2026\)/);
  await expect(page.getByRole("link", { name: "San Mateo County ballot" })).toHaveAttribute("href", `${BALLOT}/san-mateo`);
});

test("a shared link to a contest in a hidden county shows that county again and says so", async ({ page }, info) => {
  await page.goto("/about");
  await page.evaluate(() => {
    localStorage.setItem("bb-counties", "san-mateo");
    localStorage.setItem("bb-area", "bay-area");
  });
  await page.goto(`${BALLOT}?c=menlo-park-measure-p`);
  await expect(contestRow(page, "Menlo Park Measure P")).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toBeVisible();
  await expect(page.locator("[aria-live=polite]").filter({ hasText: "Showing San Mateo contests for this link" })).toHaveCount(1);
  if (!isPhone(info)) await expect(page.getByRole("region", { name: "Menlo Park Measure P" })).toBeVisible();
});

test("the phone Filters button counts hidden counties, and All counties keeps focus once used", async ({ page }, info) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("bb-area", "bay-area"));
  await page.goto(`${BALLOT}?offc=san-mateo`);
  if (isPhone(info)) {
    await expect(page.getByRole("button", { name: /1 county hidden/ })).toBeVisible();
    await page.getByRole("button", { name: /Filters/ }).click();
  }
  const panel = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  const all = panel.getByRole("button", { name: "All counties" });
  await all.click();
  await expect(all).toBeFocused();
  await expect(all).toHaveAttribute("aria-disabled", "true");
  await expect(page).not.toHaveURL(/offc=/);
});

test("hiding the county of the open contest hides it and clears the selection", async ({ page }, info) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("bb-area", "bay-area"));
  await page.goto(`${BALLOT}?c=menlo-park-measure-p`);
  await expect(contestRow(page, "Menlo Park Measure P")).toBeVisible();
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const panel = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await panel.getByRole("group", { name: "Counties" }).getByRole("checkbox", { name: "San Mateo", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]c=/);
  await expect(page).toHaveURL(/[?&]offc=san-mateo/);
  if (isPhone(info)) await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  await expect(contestRow(page, "Menlo Park Measure P")).toHaveCount(0);
});

test("a revealed county is for this view only; the saved preference stays", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => {
    localStorage.setItem("bb-counties", "san-mateo");
    localStorage.setItem("bb-area", "bay-area");
  });
  await page.goto(`${BALLOT}?c=menlo-park-measure-p`);
  await expect(contestRow(page, "Menlo Park Measure P")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bb-counties"))).toBe("san-mateo");
  await page.goto(BALLOT);
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
});
