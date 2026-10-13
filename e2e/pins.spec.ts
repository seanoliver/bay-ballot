import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { parse } from "yaml";
import { BALLOT, contestRow, guideOff, isPhone, watchErrors } from "./helpers";

const SF = `${BALLOT}/sf`;
// The pin list as the URL carries it, its commas typed or encoded.
const pinParam = (...ids: string[]) => new RegExp(`[?&]pin=${ids.join("(,|%2C)")}(&|$)`);

function pickOf(guide: string, contest: string): string {
  const d = parse(fs.readFileSync(path.join(process.cwd(), "data", "2026-11", "endorsements", `${guide}.yml`), "utf8"));
  const pick = d.picks[contest].pick;
  return pick === "Y" ? "Yes" : pick === "N" ? "No" : "";
}

async function filterPanel(page: Page, info: TestInfo) {
  if (!isPhone(info)) return page.getByRole("complementary", { name: "Filters" });
  await page.getByRole("button", { name: /^Filters/ }).click();
  return page.getByRole("dialog", { name: "Filters" });
}

async function closePanel(page: Page, info: TestInfo) {
  if (isPhone(info)) await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Close" }).click();
}

// The visible pinned-guides list in a contest's row.
function pinnedIn(page: Page, title: string) {
  return page.locator("li").filter({ has: contestRow(page, title) }).getByRole("list", { name: "Your guides' picks" }).filter({ visible: true });
}

async function pin(page: Page, info: TestInfo, search: string, name: string) {
  const panel = await filterPanel(page, info);
  await panel.getByRole("searchbox", { name: "Search guides" }).fill(search);
  await panel.getByRole("button", { name: `Pin ${name}` }).click();
  await closePanel(page, info);
}

test.describe("pinned guides", () => {
  test("pinning guides shows their picks on each row, in pin order, and keeps them in the URL", async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.goto(SF);
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    await pin(page, info, "SPUR", "SPUR");
    await pin(page, info, "Chronicle", "SF Chronicle");
    await expect(page).toHaveURL(pinParam("spur", "sf-chronicle"));
    const chips = pinnedIn(page, "Proposition B").getByRole("listitem");
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toHaveText(new RegExp(`^SPUR:\\s*${pickOf("spur", "prop-b")}$`));
    await expect(chips.nth(1)).toHaveText(new RegExp(`^SF Chronicle:\\s*${pickOf("sf-chronicle", "prop-b")}$`));
    await expect(contestRow(page, "Proposition B")).toHaveAttribute("href", pinParam("spur", "sf-chronicle"));

    await page.reload();
    await expect(pinnedIn(page, "Proposition B").getByRole("listitem")).toHaveCount(2);
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveText(["SPUR", "SF Chronicle"]);
    await panel.getByRole("button", { name: "Unpin SPUR" }).click();
    await closePanel(page, info);
    await expect(pinnedIn(page, "Proposition B").getByRole("listitem")).toHaveText([new RegExp(`^SF Chronicle`)]);
    await expect(page).toHaveURL(pinParam("sf-chronicle"));
    expect(errors).toEqual([]);
  });

  for (const shared of ["off=sf-gop", "why=1"])
    test(`a link with only ${shared.split("=")[0]}= keeps the saved pins through the next filter change`, async ({ page }, info) => {
      await page.goto(SF);
      await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
      await pin(page, info, "SPUR", "SPUR");
      await expect(page).toHaveURL(pinParam("spur"));

      await page.goto(`${SF}?${shared}`);
      await expect(pinnedIn(page, "Proposition B").getByRole("listitem")).toHaveText([/^SPUR/]);
      const panel = await filterPanel(page, info);
      await panel.getByRole("checkbox", { name: /Only guides that explain/ }).click();
      await closePanel(page, info);
      await expect(page).toHaveURL(pinParam("spur"));
      await page.goto(SF);
      await expect(pinnedIn(page, "Proposition B").getByRole("listitem")).toHaveText([/^SPUR/]);
    });

  test("a fifth guide can't be pinned, and Reset filters keeps the pins", async ({ page }, info) => {
    await page.goto(`${SF}?pin=spur,sf-chronicle,growsf,sf-dems&why=1`);
    const panel = await filterPanel(page, info);
    await panel.getByRole("searchbox", { name: "Search guides" }).fill("Pissed");
    const fifth = panel.getByRole("button", { name: "Pin Pissed Off Voters" });
    await expect(fifth).toHaveAttribute("aria-disabled", "true");
    await fifth.click({ force: true });
    await expect(page).toHaveURL(pinParam("spur", "sf-chronicle", "growsf", "sf-dems"));
    await panel.getByRole("button", { name: "Reset filters" }).click();
    await expect(page).not.toHaveURL(/why=1/);
    await expect(page).toHaveURL(pinParam("spur", "sf-chronicle", "growsf", "sf-dems"));
  });

  test("a ranked pick is numbered only as far as the guide ranked, and chips stay inside the row", async ({ page }) => {
    await page.goto(`${SF}?pin=uesf,league-pissed-off-voters`);
    const row = page.locator("li").filter({ has: contestRow(page, "Board of Supervisors, District 10") });
    const chips = pinnedIn(page, "Board of Supervisors, District 10").getByRole("listitem");
    await expect(chips.first()).toHaveText(/1\. Brookter\s*Eppler\s*Bryant/);
    const box = (await row.boundingBox())!;
    for (const chip of await chips.all()) {
      const b = (await chip.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(box.x);
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
  });

  test("unpinning moves focus to the next pin, then to the hint", async ({ page }, info) => {
    await page.goto(`${SF}?pin=spur,sf-chronicle`);
    const panel = await filterPanel(page, info);
    await panel.getByRole("button", { name: "Unpin SPUR" }).focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("button", { name: "Unpin SF Chronicle" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel.getByText(/^Tap .* next to a guide below/)).toBeFocused();
  });

  test("a guide pinned in another area is listed as not on this ballot", async ({ page }, info) => {
    await page.goto(`${BALLOT}/oakland?pin=sf-dems`);
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveText(/not on this ballot/);
  });

  test("on a contest page, a pin that skipped the contest isn't called off the ballot", async ({ page }, info) => {
    await page.goto(`${BALLOT}/prop-b?pin=${guideOff("prop-b")}`);
    const panel = await filterPanel(page, info);
    await expect(panel.getByRole("group", { name: "Your guides" }).getByRole("listitem")).toHaveCount(1);
    await expect(panel.getByText(/not on this ballot/)).toHaveCount(0);
  });
});
