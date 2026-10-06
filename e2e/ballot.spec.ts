import { expect, test, type Page } from "@playwright/test";
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

async function pauseClock(page: Page) {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
}

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

  test("after clicking pane text, arrows are left to the browser", async ({ page, browserName }) => {
    await openBallot(page, "?c=us-rep-11");
    const pane = page.locator("[data-keys=pane]");
    await pane.locator("p").filter({ visible: true }).first().click();
    await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
    const prevented = await page.evaluate(() => !window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true })));
    expect(prevented).toBe(false);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    // WebKit doesn't scroll an inner scroller from the keyboard after a click on text.
    if (browserName === "chromium") await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
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

  test("holding ArrowDown through the whole list writes the URL once, on release", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __calls: number };
      w.__calls = 0;
      const native = History.prototype.replaceState;
      History.prototype.replaceState = function (...args: Parameters<History["replaceState"]>) {
        w.__calls += 1;
        return native.apply(this, args);
      };
    });
    await page.clock.install();
    await openBallot(page);
    await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
    await pauseClock(page);
    const ids = await page.locator("[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
    const before = await page.evaluate(() => (window as unknown as { __calls: number }).__calls);
    for (let i = 0; i < ids.length; i++) await page.keyboard.down("ArrowDown");
    await page.keyboard.up("ArrowDown");
    await expect(page.locator(`#row-d-${ids.at(-1)}`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${ids.at(-1)}`));
    const calls = await page.evaluate(() => (window as unknown as { __calls: number }).__calls);
    expect(calls - before).toBe(2);
  });

  test("the shortcuts hint is on the contest list once, after hydration", async ({ page }) => {
    await openBallot(page);
    await expect(page.locator("[aria-keyshortcuts]")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", "ArrowDown ArrowUp j k / Shift+?");
  });


  test("a step is written on keyup, so a reload right after keeps it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.press("ArrowDown");
    await page.reload();
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
  });

  test("leaving the page mid-hold writes the step, so Back restores it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.down("ArrowDown");
    await expect(page.locator("#row-d-us-rep-15")).toHaveAttribute("aria-current", "true");
    await page.goto("/about");
    await page.keyboard.up("ArrowDown");
    await page.goBack();
    await expect(page).toHaveURL(/[?&]c=us-rep-15/);
  });

  test("following a pane link mid-hold lands on the guide, and Back returns to the stepped contest", async ({ page }) => {
    await page.route(/\/guides\//, async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await openBallot(page, "?c=us-rep-11");
    await page.keyboard.down("ArrowDown");
    await expect(page.locator("#row-d-us-rep-15")).toHaveAttribute("aria-current", "true");
    const link = page.locator("[data-keys=pane] a[href^='/guides/']").first();
    const href = (await link.getAttribute("href"))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 10_000 });
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/2026-11\?c=us-rep-15$/);
  });

  test("arrows every 260ms and a filter every 520ms for 15 seconds stay under the browser's history limit", async ({ page }) => {
    test.setTimeout(90_000);
    // Underneath Next's own wrapper, like the browser: more than 100 calls in 10 seconds throws.
    await page.addInitScript(() => {
      const calls: number[] = [];
      const native = History.prototype.replaceState;
      History.prototype.replaceState = function (...args: Parameters<History["replaceState"]>) {
        const now = performance.now();
        while (calls.length && now - calls[0] > 10_000) calls.shift();
        calls.push(now);
        if (calls.length > 100) throw new DOMException("Attempt to use history.replaceState() more than 100 times per 10 seconds", "SecurityError");
        return native.apply(this, args);
      };
    });
    const errors = watchErrors(page);
    await openBallot(page, "?c=us-rep-11");
    await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
    await page.locator("#row-d-us-rep-11").focus();
    const box = page.getByRole("complementary", { name: "Filters" }).getByRole("checkbox", { name: "Only guides that explain their endorsements" });
    const started = Date.now();
    for (let i = 0; Date.now() - started < 15_000; i++) {
      const at = Date.now();
      await page.keyboard.press(i % 2 ? "ArrowUp" : "ArrowDown");
      if (i % 2) await box.evaluate((el: HTMLElement) => el.click(), undefined, { timeout: 2_000 });
      await page.waitForTimeout(Math.max(0, 260 - (Date.now() - at)));
    }
    expect(errors).toEqual([]);
    const selected = (await page.locator("[id^=row-d-][aria-current=true]").getAttribute("id"))!.replace("row-d-", "");
    const checked = (await box.getAttribute("aria-checked")) === "true";
    await expect(page).toHaveURL(new RegExp(`[?&]c=${selected}(&|$)`), { timeout: 15_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get("why") === "1", { timeout: 15_000 }).toBe(checked);
    expect(errors).toEqual([]);
  });

  test("tapping arrows every 150ms for 15 seconds stays within the history rate limit", async ({ page, browserName }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __replaces: number };
      w.__replaces = 0;
      const orig = history.replaceState.bind(history);
      history.replaceState = (...args: Parameters<History["replaceState"]>) => {
        w.__replaces += 1;
        return orig(...args);
      };
    });
    const errors = watchErrors(page);
    await openBallot(page, "?c=us-rep-11");
    await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
    const before = await page.evaluate(() => (window as unknown as { __replaces: number }).__replaces);
    const started = Date.now();
    for (let i = 0; i < 100; i++) {
      await page.keyboard.press(i % 2 ? "ArrowUp" : "ArrowDown");
      await page.waitForTimeout(150);
    }
    const ms = Date.now() - started;
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
    await expect(page.locator("#row-d-us-rep-11")).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    const writes = (await page.evaluate(() => (window as unknown as { __replaces: number }).__replaces)) - before;
    if (browserName === "chromium") expect(writes).toBeLessThanOrEqual(2 * Math.ceil(ms / 250) + 2);
  });


  test("Enter on the open contest moves into its details; a click still closes it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await page.locator("#row-d-us-rep-11").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#detail-title")).toBeFocused();
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await page.locator("#row-d-us-rep-11").click();
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test("the Keyboard shortcuts button is there with single keys on", async ({ page }) => {
    await openBallot(page);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
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

test("resizing to a phone drops a stepped contest that was never written", async ({ page, isMobile }) => {
  test.skip(isMobile, "starts on desktop");
  await page.clock.install();
  await openBallot(page, "?c=us-rep-11");
  await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
  await pauseClock(page);
  await page.keyboard.down("ArrowDown");
  await expect(page.locator("#row-d-us-rep-15")).toHaveAttribute("aria-current", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "Contests" })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator("#row-d-us-rep-11")).toHaveAttribute("aria-current", "true");
  await expect(page).toHaveURL(/[?&]c=us-rep-11/);
});

test("a phone tap drops a stepped contest that was never written", async ({ page, isMobile }) => {
  test.skip(isMobile, "starts on desktop");
  await page.clock.install();
  await openBallot(page, "?c=us-rep-11");
  await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
  await pauseClock(page);
  await page.keyboard.down("ArrowDown");
  await expect(page.locator("#row-d-us-rep-15")).toHaveAttribute("aria-current", "true");
  // Phone width for the click handler's one check only, so the resize reset can't be what clears it.
  await page.evaluate(() => {
    let phone = false;
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (!phone || q !== "(min-width: 1024px)") return real(q);
      phone = false;
      return { ...real(q), matches: false } as MediaQueryList;
    };
    document.getElementById("row-d-governor")!.addEventListener("click", () => (phone = true));
  });
  await page.locator("#row-d-governor").click();
  await expect(page).toHaveURL(/[?&]c=governor/);
  await expect(page.locator("#row-d-governor")).toHaveAttribute("aria-current", "true");
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

test.describe("phone history budget", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  // Underneath Next's wrapper, like the browser: more than 100 push/replace calls in 10 seconds throws.
  const limitHistory = (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as { __calls: number[] };
      w.__calls = [];
      for (const name of ["pushState", "replaceState"] as const) {
        const native = History.prototype[name];
        History.prototype[name] = function (...args: Parameters<History["replaceState"]>) {
          const now = performance.now();
          w.__calls.push(now);
          if (w.__calls.filter((t) => now - t < 10_000).length > 100) throw new DOMException(`Attempt to use history.${name}() more than 100 times per 10 seconds`, "SecurityError");
          return native.apply(this, args);
        };
      }
    });
  const busiestWindow = (page: Page) =>
    page.evaluate(() => {
      const calls = (window as unknown as { __calls: number[] }).__calls;
      return Math.max(0, ...calls.map((t) => calls.filter((u) => u >= t && u - t < 10_000).length));
    });

  test("opening and closing a contest sheet several times a second stays under the history limit", async ({ page, browserName }) => {
    test.setTimeout(60_000);
    await limitHistory(page);
    const errors = watchErrors(page);
    await openBallot(page);
    const sheet = page.getByRole("dialog", { name: "Governor" });
    const started = Date.now();
    let cycles = 0;
    while (Date.now() - started < 12_000) {
      await contestRow(page, "Governor").tap({ timeout: 2_000 });
      await expect(sheet).toBeVisible({ timeout: 2_000 });
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden({ timeout: 2_000 });
      cycles += 1;
    }
    expect(cycles / 12).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
    if (browserName === "chromium") expect(await busiestWindow(page)).toBeLessThanOrEqual(90);
  });

  test("a sheet opened while a write is pending keeps that write when it closes", async ({ page }) => {
    test.setTimeout(60_000);
    await openBallot(page);
    await page.getByRole("button", { name: /Filters/ }).click();
    const filters = page.getByRole("dialog");
    const why = filters.getByRole("checkbox", { name: "Only guides that explain their endorsements" });
    for (let i = 0; i < 51; i++) await why.evaluate((el: HTMLElement) => el.click());
    await expect(why).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
    await contestRow(page, "Governor").tap();
    const sheet = page.getByRole("dialog", { name: "Governor" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(11_000);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("why"), { timeout: 12_000 }).toBe("1");
    await expect(page).toHaveURL(/[?&]c=governor/);
  });
});

