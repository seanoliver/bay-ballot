import { expect, test, type Page } from "@playwright/test";
import { BALLOT, isPhone, watchErrors } from "./helpers";

const chip = (page: Page) => page.getByRole("banner").getByRole("link", { name: /Nov 3|Election day|Polls close|results/i });

test("the header shows the election chip, About, and Changelog on desktop", async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(new Date("2026-10-16T12:00:00-07:00"));
  await page.goto("/about");
  const banner = page.getByRole("banner");
  await expect(chip(page)).toHaveText(isPhone(info) ? /^Nov 3\s*· 18 days$/ : /^Election day\s+Nov 3\s*· 18 days$/, { useInnerText: true });
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
