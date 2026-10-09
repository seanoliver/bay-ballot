import { expect, test, type Page } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot, waitForKeys, watchErrors } from "./helpers";

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

/** The contest after `id` in list order; other counties' House seats sort between District 11 and District 15. */
async function after(page: Page, id: string): Promise<string> {
  const ids = await page.locator("[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
  return ids[ids.indexOf(id) + 1];
}

async function pauseClock(page: Page) {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
}

test.describe("desktop keyboard", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("arrow keys walk the list and keep the URL in step", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    const [first, second] = await page.locator("[id^=row-d-]").evaluateAll((els) => els.slice(0, 2).map((e) => e.id.replace("row-d-", "")));
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(new RegExp(`[?&]c=${second}(&|$)`));
    const title = (await page.locator(`#row-d-${second}`).textContent())!.trim();
    await expect(page.getByRole("region", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(`#row-d-${second}`)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page).toHaveURL(new RegExp(`[?&]c=${first}(&|$)`));
  });

  test("typing in the guide search doesn't move the selection; / focuses it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
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
    await waitForKeys(page);
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("with the shortcuts open, j and / do nothing", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
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
    await waitForKeys(page);
    const box = page.getByRole("complementary", { name: "Filters" }).getByRole("checkbox").first();
    await box.focus();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await expect(box).toBeFocused();
  });

  test("after clicking pane text, arrows are left to the browser", async ({ page, browserName }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
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
    await waitForKeys(page);
    await page.getByRole("complementary", { name: "Filters" }).getByText("Filters", { exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("Escape closes the details when nothing has focus", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    await expect(page.getByRole("region", { name: "United States Representative, District 11" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]c=/);
    await expect(page.getByRole("region", { name: "United States Representative, District 11" })).toBeHidden();
  });

  test("right after Escape closes the shortcuts, j works", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    await expect(page).toHaveURL(new RegExp(`[?&]c=${next}(&|$)`));
  });

  test("an open popover blocks shortcuts", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    await page.getByRole("button", { name: "Includes ranked endorsements — show order" }).filter({ visible: true }).first().click();
    await expect(page.locator("[data-slot=popover-content]")).toBeVisible();
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
  });

  test("k on the first contest leaves the key to the browser", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    const first = (await page.locator("[id^=row-d-]").first().getAttribute("id"))!.replace("row-d-", "");
    await openBallot(page, `?c=${first}`);
    await waitForKeys(page);
    const prevented = await page.evaluate(() => !window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", cancelable: true })));
    expect(prevented).toBe(false);
    await expect(page).toHaveURL(new RegExp(`[?&]c=${first}`));
  });

  test("holding ArrowDown through 60 rows writes the URL once, on release", async ({ page }) => {
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
    await waitForKeys(page);
    await pauseClock(page);
    const ids = await page.locator("[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
    const before = await page.evaluate(() => (window as unknown as { __calls: number }).__calls);
    const last = ids[59];
    for (let i = 0; i < 60; i++) await page.keyboard.down("ArrowDown");
    await page.keyboard.up("ArrowDown");
    await expect(page.locator(`#row-d-${last}`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${last}`));
    const calls = await page.evaluate(() => (window as unknown as { __calls: number }).__calls);
    expect(calls - before).toBe(2);
  });

  test("the shortcuts hint is on the contest list once, after hydration", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await expect(page.locator("[aria-keyshortcuts]")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", "ArrowDown ArrowUp j k g / Shift+?");
  });


  test("a step is written on keyup, so a reload right after keeps it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.keyboard.press("ArrowDown");
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${next}(&|$)`));
  });

  test("leaving the page mid-hold writes the step, so Back restores it", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.keyboard.down("ArrowDown");
    await expect(page.locator(`#row-d-${next}`)).toHaveAttribute("aria-current", "true");
    await page.goto("/about");
    await page.keyboard.up("ArrowDown");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${next}(&|$)`));
  });

  test("following a pane link mid-hold lands on the guide, and Back returns to the stepped contest", async ({ page }) => {
    await page.route(/\/guides\//, async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.keyboard.down("ArrowDown");
    await expect(page.locator(`#row-d-${next}`)).toHaveAttribute("aria-current", "true");
    const link = page.locator("[data-keys=pane] a[href^='/guides/']").first();
    const href = (await link.getAttribute("href"))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 10_000 });
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/2026-11\\?c=${next}$`));
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
    await waitForKeys(page);
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
    await waitForKeys(page);
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
    await waitForKeys(page);
    await page.locator("#row-d-us-rep-11").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#detail-title")).toBeFocused();
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await page.locator("#row-d-us-rep-11").click();
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test("the Keyboard shortcuts button is there with single keys on", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  test("single-key shortcuts can be turned off, and stay off", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    const toggle = dialog.getByRole("switch", { name: "Single-key shortcuts (j, k, g, /, and ?)" });
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
    await expect(page).toHaveURL(new RegExp(`[?&]c=${next}(&|$)`));
    await expect(page.getByRole("region", { name: "Contests" })).toHaveAttribute("aria-keyshortcuts", "ArrowDown ArrowUp");
    await page.reload();
    await waitForKeys(page);
    const button = page.getByRole("button", { name: "Keyboard shortcuts" });
    await button.click();
    await expect(dialog).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await expect(dialog.getByText("Search guides (off)")).toBeVisible();
    await expect(dialog.getByText("Show these shortcuts (off)")).toBeVisible();
    await dialog.getByText("Single-key shortcuts (j, k, g, /, and ?)").click();
    await expect(toggle).toBeChecked();
    await expect(dialog.getByText("Search guides", { exact: true })).toBeVisible();
  });

  test("in the detail pane arrows don't switch contests but j does", async ({ page }) => {
    await openBallot(page, "?c=us-rep-11");
    await waitForKeys(page);
    const next = await after(page, "us-rep-11");
    await page.locator("[data-keys=pane]").locator("a, button").first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/[?&]c=us-rep-11/);
    await page.keyboard.press("j");
    await expect(page).toHaveURL(new RegExp(`[?&]c=${next}(&|$)`));
  });
});

test("resizing to a phone drops a stepped contest that was never written", async ({ page, isMobile }) => {
  test.skip(isMobile, "starts on desktop");
  await page.clock.install();
  await openBallot(page, "?c=us-rep-11");
  await expect(page.getByRole("region", { name: "Contests" })).toBeVisible();
  const next = await after(page, "us-rep-11");
  await pauseClock(page);
  await page.keyboard.down("ArrowDown");
  await expect(page.locator(`#row-d-${next}`)).toHaveAttribute("aria-current", "true");
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
  const next = await after(page, "us-rep-11");
  await pauseClock(page);
  await page.keyboard.down("ArrowDown");
  await expect(page.locator(`#row-d-${next}`)).toHaveAttribute("aria-current", "true");
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
    await waitForKeys(page);
    const prevented = await page.evaluate(() =>
      ["ArrowDown", "j"].map((key) => !window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }))),
    );
    expect(prevented).toEqual([false, false]);
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test("no shortcut hint, contest region or key hints", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
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

test.describe("section nav", () => {
  const bar = (page: Page) => page.locator("[data-section-nav]").getByRole("button");
  const menu = (page: Page) => page.getByRole("menu");

  test("the bar names the current place and section, and follows scrolling", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, Federal");
    await page.locator("#section-state-judicial").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const h = document.getElementById("section-state-judicial")!;
      window.scrollTo(0, window.scrollY + h.getBoundingClientRect().top - 80);
    });
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, Judicial");
  });

  test("choosing a section jumps there and focuses its heading", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await bar(page).click();
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole("menuitem", { name: /^California, \d+ contests?$/ })).toBeVisible();
    await menu(page).getByRole("menuitem", { name: /^Judicial/ }).click();
    const heading = page.locator("#section-state-judicial");
    await expect(heading).toBeFocused();
    await expect.poll(() => heading.evaluate((h) => Math.round(h.getBoundingClientRect().top)), { timeout: 3_000 }).toBeLessThan(100);
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, Judicial");
    await expect(page).not.toHaveURL(/#/);
  });

  test("works on an area page", async ({ page }) => {
    await page.goto(`${BALLOT}/sf`);
    await waitForKeys(page);
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, Federal");
    await bar(page).click();
    await menu(page).getByRole("menuitem", { name: /^Local candidates/ }).click();
    await expect(page.locator("#section-county-san-francisco-local-candidates")).toBeFocused();
  });

  for (const [path, county, city, cityId] of [
    [BALLOT, "San Mateo County", "Redwood City", "redwood-city"],
    [`${BALLOT}/san-mateo`, "San Mateo County", "Redwood City", "redwood-city"],
    [BALLOT, "Santa Clara County", "Mountain View", "mountain-view"],
    [`${BALLOT}/palo-alto`, "Santa Clara County", "Palo Alto", "palo-alto"],
  ] as const) {
    test(`on ${path} the menu lists every place on the page, and every item has a heading to jump to (${city})`, async ({ page }) => {
      await page.goto(path);
      await waitForKeys(page);
      const places = await page.locator("[data-keys=list] h2").allTextContents();
      expect(places).toContain(county);
      await bar(page).click();
      const items = menu(page).getByRole("menuitem");
      const hrefs = await items.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
      expect(await page.evaluate((ids) => ids.filter((h) => !document.querySelector(h)), hrefs)).toEqual([]);
      for (const place of places) await expect(menu(page).getByRole("menuitem", { name: new RegExp(`^${place}, \\d+ contests?$`) })).toHaveCount(1);
      await menu(page).getByRole("menuitem", { name: new RegExp(`^${city}, \\d+ contests?$`) }).click();
      await expect(page.locator(`#place-city-${cityId}`)).toBeFocused();
      await expect(bar(page)).toHaveAccessibleName(new RegExp(`^Jump to a section\\. Now: ${city}, `));
    });
  }

  test("a link to a section lands with its heading below the bar", async ({ page }) => {
    await page.goto(`${BALLOT}#section-state-judicial`);
    await waitForKeys(page);
    const heading = page.locator("#section-state-judicial");
    await expect(heading).toBeVisible();
    await expect
      .poll(async () => {
        const navBottom = await page.locator("[data-section-nav]").evaluate((el) => el.getBoundingClientRect().bottom);
        return (await heading.evaluate((el) => el.getBoundingClientRect().top)) >= navBottom;
      })
      .toBe(true);
  });

  test("menu items name their place and contest count", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await bar(page).click();
    await expect(menu(page).getByRole("group", { name: "California" }).getByRole("menuitem", { name: /^Judicial, \d+ contests?$/ })).toHaveCount(1);
    await expect(menu(page).getByRole("menuitem", { name: /^Regional measures, 1 contest$/ })).toHaveCount(1);
  });

  test("with reduced motion the jump is instant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openBallot(page);
    await waitForKeys(page);
    await bar(page).click();
    await menu(page).getByRole("menuitem", { name: /^San Francisco/ }).click();
    const top = await page.locator("#place-county-san-francisco").evaluate((h) => Math.round(h.getBoundingClientRect().top));
    expect(top).toBeLessThan(100);
  });
});

