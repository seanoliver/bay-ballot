import fs from "node:fs";
import path from "node:path";
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
  const counts: number[] = [];
  const areas = fs.readdirSync(path.join(__dirname, "..", "data", "areas")).map((f) => f.replace(/\.yml$/, ""));
  for (const area of areas) counts.push(await guideCount(page, `${BALLOT}/${area}`));
  for (const n of counts) expect(n).toBeLessThan(all);
  expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(all);
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

test("Marin has its own page and a box in the Counties filter", async ({ page }, info) => {
  await page.goto(`${BALLOT}/marin`);
  await expect(page.getByRole("heading", { level: 1, name: "Marin County ballot" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Marin County", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  await openBallot(page);
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const panel = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await expect(panel.getByRole("group", { name: "Counties" }).getByRole("checkbox", { name: "Marin", exact: true })).toBeVisible();
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

test("toggling another county while one is revealed keeps the revealed one in the saved setting", async ({ page }, info) => {
  await page.goto("/about");
  await page.evaluate(() => {
    localStorage.setItem("bb-counties", "san-mateo");
    localStorage.setItem("bb-area", "bay-area");
  });
  await page.goto(`${BALLOT}?c=menlo-park-measure-p`);
  await expect(contestRow(page, "Menlo Park Measure P")).toBeVisible();
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const panel = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await panel.getByRole("group", { name: "Counties" }).getByRole("checkbox", { name: "San Francisco", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("bb-counties"))).toBe("san-francisco,san-mateo");
  await expect.poll(() => new URL(page.url()).searchParams.get("offc")).toBe("san-francisco,san-mateo");
});

test("closing a contest from a hidden county keeps focus on the page and says the county is hidden again", async ({ page }, info) => {
  await page.goto("/about");
  await page.evaluate(() => {
    localStorage.setItem("bb-counties", "san-mateo");
    localStorage.setItem("bb-area", "bay-area");
  });
  await page.goto(`${BALLOT}?c=menlo-park-measure-p`);
  await expect(contestRow(page, "Menlo Park Measure P")).toBeVisible();
  if (isPhone(info)) {
    await contestRow(page, "Menlo Park Measure P").tap();
    const sheet = page.getByRole("dialog", { name: "Menlo Park Measure P" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
    return;
  }
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(contestRow(page, "Menlo Park Measure P")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await expect(page.locator("[aria-live=polite]").filter({ hasText: "San Mateo contests hidden again" })).toHaveCount(1);
});

test("Palo Alto and Mountain View pages share Santa Clara County contests and keep their own", async ({ page }) => {
  for (const [slug, name, other] of [["palo-alto", "Palo Alto", "Mountain View"], ["mountain-view", "Mountain View", "Palo Alto"]] as const) {
    await page.goto(`${BALLOT}/${slug}`);
    await expect(page).toHaveTitle(`${name} endorsements (Nov 2026)`);
    await expect(page.getByRole("region", { name: "Santa Clara County", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: other, exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  }
});

test("the Counties filter lists all five counties", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop sidebar");
  await openBallot(page);
  const group = page.getByRole("complementary", { name: "Filters" }).getByRole("group", { name: "Counties" });
  for (const c of ["San Francisco", "San Mateo", "Santa Clara", "Contra Costa", "Marin"]) await expect(group.getByRole("checkbox", { name: c, exact: true })).toBeChecked();
});

test("a contest shared by Palo Alto and Mountain View names Santa Clara County and links back to the Santa Clara County list", async ({ page }) => {
  await page.goto(`${BALLOT}/valley-water-7`);
  await expect(page).toHaveTitle(/^Santa Clara Valley Water District 7 endorsements /);
  await expect(page.getByText(/Santa Clara County voter guides? endorses? Pete Dailey/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Santa Clara County ballot" })).toHaveAttribute("href", `${BALLOT}/santa-clara-county`);
});

test("the Contra Costa page shows state and Contra Costa contests, and the Counties filter lists it", async ({ page }, info) => {
  await page.goto(`${BALLOT}/contra-costa`);
  await expect(page).toHaveTitle("Contra Costa County endorsements (Nov 2026)");
  await expect(page.getByRole("heading", { level: 1, name: "Contra Costa County ballot" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Contra Costa County", exact: true })).toBeVisible();
  await expect(contestRow(page, "Richmond Mayor")).toBeVisible();
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
  await expect(contestRow(page, "Proposition B")).toHaveCount(0);
  if (isPhone(info)) return;
  await openBallot(page);
  const group = page.getByRole("complementary", { name: "Filters" }).getByRole("group", { name: "Counties" });
  await expect(group.getByRole("checkbox", { name: "Contra Costa", exact: true })).toBeChecked();
});

test("the San Jose page shows San Jose contests and no other city's", async ({ page }) => {
  await page.goto(`${BALLOT}/san-jose`);
  await expect(page).toHaveTitle("San Jose endorsements (Nov 2026)");
  await expect(page.getByRole("region", { name: "San Jose", exact: true })).toBeVisible();
  await expect(contestRow(page, "San Jose City Council, District 5")).toBeVisible();
  for (const other of ["Palo Alto", "Mountain View", "Cupertino"]) await expect(page.getByRole("region", { name: other, exact: true })).toHaveCount(0);
  await expect(contestRow(page, "Mountain View Whisman School District Board")).toHaveCount(0);
});

test("the Santa Clara County page includes Palo Alto, Mountain View and San Jose", async ({ page }) => {
  await page.goto(`${BALLOT}/santa-clara-county`);
  await expect(page).toHaveTitle("Santa Clara County endorsements (Nov 2026)");
  for (const place of ["Santa Clara County", "Cupertino", "Palo Alto", "Mountain View", "San Jose"]) {
    await expect(page.getByRole("region", { name: place, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "San Mateo County", exact: true })).toHaveCount(0);
});

test("a Palo Alto contest page names Palo Alto and links back to the Palo Alto list", async ({ page }) => {
  await page.goto(`${BALLOT}/palo-alto-council`);
  await expect(page).toHaveTitle(/^Palo Alto Palo Alto City Council endorsements \(Nov 2026\)/);
  await expect(page.getByRole("link", { name: "Palo Alto ballot" })).toHaveAttribute("href", `${BALLOT}/palo-alto`);
  await expect(page.getByText(/^Most-endorsed for Palo Alto City Council by \d+ Palo Alto voter guides:/)).toBeVisible();
});

test("a San Jose contest page names San Jose and links back to the San Jose list", async ({ page }) => {
  await page.goto(`${BALLOT}/san-jose-council-5`);
  await expect(page).toHaveTitle(/^San Jose City Council District 5 endorsements \(Nov 2026\)/);
  await expect(page.getByRole("link", { name: "San Jose ballot" })).toHaveAttribute("href", `${BALLOT}/san-jose`);
});

test("a district in several Santa Clara cities links back to the Santa Clara County list", async ({ page }) => {
  await page.goto(`${BALLOT}/pausd-trustee`);
  await expect(page.getByRole("link", { name: "Santa Clara County ballot" })).toHaveAttribute("href", `${BALLOT}/santa-clara-county`);
  await expect(page.getByText(/by \d+ Santa Clara County voter guides?:/)).toBeVisible();
});
