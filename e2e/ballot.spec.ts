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

test.describe("desktop keyboard", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("arrow keys walk the list and keep the URL in step", async ({ page }) => {
    await openBallot(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
    await expect(page.getByRole("region", { name: "United States Representative, District 15" })).toBeVisible();
    await expect(page.locator("#row-d-us-rep-15")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("typing in the guide search doesn't move the selection; / focuses it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.press("/");
    const search = page.getByRole("complementary", { name: "Filters" }).getByRole("searchbox", { name: "Search guides" });
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    await page.keyboard.type("j");
    await expect(search).toHaveValue("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("? opens the shortcuts and Esc closes them", async ({ page }) => {
    await openBallot(page);
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("with the shortcuts open, j and / do nothing", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    const focused = () => page.evaluate(() => document.activeElement?.outerHTML);
    const before = await focused();
    await page.keyboard.press("j");
    await page.keyboard.press("/");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    expect(await focused()).toBe(before);
    await expect(dialog).toBeVisible();
  });

  test("j does nothing while a filter checkbox has focus", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    const box = page.getByRole("complementary", { name: "Filters" }).getByRole("checkbox").first();
    await box.focus();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await expect(box).toBeFocused();
  });

  test("after clicking pane text, arrows scroll the pane", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    const pane = page.locator("[data-keys=pane]");
    await pane.locator("p").filter({ visible: true }).first().click();
    await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test("after clicking filter text, arrows do nothing", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.getByRole("complementary", { name: "Filters" }).getByText("Filters", { exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("Escape closes the details when nothing has focus", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await expect(page.getByRole("region", { name: "United States Representative, District 11" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]c=/);
    await expect(page.getByRole("region", { name: "United States Representative, District 11" })).toBeHidden();
  });

  test("right after Escape closes the shortcuts, j works", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
  });

  test("an open popover blocks shortcuts", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.getByRole("button", { name: "Includes ranked endorsements — show order" }).filter({ visible: true }).first().click();
    await expect(page.locator("[data-slot=popover-content]")).toBeVisible();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("k on the first contest leaves the key to the browser", async ({ page }) => {
    await openBallot(page);
    const first = (await page.locator("[id^=row-d-]").first().getAttribute("id"))!.replace("row-d-", "");
    await openBallot(page, `?c=${first}`);
    const prevented = await page.evaluate(() => !window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", cancelable: true })));
    expect(prevented).toBe(false);
    await expect(page).toHaveURL(new RegExp(`[?&]c=${first}`));
  });

  test("a fast sweep of the whole list writes the URL only a few times", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __replaces: number };
      w.__replaces = 0;
      const orig = history.replaceState.bind(history);
      history.replaceState = (...args: Parameters<History["replaceState"]>) => {
        w.__replaces += 1;
        return orig(...args);
      };
    });
    await openBallot(page);
    const ids = await page.locator("[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
    const before = await page.evaluate(() => (window as unknown as { __replaces: number }).__replaces);
    for (let i = 0; i < ids.length; i++) await page.keyboard.press("ArrowDown");
    await expect(page.locator(`#row-d-${ids.at(-1)}`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${ids.at(-1)}`));
    const writes = await page.evaluate(() => (window as unknown as { __replaces: number }).__replaces);
    expect(writes - before).toBeLessThan(10);
  });

  test("the shortcuts hint is on the contest list once, after hydration", async ({ page }) => {
    await openBallot(page);
    await expect(page.locator("[aria-keyshortcuts]")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", "ArrowDown ArrowUp j k / Shift+?");
  });

  test("single-key shortcuts can be turned off, and stay off", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    const toggle = dialog.getByRole("switch", { name: "Single-key shortcuts (j, k, /, and ?)" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("j");
    await page.keyboard.press("Shift+?");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await expect(dialog).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
    await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", "ArrowDown ArrowUp");
    await page.reload();
    const button = page.getByRole("button", { name: "Keyboard shortcuts" });
    await button.click();
    await expect(dialog).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await expect(dialog.getByText("Search guides (off)")).toBeVisible();
    await expect(dialog.getByText("Show these shortcuts (off)")).toBeVisible();
    await dialog.getByText("Single-key shortcuts (j, k, /, and ?)").click();
    await expect(toggle).toBeChecked();
    await expect(dialog.getByText("Search guides", { exact: true })).toBeVisible();
  });

  test("in the detail pane arrows don't switch contests but j does", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.locator("[data-keys=pane]").locator("a, button").first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
  });
});

test.describe("phone keyboard", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("arrows and j are left to the browser", async ({ page }) => {
    await openBallot(page);
    const prevented = await page.evaluate(() =>
      ["ArrowDown", "j"].map((key) => !window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }))),
    );
    expect(prevented).toEqual([false, false]);
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test("no shortcut hint, contest region or key hints", async ({ page }) => {
    await openBallot(page);
    await expect(page.getByText("↑↓ to browse")).toBeHidden();
    await expect(page.getByRole("region", { name: "Contests" })).toHaveCount(0);
    await expect(page.locator("[aria-keyshortcuts]").filter({ visible: true })).toHaveCount(0);
  });
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
