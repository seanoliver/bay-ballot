import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { BALLOT, contestRow, isPhone } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const ID = "supreme-court-groban";
const TITLE = data.ballot.contests.find((c) => c.id === ID)!.title;
const picks = Object.values(data.endorsements).filter((e) => e.status === "published" && e.picks[ID]);
const yes = picks.filter((e) => e.picks[ID].pick === "Y").length;
const no = picks.length - yes;
const short = (id: string) => {
  const g = data.guides.find((x) => x.id === id)!;
  return g.shortName ?? g.name;
};

const pane = (page: Page) => page.locator("section[aria-labelledby='detail-title']");
const pinNames = (scope: Locator) => scope.getByRole("button", { name: /^Pin / }).evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));

test.describe("county pages count every guide", () => {
  test("a statewide race reads the same on the Alameda list, its pane and the contest page", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    expect(no).toBeGreaterThan(0);
    const verdict = `Yes ${Math.round((yes / picks.length) * 100)}%`;
    await page.goto(`${BALLOT}/alameda-county`);
    await expect(contestRow(page, TITLE)).toBeVisible();
    await expect(page.getByRole("img", { name: `${TITLE}: ${yes} Yes, ${no} No` }).filter({ visible: true })).toHaveCount(1);
    await contestRow(page, TITLE).click();
    await expect(pane(page).getByText(verdict, { exact: true })).toBeVisible();
    await expect(pane(page).getByText(`${picks.length} guides`, { exact: true })).toBeVisible();
    await page.goto(`${BALLOT}/${ID}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByText(verdict, { exact: true })).toBeVisible();
    await expect(page.getByText(`${picks.length} guides`, { exact: true })).toBeVisible();
  });

  test("the Alameda pane lists Alameda's guides first within a pick, and No pick only from guides covering it", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    const local = `Pin ${short("reform-california")}`;
    const other = `Pin ${short("contra-costa-gop")}`;
    await page.goto(`${BALLOT}/alameda-county?c=${ID}`);
    await expect(pane(page).getByRole("group", { name: "Guides for No" })).toBeVisible();
    expect(await pinNames(pane(page).getByRole("group", { name: "Guides for No" }))).toEqual([local, other]);
    const noPick = pane(page).getByRole("group", { name: "Guides with no pick" });
    const more = noPick.getByRole("button", { name: /^\+\d+ more$/ });
    if (await more.count()) await more.click();
    const skipped = await pinNames(noPick);
    expect(skipped).toContain(`Pin ${short("acdp")}`);
    expect(skipped).not.toContain(`Pin ${short("sf-dems")}`);
    await page.goto(`${BALLOT}?c=${ID}`);
    await expect(pane(page).getByRole("group", { name: "Guides for No" })).toBeVisible();
    expect(await pinNames(pane(page).getByRole("group", { name: "Guides for No" }))).toEqual([other, local]);
  });

  test("the Alameda phone sheet lists Alameda's guides first within a pick", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(`${BALLOT}/alameda-county`);
    await contestRow(page, TITLE).tap();
    const sheet = page.getByRole("dialog", { name: TITLE });
    await expect(sheet.getByRole("group", { name: "Guides for No" })).toBeVisible();
    expect(await pinNames(sheet.getByRole("group", { name: "Guides for No" }))).toEqual([`Pin ${short("reform-california")}`, `Pin ${short("contra-costa-gop")}`]);
  });
});

test.describe("a city contest on its county list", () => {
  const J = "palo-alto-measure-j";
  const J_TITLE = data.ballot.contests.find((c) => c.id === J)!.title;
  // The contest page names guides in full and a list by short name, so compare ids.
  const byLabel = new Map(data.guides.flatMap((g) => [`Pin ${g.name}`, `Pin ${g.shortName ?? g.name}`].map((l) => [l, g.id] as const)));
  const yesOn = (scope: Locator | Page) => scope.getByRole("group", { name: "Guides for Yes" });
  const pinIds = async (scope: Locator) => (await pinNames(scope)).map((l) => byLabel.get(l!));
  const pageOrder = async (page: Page) => {
    await page.goto(`${BALLOT}/${J}`);
    await expect(yesOn(page)).toBeVisible();
    const ids = await pinIds(yesOn(page));
    expect(ids).not.toContain(undefined);
    return ids;
  };

  test("the Santa Clara pane lists Measure J's guides in its contest page's order", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    const order = await pageOrder(page);
    await page.goto(`${BALLOT}/santa-clara-county?c=${J}`);
    await expect(yesOn(pane(page))).toBeVisible();
    expect(await pinIds(yesOn(pane(page)))).toEqual(order);
  });

  test("the Santa Clara phone sheet lists Measure J's guides in its contest page's order", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    const order = await pageOrder(page);
    await page.goto(`${BALLOT}/santa-clara-county`);
    await contestRow(page, J_TITLE).tap();
    const sheet = page.getByRole("dialog", { name: J_TITLE });
    await expect(yesOn(sheet)).toBeVisible();
    expect(await pinIds(yesOn(sheet))).toEqual(order);
  });
});