test.describe("desktop keyboard section nav", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");
  const bar = (page: Page) => page.locator("[data-section-nav]").getByRole("button");

  test("g opens the menu on the current section; arrows, Enter and Esc work in it", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Federal/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(bar(page)).toBeFocused();
    await page.keyboard.press("g");
    await expect(menu.getByRole("menuitem", { name: /^Federal/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: /^State, \d+ contests?$/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#section-state-state")).toBeFocused();
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, State");
  });

  test("stepping up with k never leaves the selected row under the bar", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    const last = (await page.locator("[id^=row-d-]").last().getAttribute("id"))!.replace("row-d-", "");
    await openBallot(page, `?c=${last}`);
    await waitForKeys(page);
    await page.locator(`#row-d-${last}`).scrollIntoViewIfNeeded();
    const navBottom = () => page.locator("[data-section-nav]").evaluate((el) => el.getBoundingClientRect().bottom);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("k");
      const top = await page.evaluate(() => (document.activeElement as HTMLElement).closest("div")!.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(await navBottom());
    }
  });

  test("after a jump, j selects the first contest in that place and stays there", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    await page.getByRole("menu").getByRole("menuitem", { name: /^San Francisco/ }).click();
    await expect(page.locator("#place-county-san-francisco")).toBeFocused();
    const first = (await page.locator("[aria-label^='San Francisco: '] a[id^=row-d-]").first().getAttribute("id"))!;
    await page.keyboard.press("j");
    await expect(page.locator(`#${first}`)).toBeFocused();
    await expect(page.locator(`#${first}`)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(`#${first}`)).toBeInViewport();
  });

  test("a click on a row after a jump steps from that row", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    await page.getByRole("menu").getByRole("menuitem", { name: /^San Francisco/ }).click();
    await expect(page.locator("#place-county-san-francisco")).toBeFocused();
    await page.locator("#row-d-treasurer").click();
    await expect(page).toHaveURL(/[?&]c=treasurer/);
    await page.keyboard.press("j");
    await expect(page).toHaveURL(/[?&]c=attorney-general/);
  });

  test("Shift+Tab never leaves the focused link under the bar", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium");
    await openBallot(page);
    await waitForKeys(page);
    await page.locator("footer a").last().focus();
    const navBottom = () => page.locator("[data-section-nav]").evaluate((el) => el.getBoundingClientRect().bottom);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Shift+Tab");
      const top = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return el.closest("[data-keys=list]") && !el.closest("[data-section-nav]") ? el.getBoundingClientRect().top : null;
      });
      if (top !== null) expect(top).toBeGreaterThanOrEqual(await navBottom());
    }
  });

  test("a modified click on a menu item is left to the browser", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    const item = page.getByRole("menu").getByRole("menuitem", { name: /^San Francisco/ });
    const prevented = await item.evaluate((el) => !el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true, ctrlKey: true })));
    expect(prevented).toBe(false);
  });

  test("k after a jump selects the last contest before that place", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    await page.getByRole("menu").getByRole("menuitem", { name: /^San Francisco/ }).click();
    await expect(page.locator("#place-county-san-francisco")).toBeFocused();
    const before = (await page.locator("[aria-label^='Bay Area: '] a[id^=row-d-]").last().getAttribute("id"))!;
    await page.keyboard.press("k");
    await expect(page.locator(`#${before}`)).toBeFocused();
  });

  test("stepping with j across a section boundary updates the bar", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    const ids = await page.locator("[aria-label='California: Federal'] a[id^=row-d-]").evaluateAll((els) => els.map((e) => e.id.replace("row-d-", "")));
    const firstState = await page.locator("[aria-label='California: State'] a[id^=row-d-]").first().getAttribute("id");
    await openBallot(page, `?c=${ids.at(-1)}`);
    await waitForKeys(page);
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, Federal");
    await page.keyboard.press("j");
    await expect(page).toHaveURL(new RegExp(`[?&]c=${firstState!.replace("row-d-", "")}`));
    await expect(bar(page)).toHaveAccessibleName("Jump to a section. Now: California, State");
  });

  test("g does nothing when single-key shortcuts are off, and the dialog lists it", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog.getByText("Jump to a section")).toBeVisible();
    await dialog.getByRole("switch").click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.keyboard.press("g");
    await page.waitForTimeout(300);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});

