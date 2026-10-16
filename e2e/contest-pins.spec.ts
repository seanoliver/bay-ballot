import path from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { ballotViewProps } from "../src/lib/site-data";
import { BALLOT, contestRow, isPhone, waitForKeys, watchErrors } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
// A contest an area's list shows with Bay Area guides, because none of the area's own took a position.
const FALLBACK = data.areas.flatMap((a) => (ballotViewProps(data, { area: a }).fallback?.sections ?? []).flatMap((s) => s.contests.map((id) => ({ area: a.id, id }))))[0];

const yesSide = (n: number) =>
  data.ballot.contests.find((c) => c.kind === "measure" && Object.values(data.endorsements).filter((e) => e.status === "published" && e.picks[c.id]?.pick === "Y").length === n);

const PROP_D = `${BALLOT}/prop-d`;
const pinParam = (...ids: string[]) => new RegExp(`[?&]pin=${ids.join("(,|%2C)")}(&|$)`);

async function expandChips(scope: Page | Locator) {
  const more = scope.getByRole("button", { name: /^\+\d+ more$/ });
  for (let n = await more.count(); n > 0; n--) {
    await more.first().click();
    await expect(more).toHaveCount(n - 1);
  }
}

async function openContest(page: Page, query = "") {
  await page.goto(`${PROP_D}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Proposition D" })).toBeVisible();
  // A press before hydration is dropped.
  await waitForKeys(page);
  await expandChips(page);
}

async function filterPanel(page: Page, info: TestInfo) {
  if (!isPhone(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

async function closePanel(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Close" }).click();
}

// A chip's name is "Pin <guide>", plus "(gave reasons)" when the guide explained its pick here.
const pinChip = (scope: Page | Locator, name: string) => scope.getByRole("button", { name: new RegExp(`^Pin ${name}( \\(gave reasons\\))?$`) });

test.describe("pinning from a contest page", () => {
  test("a guide chip pins the guide, which then shows in Your guides and on the ballot list", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openContest(page);
    const yes = page.getByRole("group", { name: "Guides for Yes" });
    const spur = pinChip(yes, "SPUR");
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
    await expandChips(page);
    await spur.click();
    await expect(spur).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/[?&]pin=/);
    expect(errors).toEqual([]);
  });

  test("a side shows four chips, then +N more shows the rest below and Show less hides them", async ({ page }) => {
    await page.goto(PROP_D);
    await waitForKeys(page);
    const yes = page.getByRole("group", { name: "Guides for Yes" });
    const chips = yes.getByRole("button", { name: /^Pin / });
    await expect(chips).toHaveCount(4);
    const more = yes.getByRole("button", { name: /^\+\d+ more$/ });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    const n = Number((await more.textContent())!.match(/\d+/)![0]);
    await more.click();
    await expect(chips).toHaveCount(4 + n);
    await expect(yes.getByRole("list")).toHaveCount(2);
    await expect(yes.getByRole("list").nth(1).getByRole("button", { name: /^Pin / })).toHaveCount(n);
    const less = yes.getByRole("button", { name: "Show less" });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    await less.click();
    await expect(chips).toHaveCount(4);
  });

  test("a side of five guides shows four and +1 more, and a side of four shows all four", async ({ page }) => {
    const sides = [yesSide(5), yesSide(4)];
    test.skip(!sides[0] || !sides[1], "no measure has exactly five or four Yes guides in today's data");
    for (const [c, button] of [[sides[0]!, 1], [sides[1]!, 0]] as const) {
      await page.goto(`${BALLOT}/${c.id}`);
      const yes = page.getByRole("group", { name: "Guides for Yes" });
      await expect(yes.getByRole("button", { name: /^Pin / })).toHaveCount(4);
      await expect(yes.getByRole("button", { name: /^\+\d+ more$/ })).toHaveCount(button);
    }
  });

  test("pinning a five-guide side's last chip and pressing Show less keeps focus on a chip, with no +0 more", async ({ page }) => {
    const c = yesSide(5);
    test.skip(!c, "no measure has exactly five Yes guides in today's data");
    await page.goto(`${BALLOT}/${c!.id}`);
    await waitForKeys(page);
    const yes = page.getByRole("group", { name: "Guides for Yes" });
    await yes.getByRole("button", { name: "+1 more" }).click();
    await yes.getByRole("list").nth(1).getByRole("button", { name: /^Pin / }).click();
    await yes.getByRole("button", { name: "Show less" }).focus();
    await page.keyboard.press("Enter");
    const chips = yes.getByRole("button", { name: /^Pin / });
    await expect(chips).toHaveCount(5);
    await expect(yes.getByRole("button", { name: /more$/ })).toHaveCount(0);
    await expect(chips.last()).toBeFocused();
  });

  test("a side with fewer than four guides has no +N more", async ({ page }) => {
    await page.goto(`${BALLOT}/supervisor-10`);
    await waitForKeys(page);
    let small = 0;
    for (const group of await page.getByRole("group", { name: /^Guides / }).all()) {
      if ((await group.getByRole("button", { name: /^Pin / }).count()) >= 4) continue;
      await expect(group.getByRole("button", { name: /^\+\d+ more$/ })).toHaveCount(0);
      small++;
    }
    expect(small).toBeGreaterThan(0);
  });

  test("a pinned guide past the first four shows without expanding, and stays until Show less after an unpin", async ({ page }) => {
    await page.goto(`${PROP_D}?pin=spur`);
    await waitForKeys(page);
    const yes = page.getByRole("group", { name: "Guides for Yes" });
    const chips = yes.getByRole("button", { name: /^Pin / });
    const spur = pinChip(yes, "SPUR");
    await expect(chips).toHaveCount(5);
    await expect(spur).toHaveAttribute("aria-pressed", "true");
    const more = yes.getByRole("button", { name: /^\+\d+ more$/ });
    const hidden = Number((await more.textContent())!.match(/\d+/)![0]);
    await more.click();
    await expect(pinChip(yes.getByRole("list").first(), "SPUR")).toHaveCount(1);
    await expect(yes.getByRole("list").nth(1).getByRole("button", { name: /^Pin / })).toHaveCount(hidden);
    await yes.getByRole("button", { name: "Show less" }).click();
    await spur.click();
    await expect(spur).toHaveAttribute("aria-pressed", "false");
    await expect(chips).toHaveCount(5);
    await yes.getByRole("button", { name: /^\+\d+ more$/ }).click();
    await yes.getByRole("button", { name: "Show less" }).click();
    await expect(chips).toHaveCount(4);
    await expect(spur).toHaveCount(0);
  });

  test("with four pinned, other chips are disabled and say why", async ({ page }) => {
    await openContest(page, "?pin=sf-chronicle,growsf,sf-dems,league-pissed-off-voters");
    const fifth = pinChip(page, "SPUR");
    await expect(fifth).toHaveAttribute("aria-disabled", "true");
    await expect(fifth).toHaveAccessibleDescription("4 of 4 pinned. Unpin one to pin another.");
    await expect(page.getByText("4 of 4 pinned. Unpin one to pin another.").first()).toHaveClass(/\bsr-only\b/);
    await fifth.click({ force: true });
    await expect(fifth).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(pinParam("sf-chronicle", "growsf", "sf-dems", "league-pissed-off-voters"));
    const pinned = pinChip(page, "GrowSF");
    await expect(pinned).toHaveAttribute("aria-pressed", "true");
    await expect(pinned).not.toHaveAttribute("aria-disabled");
  });

  test("tapping a pin at the limit says why nothing changed", async ({ page }) => {
    await openContest(page, "?pin=sf-chronicle,growsf,sf-dems,league-pissed-off-voters");
    await pinChip(page, "SPUR").click({ force: true });
    await expect(page.getByRole("status")).toHaveText("You can pin up to 4 guides. Unpin one first.");
  });

  test("the whole chip is the pin button, with nothing else to tap inside it", async ({ page }, info) => {
    await openContest(page);
    const chip = pinChip(page.getByRole("group", { name: "Guides for Yes" }), "GrowSF");
    await expect(chip.locator("a")).toHaveCount(0);
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(isPhone(info) ? 40 : 36);
    // On the pin icon near its left edge, and on the name in its middle: each toggles.
    await chip.click({ position: { x: 8, y: 12 } });
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("Enter and Space on a focused chip pin and unpin it", async ({ page }) => {
    await openContest(page);
    const chip = pinChip(page.getByRole("group", { name: "Guides for Yes" }), "SPUR");
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(pinParam("spur"));
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/[?&]pin=/);
  });

  test("Guide pages lists each side's guides as links, in the chips' order", async ({ page }) => {
    await openContest(page);
    const side = page.getByRole("group", { name: "Guides for Yes" }).locator("xpath=ancestor::section[1]");
    const list = side.getByRole("list", { name: "Guide pages for Yes" });
    await expect(list).toHaveCount(0);
    await side.getByRole("button", { name: "Guide pages for Yes" }).click();
    const links = list.getByRole("link");
    // A chip's visible name is its only bare text; the rest is in spans.
    const chips = await side
      .getByRole("group", { name: "Guides for Yes" })
      .getByRole("button", { name: /^Pin / })
      .evaluateAll((els) => els.map((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim()));
    const names = (await links.allTextContents()).map((t) => t.trim());
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual(chips.slice(0, names.length));
    await expect(links).toHaveCount(12);
    const more = side.getByRole("button", { name: /^and \d+ more guide pages for / });
    await expect(more).toHaveCount(1);
    const n = Number((await more.textContent())!.match(/\d+/)![0]);
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(links).toHaveCount(names.length + n);
    await expect(links.nth(names.length)).toBeFocused();
    const growsf = list.getByRole("link", { name: "GrowSF", exact: true });
    await expect(growsf).toHaveAttribute("href", "/guides/growsf");
    await growsf.click();
    await expect(page).toHaveURL(/\/guides\/growsf$/);
  });

  test("Your guides names link to their guide pages", async ({ page }, info) => {
    await openContest(page, "?pin=spur");
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("link", { name: "SPUR", exact: true })).toHaveAttribute("href", "/guides/spur");
  });

  test("a chip with the quote mark explains it on hover, and no-pick chips never have it", async ({ page }, info) => {
    await openContest(page);
    await expect(page.getByText(/means the guide explained its pick/)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Guides with no pick" }).getByRole("button", { name: /\(gave reasons\)$/ })).toHaveCount(0);
    if (isPhone(info)) return;
    const chip = page.getByRole("group", { name: "Guides for Yes" }).getByRole("button", { name: /\(gave reasons\)$/ }).first();
    const tip = chip.locator("[data-tip]");
    await expect(tip).toBeHidden();
    await chip.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("Gave reasons on this contest.");
  });

  test("an only= link counts just its guides, and Reset then Close leaves no filter in the URL", async ({ page }, info) => {
    await openContest(page, "?only=growsf,sf-chronicle");
    const counted = page.getByText(/\d+ of \d+ guides counted/).filter({ visible: true }).first();
    await expect(counted).toContainText(/^.*\b2 of \d+ guides counted/);
    const panel = await filterPanel(page, info);
    await panel.getByRole("button", { name: "Reset filters" }).click();
    // Close steps back in history; the reset query is re-applied on the popstate after it.
    const popped = isPhone(info) ? page.evaluate(() => new Promise((r) => addEventListener("popstate", () => setTimeout(r, 0), { once: true }))) : null;
    await closePanel(page, info);
    await popped;
    await expect(page).not.toHaveURL(/[?&](only|off)=/);
    await expect(counted).not.toContainText(/\b2 of /);
  });

  test("a candidate race has a pin list per candidate", async ({ page }) => {
    await page.goto(`${BALLOT}/supervisor-10`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const lists = page.getByRole("group", { name: /^Guides for / });
    expect(await lists.count()).toBeGreaterThan(1);
    await expect(lists.first().getByRole("button", { name: /^Pin / }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Count only/ })).toHaveCount(0);
  });
});

test.describe("pinning from the ballot list's contest detail", () => {
  const SF = `${BALLOT}/sf`;
  const rowPins = (page: Page) =>
    page.locator("li").filter({ has: contestRow(page, "Proposition D") }).getByRole("list", { name: "Your guides' picks" }).filter({ visible: true });

  test("the desktop pane pins guides into the list rows", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    const errors = watchErrors(page);
    await page.goto(`${SF}?c=prop-d`);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await expect(pane).toBeVisible();
    await expandChips(pane);
    await pinChip(pane, "SPUR").click();
    await expect(rowPins(page).getByRole("listitem")).toHaveText([/^SPUR:\s*Yes$/]);
    await expect(pane.getByRole("status")).toHaveText("Pinned SPUR · 1 of 4 pinned");
    const sidebar = page.getByRole("complementary", { name: "Filters" });
    await expect(sidebar.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveText(["SPUR"]);

    expect(errors).toEqual([]);
  });

  test("switching the pane to another contest starts its chips collapsed", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    await expandChips(page.getByRole("region", { name: "Proposition D" }));
    await contestRow(page, "Proposition B").click();
    const pane = page.getByRole("region", { name: "Proposition B" });
    await expect(pane.getByRole("group", { name: /^Guides / }).first()).toBeVisible();
    await expect(pane.getByRole("button", { name: "Show less" })).toHaveCount(0);
  });

  test("a chip's tooltip opens on keyboard focus, gives the full name, and Escape hides it without closing the pane", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const pane = page.getByRole("region", { name: "Proposition D" });
    const chip = pinChip(pane, "SF Chronicle");
    await expect(chip).toHaveAccessibleDescription("San Francisco Chronicle");
    const tip = chip.locator("[data-tip]");
    await expect(tip).toBeHidden();
    await pane.getByRole("group", { name: /^Guides for / }).first().getByRole("button").first().focus();
    for (let i = 0; i < 12 && !(await chip.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(chip).toBeFocused();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await expect(pane).toBeVisible();
    await expect(page).toHaveURL(/[?&]c=prop-d/);
  });

  test("Escape hides a hovered chip's tooltip while focus is elsewhere, and leaves the pane open", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await pane.getByRole("button", { name: "Guide pages for Yes" }).focus();
    const chip = pinChip(pane, "SF Chronicle");
    const tip = chip.locator("[data-tip]");
    await chip.hover();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await page.waitForTimeout(500);
    await expect(pane).toBeVisible();
    await expect(page).toHaveURL(/[?&]c=prop-d/);
    // Away from the chip, Escape closes the pane as before.
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]c=prop-d/);
  });

  test("a click on a tooltip hides it and pins nothing", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const chip = pinChip(page.getByRole("region", { name: "Proposition D" }), "SF Chronicle");
    const tip = chip.locator("[data-tip]");
    await chip.hover();
    await expect(tip).toBeVisible();
    await tip.locator("b").click();
    await expect(tip).toBeHidden();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/[?&]pin=/);
  });

  test("with one chip hovered and another focused, Escape hides both tooltips", async ({ page }, info) => {
    test.skip(isPhone(info), "a fine pointer at sheet width");
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(SF);
    await waitForKeys(page);
    await contestRow(page, "Proposition D").click();
    const sheet = page.getByRole("dialog", { name: "Proposition D" });
    const focused = pinChip(sheet, "SF Chronicle");
    await sheet.getByRole("group", { name: /^Guides for / }).first().getByRole("button").first().focus();
    for (let i = 0; i < 12 && !(await focused.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(focused).toBeFocused();
    const hovered = sheet.getByRole("group", { name: /^Guides for / }).first().getByRole("button", { name: /\(gave reasons\)$/ }).filter({ hasNotText: "SF Chronicle" }).first();
    await hovered.hover();
    await expect(hovered.locator("[data-tip]")).toBeVisible();
    await expect(focused.locator("[data-tip]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(hovered.locator("[data-tip]")).toBeHidden();
    await expect(focused.locator("[data-tip]")).toBeHidden();
    await expect(sheet).toBeVisible();
  });

  test("in the sheet with a mouse, Escape hides a chip's tooltip and leaves the sheet open", async ({ page }, info) => {
    test.skip(isPhone(info), "a fine pointer at sheet width");
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(SF);
    await waitForKeys(page);
    await contestRow(page, "Proposition D").click();
    const sheet = page.getByRole("dialog", { name: "Proposition D" });
    await expect(sheet).toBeVisible();
    const chip = pinChip(sheet, "SF Chronicle");
    const tip = chip.locator("[data-tip]");
    await sheet.getByRole("group", { name: /^Guides for / }).first().getByRole("button").first().focus();
    for (let i = 0; i < 12 && !(await chip.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(chip).toBeFocused();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    // A closing sheet stays visible while it animates out; give it time to finish.
    await page.waitForTimeout(1000);
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/[?&]c=prop-d/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("every chip's tooltip stays inside its row of chips", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const group = page.getByRole("region", { name: "Proposition D" }).getByRole("group", { name: "Guides for Yes" });
    await expandChips(group);
    const row = (await group.boundingBox())!;
    const chips = group.getByRole("button", { name: /^Pin / });
    let checked = 0;
    for (const chip of await chips.all()) {
      const tip = chip.locator("[data-tip]");
      if (!(await tip.count())) continue;
      await chip.hover();
      await expect(tip).toBeVisible();
      const box = (await tip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(row.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width + 1);
      const onTop = await tip.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      expect(onTop).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
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

  test("No pick on a county list covers only the contest's own city", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${BALLOT}/alameda-county?c=oakland-mayor`);
    const pane = page.locator("section[aria-labelledby='detail-title']");
    await expect(pane.getByRole("group", { name: /^Guides for / }).first()).toBeVisible();
    await expandChips(pane);
    await expect(pinChip(pane, "Berkeley Dems")).toHaveCount(0);
  });

  test("the phone sheet pins guides", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(SF);
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    await contestRow(page, "Proposition D").tap();
    const sheet = page.getByRole("dialog", { name: "Proposition D" });
    await expect(sheet).toBeVisible();
    await expandChips(sheet);
    await pinChip(sheet, "SPUR").click();
    await expect(sheet.getByRole("status")).toHaveText("Pinned SPUR · 1 of 4 pinned");
    await expect(sheet.getByRole("status")).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(rowPins(page).getByRole("listitem")).toHaveText([/^SPUR:\s*Yes$/]);
    await expect(page).toHaveURL(/[?&]pin=spur/);
  });
});
