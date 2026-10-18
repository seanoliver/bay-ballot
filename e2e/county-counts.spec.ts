import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { inArea } from "../src/lib/areas";
import { loadElection } from "../src/lib/data";
import { BALLOT, contestRow, isPhone } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const ID = "supreme-court-groban";
const TITLE = data.ballot.contests.find((c) => c.id === ID)!.title;
const published = Object.values(data.endorsements).filter((e) => e.status === "published");
const picks = published.filter((e) => e.picks[ID]);
const yes = picks.filter((e) => e.picks[ID].pick === "Y").length;
const no = picks.length - yes;
const guide = (id: string) => data.guides.find((g) => g.id === id)!;
const pin = (id: string) => `Pin ${guide(id).shortName ?? guide(id).name}`;
const tagged = (id: string, ...areas: string[]) => guide(id).areas.some((a) => areas.includes(a));
const pickers = (pick: string) => picks.filter((e) => e.picks[ID].pick === pick).map((e) => e.guide);

// The guides an area's list counts as its own: Alameda's, or for a city, the city's and its county's.
const ALAMEDA = ["alameda-county"];
const PALO_ALTO = ["palo-alto", "santa-clara-county"];

const pane = (page: Page) => page.locator("section[aria-labelledby='detail-title']");
const pinNames = (scope: Locator) => scope.getByRole("button", { name: /^Pin / }).evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")!));
/** Every pin in a group, after opening its "+N more". */
async function allPins(group: Locator) {
  const more = group.getByRole("button", { name: /^\+\d+ more$/ });
  if (await more.count()) await more.click();
  return pinNames(group);
}
/** `names`, with the guides tagged for `areas` moved ahead of the rest, each part keeping its order. */
const localFirst = (names: string[], ids: string[], areas: string[]) => {
  const local = new Set(ids.filter((id) => tagged(id, ...areas)).map(pin));
  return [...names.filter((n) => local.has(n)), ...names.filter((n) => !local.has(n))];
};

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
    const noIds = pickers("N");
    await page.goto(`${BALLOT}?c=${ID}`);
    await expect(pane(page).getByRole("group", { name: "Guides for No" })).toBeVisible();
    const bay = await allPins(pane(page).getByRole("group", { name: "Guides for No" }));
    expect([...bay].sort()).toEqual(noIds.map(pin).sort());
    const alameda = localFirst(bay, noIds, ALAMEDA);
    // Otherwise the Bay Area already lists Alameda's guides first, and this test can't see the Alameda pane reorder them.
    expect(alameda, "the Bay Area's No order already puts Alameda's guides first").not.toEqual(bay);

    const skippers = published.filter((e) => !e.picks[ID]).map((e) => e.guide).sort();
    const covering = skippers.find((id) => tagged(id, ...ALAMEDA));
    const onList = (id: string) => data.ballot.contests.some((c) => data.endorsements[id].picks[c.id] && inArea(c, data.areas.find((a) => a.id === "alameda-county")!));
    // Prefer an outside guide the Alameda list counts elsewhere, so only the covering rule keeps it out of No pick.
    const outside = skippers.find((id) => !tagged(id, ...ALAMEDA) && onList(id)) ?? skippers.find((id) => !tagged(id, ...ALAMEDA));
    expect(covering).toBeDefined();
    expect(outside).toBeDefined();

    await page.goto(`${BALLOT}/alameda-county?c=${ID}`);
    await expect(pane(page).getByRole("group", { name: "Guides for No" })).toBeVisible();
    expect(await allPins(pane(page).getByRole("group", { name: "Guides for No" }))).toEqual(alameda);
    const skipped = await allPins(pane(page).getByRole("group", { name: "Guides with no pick" }));
    expect(skipped).toContain(pin(covering!));
    expect(skipped).not.toContain(pin(outside!));
  });

  test("the Alameda phone sheet lists Alameda's guides first within a pick", async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    const noIds = pickers("N");
    expect(noIds.some((id) => tagged(id, ...ALAMEDA)) && noIds.some((id) => !tagged(id, ...ALAMEDA))).toBe(true);
    await page.goto(`${BALLOT}/alameda-county`);
    await contestRow(page, TITLE).tap();
    const sheet = page.getByRole("dialog", { name: TITLE });
    await expect(sheet.getByRole("group", { name: "Guides for No" })).toBeVisible();
    const names = await allPins(sheet.getByRole("group", { name: "Guides for No" }));
    expect(names).toEqual(localFirst(names, noIds, ALAMEDA));
  });

  // Palo Alto, not Oakland: every guide picking this race that covers Alameda County also covers Oakland, so Oakland
  // can't tell a county guide from a city one. The SF Chronicle covers Santa Clara County but not Palo Alto.
  test("a city list lists its county's guides first within a pick", async ({ page }, info) => {
    const yesIds = pickers("Y");
    const countyOnly = yesIds.filter((id) => tagged(id, "santa-clara-county") && !tagged(id, "palo-alto"));
    expect(countyOnly.length).toBeGreaterThan(0);
    expect(yesIds.some((id) => !tagged(id, ...PALO_ALTO))).toBe(true);
    let group: Locator;
    if (isPhone(info)) {
      await page.goto(`${BALLOT}/palo-alto`);
      await contestRow(page, TITLE).tap();
      group = page.getByRole("dialog", { name: TITLE }).getByRole("group", { name: "Guides for Yes" });
    } else {
      await page.goto(`${BALLOT}/palo-alto?c=${ID}`);
      group = pane(page).getByRole("group", { name: "Guides for Yes" });
    }
    await expect(group).toBeVisible();
    const names = await allPins(group);
    expect([...names].sort()).toEqual(yesIds.map(pin).sort());
    expect(names).toEqual(localFirst(names, yesIds, PALO_ALTO));
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