test.describe("phone section nav", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("g does nothing on a phone", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    await page.keyboard.press("g");
    await page.waitForTimeout(300);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("the bar sticks to the top without covering the Filters button, and its menu jumps", async ({ page }) => {
    await openBallot(page);
    await waitForKeys(page);
    const filters = page.getByRole("button", { name: /Filters/ });
    const nav = page.locator("[data-section-nav]");
    const [f, n] = [(await filters.boundingBox())!, (await nav.boundingBox())!];
    expect(n.y).toBeGreaterThanOrEqual(f.y + f.height);
    await page.evaluate(() => window.scrollBy(0, 2000));
    await expect.poll(async () => Math.round((await nav.boundingBox())!.y)).toBe(0);
    await nav.getByRole("button").tap();
    await page.getByRole("menu").getByRole("menuitem", { name: /^San Francisco/ }).tap();
    await expect(page.locator("#place-county-san-francisco")).toBeFocused();
    await expect(nav.getByRole("button")).toHaveAccessibleName(/^Jump to a section\. Now: San Francisco, /);
  });
});

test.describe("pages without the filter column", () => {
  for (const url of ["/guides/growsf", "/about", "/changelog"]) {
    test(`${url} centers its content at the list's reading width`, async ({ page, isMobile }) => {
      await page.goto(url);
      const column = page.locator("[data-page-column]");
      const box = (await column.boundingBox())!;
      const width = page.viewportSize()!.width;
      if (isMobile) {
        expect(box.x).toBe(16);
        expect(Math.round(box.width)).toBe(width - 32);
      } else {
        expect(Math.round(box.width)).toBe(768);
        expect(Math.abs(box.x - (width - box.x - box.width))).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe("guide page rows", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`the row focus outline has at least 3:1 contrast against the card (${colorScheme})`, async ({ page, isMobile }) => {
      test.skip(isMobile, "keyboard");
      await page.emulateMedia({ colorScheme });
      await page.goto("/guides/growsf");
      const first = page.locator("ul a[href^='/2026-11/']").first();
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const ratio = await first.evaluate((el) => {
        const row = el.closest("li")!;
        const card = getComputedStyle(row.closest("ul")!).backgroundColor;
        const page = getComputedStyle(document.body).backgroundColor;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const paint = (...colors: string[]) => {
          ctx.clearRect(0, 0, 1, 1);
          for (const c of colors) {
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
          }
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bg = paint(page, card);
        const fg = paint(page, card, getComputedStyle(row).outlineColor);
        const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  }

  test("at 320px the chevron stays with the pick and a district number stays with its title", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone width");
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/guides/growsf");
    const lines = await page.locator("ul a[href^='/2026-11/']").evaluateAll((links) =>
      links.map((a) => {
        const lineOf = (node: Node, start: number, end: number) => {
          const r = document.createRange();
          r.setStart(node, start);
          r.setEnd(node, end);
          return Math.round(r.getClientRects()[0].top);
        };
        const texts: Text[] = [];
        const walk = document.createTreeWalker(a.closest("li")!, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) if ((walk.currentNode as Text).data.trim()) texts.push(walk.currentNode as Text);
        const chevron = texts.find((t) => t.data.trim() === "›" || t.data.endsWith("›"))!;
        const pick = texts[texts.indexOf(chevron) - 1] ?? chevron;
        const title = texts[0];
        const m = title.data.match(/(\S+)\s(\d+)$/);
        return {
          chevronWithPick: chevron === pick || lineOf(chevron, chevron.data.length - 1, chevron.data.length) === lineOf(pick, pick.data.trimEnd().length - 1, pick.data.trimEnd().length),
          numberWithTitle: !m || lineOf(title, title.data.length - m[2].length, title.data.length) === lineOf(title, m.index!, m.index! + 1 + m[1].length - 1),
        };
      }),
    );
    expect(lines.every((l) => l.chevronWithPick)).toBe(true);
    expect(lines.every((l) => l.numberWithTitle)).toBe(true);
  });

  test("a row's link names the contest and the guide's pick", async ({ page }) => {
    await page.goto("/guides/growsf");
    await expect(page.getByRole("link", { name: /^Governor:? Xavier Becerra$/ })).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`a keyboard-focused contest row shows a focus outline (${colorScheme})`, async ({ page, isMobile }) => {
      test.skip(isMobile, "keyboard");
      await page.emulateMedia({ colorScheme });
      await page.goto("/guides/growsf");
      const first = page.locator("main ul a, ul a[href^='/2026-11/']").first();
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
      const outline = await first.evaluate((el) => {
        const row = el.closest("li") ?? el;
        const styles = [getComputedStyle(el), getComputedStyle(row)];
        return styles.map((s) => [s.outlineStyle, s.outlineWidth]);
      });
      expect(outline.some(([style, width]) => style !== "none" && width !== "0px")).toBe(true);
    });
  }
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
          const now = Date.now();
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

  test("opening and closing a contest sheet many times within ten seconds stays under the history limit", async ({ page }) => {
    test.setTimeout(120_000);
    await limitHistory(page);
    const errors = watchErrors(page);
    await openBallot(page);
    // Frozen Date.now puts every cycle in one 10-second window however slow the machine is; timers still run.
    await page.clock.setFixedTime(Date.now());
    const sheet = page.getByRole("dialog", { name: "Governor" });
    for (let i = 0; i < 40; i++) {
      await contestRow(page, "Governor").tap({ timeout: 5_000 });
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      expect(errors).toEqual([]);
    }
    expect(await busiestWindow(page)).toBeLessThanOrEqual(90);
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

test("without JavaScript the section bar isn't shown", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(BALLOT);
  await expect(page.locator("[data-section-nav]")).toBeHidden();
  await context.close();
});

