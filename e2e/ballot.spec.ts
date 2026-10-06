import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot, watchErrors } from "./helpers";

test("ballot page has the header, logo, intro and footer", async ({ page }) => {
  const errors = watchErrors(page);
  await openBallot(page);
  const home = page.getByRole("banner").getByRole("link", { name: "Bay Ballot" });
  await expect(home).toBeVisible();
  await expect(home.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("banner").getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByText(/November 3, 2026 · \d+ guides · \d+ contests · \d+ endorsements/)).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Built and maintained in San Francisco by Sean Oliver")).toBeVisible();
  await expect(footer.getByRole("link", { name: "Sean Oliver" })).toHaveAttribute("href", "https://seanoliver.dev");
  await expect(footer.getByRole("link", { name: "Fully open source on GitHub" })).toHaveAttribute("href", "https://github.com/seanoliver/bay-ballot");
  await expect(footer.getByRole("link", { name: "Open an issue" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Edit on GitHub" })).toHaveCount(0);
  await expect(footer.getByText(/Data as of /)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the reasons filter goes into the URL and survives a reload", async ({ page }, info) => {
  await openBallot(page);
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  const dialogOrPage = isPhone(info) ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Filters" });
  await dialogOrPage.getByRole("checkbox", { name: "Only guides that explain their endorsements" }).click();
  await expect(page).toHaveURL(/[?&]why=1/);
  await page.reload();
  await expect(page).toHaveURL(/[?&]why=1/);
  if (isPhone(info)) await page.getByRole("button", { name: /Filters/ }).click();
  await expect(dialogOrPage.getByRole("checkbox", { name: "Only guides that explain their endorsements" })).toBeChecked();
});

test.describe("desktop detail pane", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("selecting a contest opens the pane with its result, chips and links", async ({ page }) => {
    await openBallot(page);
    await contestRow(page, "Proposition B").click();
    await expect(page).toHaveURL(/[?&]c=prop-b/);
    const pane = page.getByRole("region", { name: "Proposition B" });
    await expect(pane).toBeVisible();
    await expect(pane.getByText(/^(Yes|No) \d+%$|^Split$/).first()).toBeVisible();
    const chips = pane.getByRole("group", { name: /^Guides for / }).first().getByRole("link");
    expect(await chips.count()).toBeGreaterThan(0);
    const more = pane.getByRole("button", { name: /^\+\d+ more$/ }).first();
    const before = await chips.count();
    await more.click();
    await expect(pane.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(await chips.count()).toBeGreaterThan(before);
    const href = await chips.first().getAttribute("href");
    expect(href).toMatch(/^\/guides\/[a-z0-9-]+$/);
    await chips.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  // The pane's card stays stuck at the top until its own bottom meets the end of the list, then
  // leaves with the footer. A short card must not scroll away while there is room below it.
  for (const [name, query, expand] of [
    ["short", "?c=governor", false],
    ["long", "?c=prop-b", true],
  ] as const) {
    test(`a ${name} pane stays put until it meets the footer`, async ({ page }) => {
      await openBallot(page, query);
      const pane = page.locator("section[aria-labelledby='detail-title']");
      await expect(pane).toBeVisible();
      if (expand) {
        // Each button relabels itself once open, so keep opening the first one left.
        const more = pane.getByRole("button", { name: /^All reasons/ });
        while ((await more.count()) > 0) await more.first().click();
      }
      const footer = page.getByRole("contentinfo");
      // The card as seen: a long card scrolls inside the sticky box, so clip it to that box.
      const box = pane.locator("xpath=..");
      const rects = async () => {
        const [c, b, f] = await Promise.all([pane.boundingBox(), box.boundingBox(), footer.boundingBox()]);
        return { top: Math.max(c!.y, b!.y), bottom: Math.min(c!.y + c!.height, b!.y + b!.height), footerTop: f!.y };
      };
      const viewport = page.viewportSize()!.height;
      const bottom = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

      // Stuck position, well above the footer.
      await page.evaluate((to) => window.scrollTo(0, to), bottom - 1200);
      const stuckTop = (await rects()).top;
      // Step down to the page bottom: while the box's bottom has room above the footer, it stays stuck.
      for (let y = bottom - 600; y <= bottom; y += 100) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        const r = await rects();
        if (r.footerTop - r.bottom > 60 && r.bottom - r.top < viewport) expect(r.top).toBeCloseTo(stuckTop, 0);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      // At the bottom the box either never reached the footer (still stuck) or sits a gutter above it.
      const end = await rects();
      expect(end.footerTop - end.bottom).toBeGreaterThanOrEqual(0);
      if (Math.abs(end.top - stuckTop) > 1) expect(end.footerTop - end.bottom).toBeLessThan(120);
    });
  }

  test("the close button closes the pane and drops the selection", async ({ page }) => {
    await openBallot(page, "?c=prop-b");
    const pane = page.getByRole("region", { name: "Proposition B" });
    await expect(pane).toBeVisible();
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(pane).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]c=/);
  });
});

test.describe("phone sheet", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("filters changed in the sheet stay in the URL after it closes", async ({ page }) => {
    await page.goto(`${BALLOT}?off=sf-gop`);
    const filters = page.getByRole("button", { name: /Filters/ });
    const sheet = page.getByRole("dialog", { name: "Filters" });
    const why = sheet.getByRole("checkbox", { name: "Only guides that explain their endorsements" });

    await filters.click();
    await why.click();
    await expect(page).toHaveURL(/[?&]why=1/);
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(/[?&]off=sf-gop/);

    await filters.click();
    await expect(why).toBeChecked();
    await why.click();
    await expect(page).not.toHaveURL(/[?&]why=1/);
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]why=1/);
    await expect(page).toHaveURL(new RegExp(`${BALLOT}`));

    await page.reload();
    await filters.click();
    await expect(why).not.toBeChecked();
  });

  test("tapping a contest opens its sheet and Back closes it", async ({ page }) => {
    await openBallot(page);
    await contestRow(page, "Proposition B").tap();
    const sheet = page.getByRole("dialog", { name: "Proposition B" });
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}`));
  });
});

test("/about renders", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrections" })).toBeVisible();
});

test("an unknown contest is a 404", async ({ page }) => {
  const res = await page.goto(`${BALLOT}/nope`);
  expect(res?.status()).toBe(404);
});

test("dark mode renders without errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await openBallot(page, "?c=prop-b");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(255, 255, 255)");
  expect(errors).toEqual([]);
});

test("a guide that hasn't published shows no list-only badge or as-of date", async ({ page }) => {
  await page.goto("/guides/sf-examiner");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Hasn't published")).toBeVisible();
  await expect(page.getByText("List only")).toHaveCount(0);
  await expect(page.getByText(/· as of /)).toHaveCount(0);
});

test("a published list-only guide still shows its badge and date", async ({ page }) => {
  await page.goto("/guides/sf-dems");
  await expect(page.getByText("List only")).toBeVisible();
  await expect(page.getByText(/· as of /)).toBeVisible();
});

test("every page names its canonical URL on bayballot.com", async ({ page }) => {
  for (const path of [BALLOT, `${BALLOT}/sf`, `${BALLOT}/prop-b`, "/guides/spur", "/about"]) {
    await page.goto(path);
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bayballot.com${path}`);
  }
});

test("a contest page has a search title and a plain answer sentence", async ({ page }) => {
  await page.goto(`${BALLOT}/prop-b`);
  await expect(page).toHaveTitle(/^SF Prop B endorsements \(Nov 2026\)(: (\d+ of \d+ guides say (Yes|No)|guides split \d+–\d+))?$/);
  await expect(
    page.getByText(/^(\d+ of \d+ San Francisco voter guides recommend (Yes|No)|San Francisco voter guides split \d+–\d+) on Prop B, as of \w+ \d+, \d{4}\.$/),
  ).toBeVisible();
});

test("the changelog is linked from the footer and lists entries by month", async ({ page }) => {
  await page.goto(BALLOT);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "/changelog");
  await page.goto("/changelog");
  await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "October 2026" })).toBeVisible();
  const launch = page.getByRole("link", { name: "Pull request #1 (opens in new tab)" });
  await expect(launch).toBeVisible();
  await expect(launch).toHaveAttribute("href", "https://github.com/seanoliver/bay-ballot/pull/1");
});
