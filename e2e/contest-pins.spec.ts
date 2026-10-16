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

// A measure with a Yes guide that gave no quote on it, so the guide's only link on the contest page is its chip.
const CHIP_ONLY = data.ballot.contests
  .filter((c) => c.kind === "measure")
  .flatMap((c) =>
    Object.values(data.endorsements)
      .filter((e) => e.status === "published" && e.picks[c.id]?.pick === "Y" && !(e.hasReasoning && e.picks[c.id].quotes.length > 0))
      .map((e) => ({ contest: c.id, guide: e.guide })),
  )[0];

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

const pinChip = (scope: Page | Locator, name: string) => scope.getByRole("button", { name: `Pin ${name}`, exact: true });
const guideLink = (scope: Page | Locator, name: string) => scope.getByRole("link", { name: new RegExp(`^${name}( \\(gave reasons\\))?$`) });

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
    await expect(fifth).toHaveAttribute("title", "You can pin up to 4 guides");
    await expect(fifth).toHaveClass(/\bopacity-60\b/);
    const described = (await fifth.getAttribute("aria-describedby"))!.split(" ").map((id) => `[id="${id}"]`).join(",");
    await expect(page.locator(described).filter({ hasText: "4 of 4 pinned" })).toHaveClass(/\bsr-only\b/);
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

  test("a chip's pin and name are separate full-size targets: the pin toggles, the name stays a link", async ({ page }, info) => {
    await openContest(page);
    const group = page.getByRole("group", { name: "Guides for Yes" });
    const pin = pinChip(group, "GrowSF");
    const name = guideLink(group, "GrowSF");
    const min = isPhone(info) ? 40 : 36;
    for (const target of [pin, name]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(min);
    }
    expect((await pin.boundingBox())!.width).toBeGreaterThanOrEqual(min);
    await expect(pin.locator("svg")).not.toHaveClass(/\bfill-current\b/);
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await expect(pin.locator("svg")).toHaveClass(/\bfill-current\b/);
    await expect(pin).toHaveClass(/\bbg-foreground\b/);
    await expect(pin).not.toHaveAttribute("title");
    await expect(page).toHaveURL(/\/prop-d\?/);
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "false");
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

  test("a chip's guide page link doesn't prefetch the page, in view or on hover", async ({ page }, info) => {
    test.skip(!CHIP_ONLY, "no measure has a Yes guide without a quote in today's data");
    const href = `/guides/${CHIP_ONLY!.guide}`;
    const fetched: string[] = [];
    page.on("request", (r) => fetched.push(new URL(r.url()).pathname));
    await page.goto(`${BALLOT}/${CHIP_ONLY!.contest}`);
    await waitForKeys(page);
    const group = page.getByRole("group", { name: "Guides for Yes" });
    await expandChips(group);
    const chip = group.locator(`a[href="${href}"]`);
    await expect(chip).toHaveCount(1);
    // The chip is the guide's only link on the page, so no other link can prefetch it.
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
    await page.waitForLoadState("networkidle");
    expect(fetched).not.toContain(href);
    if (isPhone(info)) return;
    await chip.hover();
    await page.waitForLoadState("networkidle");
    expect(fetched).not.toContain(href);
  });

  test("each chip's name links to its guide page, and there is no separate Guide pages list", async ({ page }) => {
    await openContest(page);
    const group = page.getByRole("group", { name: "Guides for Yes" });
    await expect(page.getByRole("button", { name: /^Guide pages/ })).toHaveCount(0);
    const links = group.getByRole("link");
    const pins = group.getByRole("button", { name: /^Pin / });
    expect(await links.count()).toBeGreaterThan(0);
    await expect(links).toHaveCount(await pins.count());
    const growsf = guideLink(group, "GrowSF");
    await expect(growsf).toHaveAttribute("href", "/guides/growsf");
    await growsf.click();
    await expect(page).toHaveURL(/\/guides\/growsf$/);
  });

  test("Your guides names link to their guide pages", async ({ page }, info) => {
    await openContest(page, "?pin=spur");
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("link", { name: "SPUR", exact: true })).toHaveAttribute("href", "/guides/spur");
  });

  test("chips have no hover tooltip, and no-pick chips never have the quote mark", async ({ page }, info) => {
    await openContest(page);
    await expect(page.getByText(/means the guide explained its pick/)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Guides with no pick" }).getByRole("link", { name: /\(gave reasons\)$/ })).toHaveCount(0);
    if (isPhone(info)) return;
    const chip = page.getByRole("group", { name: "Guides for Yes" }).getByRole("link", { name: /\(gave reasons\)$/ }).first();
    await chip.hover();
    await expect(page.getByText(/Gave reasons on this contest|Opens its guide page/)).toHaveCount(0);
  });

  test("the first side starts at the top of the guides block, with no gap from the hidden pin line", async ({ page }) => {
    await openContest(page);
    const side = page.getByRole("heading", { level: 3, name: /^Yes\s*\d/ }).first().locator("xpath=ancestor::section[1]");
    const gap = await side.evaluate((s) => s.getBoundingClientRect().top - s.parentElement!.parentElement!.previousElementSibling!.getBoundingClientRect().bottom);
    expect(gap).toBeLessThanOrEqual(33);
  });

  test("an only= link counts just its guides, and Reset then Close leaves no filter in the URL", async ({ page }, info) => {
    await openContest(page, "?only=growsf,sf-chronicle");
    const counted = page.getByText(/\d+ of \d+ guides counted/).filter({ visible: true }).first();
    await expect(counted).toContainText(/^.*\b2 of \d+ guides counted/);
    const panel = await filterPanel(page, info);
    await panel.getByRole("button", { name: "Reset filters" }).click();
    // Close steps back in history; the reset query is re-applied on the popstate after it.
    const popped = isPhone(info)
      ? page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              addEventListener("popstate", () => setTimeout(resolve, 0), { once: true });
              setTimeout(() => reject(new Error("no popstate after Close")), 5000);
            }),
        )
      : null;
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

  test("a short-named chip's name and pin both carry the full name, and Escape on a focused chip closes the pane", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const pane = page.getByRole("region", { name: "Proposition D" });
    const chip = guideLink(pane, "SF Chronicle");
    await expect(chip).toHaveAccessibleDescription("San Francisco Chronicle");
    await expect(pinChip(pane, "SF Chronicle")).toHaveAccessibleDescription("San Francisco Chronicle");
    await expect(pinChip(pane, "SF Chronicle")).not.toHaveAttribute("title");
    await expect(chip).not.toHaveAttribute("title");
    await chip.focus();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]c=prop-d/);
  });

  test("a short-named pin at the limit is described by its full name and the limit", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d&pin=growsf,sf-dems,league-pissed-off-voters,spur`);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await expandChips(pane);
    const pin = pinChip(pane, "SF Chronicle");
    await expect(pin).toHaveAttribute("aria-disabled", "true");
    await expect(pin).toHaveAccessibleDescription("San Francisco Chronicle 4 of 4 pinned. Unpin one to pin another.");
  });

  test("Escape with the mouse over a chip and focus elsewhere closes the pane", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(`${SF}?c=prop-d`);
    await waitForKeys(page);
    const pane = page.getByRole("region", { name: "Proposition D" });
    await pane.getByRole("link", { name: /official measures page/ }).focus();
    await guideLink(pane, "SF Chronicle").hover();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]c=prop-d/);
  });

  test("in the sheet, Escape on a focused chip closes the sheet", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(SF);
    await waitForKeys(page);
    await contestRow(page, "Proposition D").click();
    const sheet = page.getByRole("dialog", { name: "Proposition D" });
    await expect(sheet).toBeVisible();
    await guideLink(sheet, "SF Chronicle").focus();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
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
