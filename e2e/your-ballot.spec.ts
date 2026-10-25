import { expect, test, type Page } from "@playwright/test";
import { BALLOT, isPhone, waitForKeys, watchErrors } from "./helpers";

const BEFORE = new Date("2026-10-24T19:00:00Z");
const AFTER = new Date("2026-11-06T19:00:00Z");

const pill = (page: Page, name: RegExp) => page.getByRole("button", { name });
const sheet = (page: Page) => page.getByRole("dialog");
const vote = (page: Page) => page.getByRole("region", { name: "Your vote" });
const KEY = "bb-ballot-2026-11";
const seed = (page: Page, picks: Record<string, unknown> = {}, started = true) =>
  page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("seeded")) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "1");
    },
    [KEY, JSON.stringify({ started, picks })],
  );

test.describe("Your ballot", () => {
  test("start, pick on a contest page, and see the pick in the sheet", async ({ page }) => {
    const errors = watchErrors(page);
    await page.clock.setFixedTime(BEFORE);
    await page.goto(`${BALLOT}/sf`);
    await expect(vote(page)).toHaveCount(0);

    await pill(page, /^Your ballot$/).click();
    await expect(sheet(page)).toContainText("Not started");
    await expect(sheet(page).getByText("Proposition 5", { exact: true })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Start my ballot" }).click();
    await expect(sheet(page)).toContainText("0 picked");

    await sheet(page).getByRole("link", { name: /^Proposition 5\b/ }).click();
    await expect(page).toHaveURL(`${BALLOT}/prop-5`);
    await vote(page).getByRole("button", { name: "Yes" }).click();
    await expect(vote(page).getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    await expect(pill(page, /^Your ballot/)).toContainText("1");

    await page.reload();
    await expect(vote(page).getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    await pill(page, /^Your ballot/).click();
    const here = sheet(page).getByRole("link", { name: /^Proposition 5/ });
    await expect(here).toHaveAttribute("aria-current", "page");
    await expect(here).toContainText("Yes");
    expect(errors).toEqual([]);
  });

  test("a ranked-choice race ranks in tap order", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await page.addInitScript(() => localStorage.setItem("bb-ballot-2026-11", JSON.stringify({ started: true, picks: {} })));
    await page.goto(`${BALLOT}/supervisor-8`);
    await vote(page).getByRole("button", { name: /Michael T\. Nguyen/ }).click();
    await vote(page).getByRole("button", { name: /Gary McCoy/ }).click();
    await expect(vote(page).getByRole("button", { name: /Gary McCoy/ })).toContainText("2");
    await vote(page).getByRole("button", { name: /Michael T\. Nguyen/ }).click();
    await expect(vote(page).getByRole("button", { name: /Gary McCoy/ })).toContainText("1");
  });

  test("after election day the picks are read-only, and deleting them hides the pill", async ({ page }) => {
    await page.clock.setFixedTime(AFTER);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("bb-ballot-2026-11", JSON.stringify({ started: true, picks: { "prop-5": "Y" } }));
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto(`${BALLOT}/prop-5`);
    await expect(page.getByText("You planned:")).toBeVisible();
    await expect(vote(page)).toHaveCount(0);

    await pill(page, /^Your Nov 3 ballot$/).click();
    await expect(sheet(page)).toContainText("Locked");
    await sheet(page).getByRole("button", { name: "Delete my picks" }).click();
    await sheet(page).getByRole("button", { name: "Delete picks" }).click();
    await expect(pill(page, /^Your Nov 3 ballot$/)).toHaveCount(0);
    await expect(page.getByText("You planned:")).toHaveCount(0);
  });

  test("with no picks after election day there is no pill", async ({ page }) => {
    await page.clock.setFixedTime(AFTER);
    await page.goto(`${BALLOT}/sf`);
    await waitForKeys(page);
    await expect(page.getByRole("button", { name: /^Your .*ballot/ })).toHaveCount(0);
  });

  test("measures take Yes, No or Blank, and a second tap clears", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page);
    await page.goto(`${BALLOT}/prop-5`);
    for (const name of ["No", "Blank"]) {
      await vote(page).getByRole("button", { name }).click();
      await expect(vote(page).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    }
    await expect(vote(page).getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "false");
    await vote(page).getByRole("button", { name: "Blank" }).click();
    await expect(vote(page).getByRole("button", { pressed: true })).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('{"started":true,"picks":{}}');
  });

  test("a tap writes against what's stored, keeping a pick this page never saw", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page);
    await page.goto(`${BALLOT}/prop-5`);
    await expect(vote(page)).toBeVisible();
    // A same-document setItem fires no storage event, so the page still renders the old ballot.
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ started: true, picks: { "prop-1": "N" } })), KEY);
    await vote(page).getByRole("button", { name: "Yes" }).click();
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!).picks).toEqual({ "prop-1": "N", "prop-5": "Y" });
  });

  test("a vote-for-3 board stops at 3, and Leave blank replaces the names", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page);
    await page.goto(`${BALLOT}/board-of-education`);
    for (const name of ["Virginia Cheung", "Ryan Hazelton", "Reina Tello", "Phil Kim"]) await vote(page).getByRole("button", { name }).click();
    await expect(vote(page)).toContainText("3 of 3 chosen");
    await expect(vote(page).getByRole("button", { name: "Phil Kim" })).toHaveAttribute("aria-pressed", "false");
    await vote(page).getByRole("button", { name: "Leave blank" }).click();
    await expect(vote(page).getByRole("button", { pressed: true })).toHaveText("Leave blank");
  });

  test("a saved name the data no longer lists takes no seat", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page, { "board-of-education": ["Virginia Cheung", "Someone Withdrawn", "Reina Tello"] });
    await page.goto(`${BALLOT}/board-of-education`);
    await expect(vote(page)).toContainText("2 of 3 chosen");
    await vote(page).getByRole("button", { name: "Phil Kim" }).click();
    await expect(vote(page).getByRole("button", { name: "Phil Kim" })).toHaveAttribute("aria-pressed", "true");
  });

  test("b opens the sheet, except while typing", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard shortcut");
    await page.clock.setFixedTime(BEFORE);
    await page.goto(`${BALLOT}/sf`);
    await waitForKeys(page);
    await page.getByRole("searchbox").first().focus();
    await page.keyboard.press("b");
    await expect(sheet(page)).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("Meta+b");
    await page.keyboard.press("Control+b");
    await expect(sheet(page)).toHaveCount(0);
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("b");
    await expect(page.getByRole("dialog", { name: "Your ballot" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("b");
    await expect(sheet(page)).toContainText("Not started");
  });

  test("Back from a contest opened in the sheet returns to the page under it", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page);
    await page.goto(`${BALLOT}/sf`);
    await pill(page, /^Your ballot/).click();
    await sheet(page).getByRole("link", { name: /^Proposition 5\b/ }).click();
    await expect(page).toHaveURL(`${BALLOT}/prop-5`);
    await expect(sheet(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(`${BALLOT}/sf`);
    await expect(sheet(page)).toHaveCount(0);
    await page.goBack();
    await expect(page).not.toHaveURL(`${BALLOT}/sf`);
  });

  test("copy, stop, and delete with a confirm before election day", async ({ page, context, browserName }) => {
    await page.clock.setFixedTime(BEFORE);
    await seed(page, { "prop-5": "Y", "supervisor-8": ["Gary McCoy"] });
    await page.goto(`${BALLOT}/sf`);
    await pill(page, /^Your ballot/).click();
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await sheet(page).getByRole("button", { name: "Copy as text" }).click();
      await expect(sheet(page).getByRole("button", { name: "Copied" })).toBeVisible();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toContain("Your ballot · San Francisco");
      expect(text).toContain("Proposition 5: Yes");
      expect(text).toContain("Board of Supervisors, District 8: 1. Gary McCoy");
    }
    await sheet(page).getByRole("button", { name: "Stop recording picks" }).click();
    await expect(sheet(page)).toContainText("Not started");
    await expect(sheet(page).getByRole("button", { name: "Start my ballot" })).toBeVisible();
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!)).toEqual({ started: false, picks: { "prop-5": "Y", "supervisor-8": ["Gary McCoy"] } });

    await sheet(page).getByRole("button", { name: "Delete my picks" }).click();
    await sheet(page).getByRole("button", { name: "Cancel" }).click();
    await expect(sheet(page)).toContainText("Proposition 5");
    await sheet(page).getByRole("button", { name: "Delete my picks" }).click();
    await sheet(page).getByRole("button", { name: "Delete picks" }).click();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    await page.keyboard.press("Escape");
    await expect(pill(page, /^Your ballot$/)).toBeVisible();
  });

  test("picks stay editable through election day in Pacific time, then lock", async ({ page }) => {
    await seed(page, { "prop-5": "Y" });
    await page.clock.setFixedTime(new Date("2026-11-04T07:30:00Z"));
    await page.goto(`${BALLOT}/prop-5`);
    await expect(vote(page).getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    await page.clock.setFixedTime(new Date("2026-11-04T08:30:00Z"));
    await page.reload();
    await expect(page.getByText("You planned:")).toBeVisible();
    await expect(vote(page)).toHaveCount(0);
  });

  test("a blocked browser keeps picks for the visit and says they aren't saved", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key.startsWith("bb-ballot")) throw new DOMException("blocked", "SecurityError");
        return set.call(this, key, value);
      };
    });
    await page.goto(`${BALLOT}/prop-5`);
    await pill(page, /^Your ballot$/).click();
    await sheet(page).getByRole("button", { name: "Start my ballot" }).click();
    await page.keyboard.press("Escape");
    await vote(page).getByRole("button", { name: "Yes" }).click();
    await expect(vote(page)).toContainText("Not saved");
    await expect(vote(page)).toContainText("your picks will be gone when you close the tab");
    await expect(pill(page, /^Your ballot/)).toContainText("1");
  });

  test("a failed load offers a retry that works", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    let failed = false;
    await page.route("**/my-ballot.json*", (route) => {
      if (failed) return route.continue();
      failed = true;
      return route.abort();
    });
    await page.goto(`${BALLOT}/sf`);
    await pill(page, /^Your ballot$/).click();
    await expect(sheet(page).getByRole("alert")).toContainText("Couldn't load your ballot.");
    await sheet(page).getByRole("button", { name: "Try again" }).click();
    await expect(sheet(page).getByText("Proposition 5", { exact: true })).toBeVisible();
  });

  test("the sheet keeps the voter's area after a visit to the Bay Area page", async ({ page }) => {
    await page.clock.setFixedTime(BEFORE);
    await page.goto(`${BALLOT}/oakland`);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("bb-ballot-area"))).toBe("oakland");
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("bb-area"))).toBe("bay-area");
    await page.goto(`${BALLOT}/prop-1`);
    await pill(page, /^Your ballot$/).click();
    await expect(sheet(page)).toContainText("Oakland ballot.");
  });
});
