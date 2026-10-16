import { expect, test, type Page } from "@playwright/test";
import { BALLOT, isPhone, watchErrors } from "./helpers";

const chip = (page: Page) => page.getByRole("banner").getByRole("link", { name: /Nov 3|Election day|Polls close|results/i });

test("the header shows the election chip and About, plus Changelog on desktop", async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto("/about");
  const banner = page.getByRole("banner");
  await expect(chip(page)).toHaveText(/^Election day\s+Nov 3\s*· 18 days$/, { useInnerText: true });
  await expect(chip(page)).toHaveAccessibleName(/^Election day\s+Nov 3/);
  const word = (await chip(page).getByText("Election day").boundingBox())!;
  if (isPhone(info)) expect(word.width).toBeLessThanOrEqual(1);
  else expect(word.width).toBeGreaterThan(20);
  await expect(chip(page)).toHaveAttribute("href", "#before-you-vote");
  await expect(banner.getByRole("link", { name: "About" })).toBeVisible();
  const changelog = banner.getByRole("link", { name: "Changelog" });
  if (isPhone(info)) await expect(changelog).toBeHidden();
  else await expect(changelog).toHaveAttribute("href", "/changelog");
  for (const link of await banner.getByRole("link").filter({ visible: true }).all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  }
  await chip(page).click();
  await expect(page).toHaveURL(/#before-you-vote$/);
  await expect(page.getByRole("region", { name: "Before you vote" })).toBeInViewport();
  expect(errors).toEqual([]);
});

test("the chip says 1 day the day before", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-02T23:30:00-08:00"));
  await page.goto("/about");
  await expect(chip(page)).toContainText("· 1 day");
  await expect(chip(page)).not.toContainText("days");
});

test("the chip scrolls to the voting links without breaking Back", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto(BALLOT);
  await expect(chip(page)).toContainText("days");
  const entries = await page.evaluate(() => history.length);
  await chip(page).click();
  await expect(page.getByRole("region", { name: "Before you vote" })).toBeInViewport();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}#before-you-vote$`));
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await page.getByRole("contentinfo").getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}#before-you-vote$`));
  await expect(page.getByRole("heading", { level: 1, name: "About Bay Ballot" })).toHaveCount(0);
});

for (const width of [320, 360]) test(`the header fits a ${width}px screen in every chip state`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 });
  for (const time of ["2026-10-16T12:00:00-07:00", "2026-11-03T09:00:00-08:00", "2026-11-04T09:00:00-08:00"]) {
    await page.clock.setFixedTime(new Date(time));
    await page.goto("/about");
    await expect(chip(page)).toBeVisible();
    if (time.startsWith("2026-11-04")) await expect(chip(page)).toHaveText("Results", { useInnerText: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await expect(page.getByRole("banner").getByRole("link", { name: "Bay Ballot" })).toBeVisible();
});

test("a modified click on the chip keeps the browser's own handling", async ({ page, context }, info) => {
  test.skip(isPhone(info), "no modifier clicks on a phone");
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto("/about");
  await expect(chip(page)).toContainText("days");
  const opened = context.waitForEvent("page");
  await chip(page).click({ modifiers: ["ControlOrMeta"] });
  expect((await opened).url()).toMatch(/\/about#before-you-vote$/);
  await expect(page).toHaveURL(/\/about$/);
});

test("a keyboard press on the chip moves focus to the voting links", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto("/about");
  await expect(chip(page)).toContainText("days");
  await chip(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /^Register to vote/ })).toBeFocused();
});

test("the chip's hash write lets the router take the new URL", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { replaceCalls: string[] }).replaceCalls = calls;
    const original = history.replaceState.bind(history);
    history.replaceState = (data, unused, url) => {
      calls.push(String(url ?? ""));
      original(data, unused, url);
    };
  });
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto(BALLOT);
  await expect(chip(page)).toContainText("days");
  await chip(page).click();
  await expect(page).toHaveURL(new RegExp(`${BALLOT}#before-you-vote$`));
  await expect.poll(() => page.evaluate(() => (window as unknown as { replaceCalls: string[] }).replaceCalls.filter((u) => u.endsWith(`${location.pathname}#before-you-vote`)).length)).toBeGreaterThan(0);
});

test("an open tab's chip turns over at Pacific midnight", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T23:59:00-08:00") });
  await page.goto("/about");
  await expect(chip(page)).toContainText("· 1 day");
  await page.clock.runFor("02:00");
  await expect(chip(page)).toContainText("polls close 8 pm", { ignoreCase: true });
});

test("on election day the chip says polls close at 8 pm", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date("2026-11-03T00:30:00-08:00"));
  await page.goto("/about");
  await expect(chip(page)).toHaveText(isPhone(info) ? "Polls close 8 pm" : "Election day · polls close 8 pm", { useInnerText: true });
  await expect(chip(page)).toHaveAttribute("href", "#before-you-vote");
});

test("after election day the chip links to results", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T00:30:00-08:00"));
  await page.goto("/about");
  const results = page.getByRole("banner").getByRole("link", { name: "Election results" });
  await expect(results).toHaveAttribute("href", "https://www.sos.ca.gov/elections");
  await expect(results).toHaveAttribute("target", "_blank");
});

test("the footer leads with official voting links, then site and corrections links", async ({ page }) => {
  await page.goto("/about");
  const footer = page.getByRole("contentinfo");
  const vote = footer.getByRole("region", { name: "Before you vote" });
  const [v, n] = [(await vote.boundingBox())!, (await footer.getByRole("navigation", { name: "Footer" }).boundingBox())!];
  expect(v.y < n.y || (v.y < n.y + 1 && v.x < n.x)).toBe(true);
  for (const [name, href] of [
    ["Register to vote", "https://registertovote.ca.gov/"],
    ["Check your registration", "https://voterstatus.sos.ca.gov/"],
    ["Find where to vote", "https://caearlyvoting.sos.ca.gov/"],
  ]) {
    const link = vote.getByRole("link", { name: new RegExp(`^${name}`) });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  const site = footer.getByRole("navigation", { name: "Footer" });
  await expect(site.getByRole("link", { name: "Ballot" })).toHaveAttribute("href", BALLOT);
  await expect(site.getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "/changelog");
  await expect(site.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  await expect(footer.getByRole("link", { name: "corrections@bayballot.com" })).toHaveAttribute("href", "mailto:corrections@bayballot.com");
  await expect(footer.getByRole("link", { name: "Open an issue" })).toHaveAttribute(
    "href",
    "https://github.com/seanoliver/bay-ballot/issues/new?template=data-correction.yml",
  );
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the chip shows the date with no count", async ({ page }) => {
    await page.goto("/about");
    await expect(chip(page)).toHaveText(/^Election day\s+Nov 3$/, { useInnerText: true });
    await expect(chip(page)).toHaveAttribute("href", "#before-you-vote");
  });
});
