import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { countyPages } from "../src/lib/areas";
import { loadElection } from "../src/lib/data";
import { scopeName } from "../src/lib/fallback";
import { FILTER_SEARCH } from "../src/components/frame";
import { ballotViewProps } from "../src/lib/site-data";
import { BALLOT, isPhone, openBallot, watchErrors } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const area = (page: Page) => page.getByRole("navigation", { name: "Area" });
const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

/** Requests a client-side switch must not make: a document load or a Server Components payload. Prefetches of the header's links don't count. */
function watchNavigations(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    const h = r.headers();
    if (h["next-router-prefetch"]) return;
    if (r.resourceType() === "document" || h["rsc"] || r.url().includes("_rsc=")) seen.push(r.url());
  });
  return seen;
}

// An area page fetches every area's data when idle; a chip switches in place only after that.
async function openArea(page: Page, id: string) {
  const snapshot = page.waitForResponse((r) => new URL(r.url()).pathname === `${BALLOT}/snapshot.json`);
  await page.goto(`${BALLOT}/${id}`);
  await snapshot;
}

// Scrolls and lets the scroll event land, as a visitor's scrolling would before they press Back.
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => new Promise((done) => {
    window.scrollTo(0, y);
    requestAnimationFrame(() => requestAnimationFrame(done));
  }), y);
}

// Clicks the chip without scrolling to it, as a visitor who scrolled up to the chips would.
async function pressChip(page: Page, name: string) {
  await area(page).getByRole("link", { name, exact: true }).evaluate((el: HTMLElement) => el.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
}

test.describe("area switching", () => {
  test("a chip switches areas with no navigation, keeping the page", async ({ page }) => {
    const errors = watchErrors(page);
    await openBallot(page);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    const navigations = watchNavigations(page);
    await area(page).getByRole("link", { name: "Sonoma", exact: true }).click();
    await expect(heading(page, "Sonoma County ballot")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sonoma$`));
    await expect(page).toHaveTitle("Sonoma County endorsements (Nov 2026)");
    await expect(area(page).getByRole("link", { name: "Clear Sonoma" })).toHaveAttribute("aria-current", "page");
    await area(page).getByRole("link", { name: "Clear Sonoma" }).click();
    await expect(heading(page, "Bay Area ballot")).toBeVisible();
    await expect(page).toHaveTitle("Bay Area endorsements (Nov 2026)");
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    expect(navigations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("a chip past the history budget navigates and shows the area its URL names", async ({ page }) => {
    await openBallot(page);
    await page.waitForLoadState("networkidle");
    // 45 switches spend the 90 history calls allowed per 10 s; one synchronous burst, so the window can't roll over.
    await area(page).evaluate((nav) => {
      const chip = (name: string) => [...nav.querySelectorAll("a")].find((a) => a.textContent === name)!;
      for (let i = 0; i < 45; i++) chip(i % 2 ? "San Mateo" : "Sonoma").click();
    });
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sonoma$`));
    await expect(heading(page, "Sonoma County ballot")).toBeVisible();
    const navigations = watchNavigations(page);
    // Lands on the page that was first loaded, whose route Next already has mounted.
    await pressChip(page, "Clear Sonoma");
    await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
    await expect(heading(page, "Bay Area ballot")).toBeVisible();
    await expect(page).toHaveTitle("Bay Area endorsements (Nov 2026)");
    expect(navigations.length).toBeGreaterThan(0);
  });

  test("a returning visitor's redirect keeps its title, and Back from another page returns to it", async ({ page }) => {
    await page.goto("/about");
    await page.evaluate(() => localStorage.setItem("bb-filters", "why=1"));
    await page.goto(BALLOT);
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
    await expect(heading(page, "San Francisco ballot")).toBeVisible();
    await expect(page).toHaveTitle("San Francisco endorsements (Nov 2026)");
    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf$`));
    await expect(heading(page, "San Francisco ballot")).toBeVisible();
  });

  test("the current area's chip adds no history entry", async ({ page }) => {
    await openBallot(page);
    await page.waitForLoadState("networkidle");
    const before = await page.evaluate(() => history.length);
    await pressChip(page, "Bay Area");
    await pressChip(page, "Bay Area");
    expect(await page.evaluate(() => history.length)).toBe(before);
    await expect(heading(page, "Bay Area ballot")).toBeVisible();
  });

  test("an area page switches in place once it has every area's data", async ({ page }) => {
    await openArea(page, "san-jose");
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    const navigations = watchNavigations(page);
    await area(page).getByRole("link", { name: "Santa Clara", exact: true }).click();
    await expect(heading(page, "Santa Clara County ballot")).toBeVisible();
    await area(page).getByRole("link", { name: "Clear Santa Clara" }).click();
    await expect(heading(page, "Bay Area ballot")).toBeVisible();
    await page.goBack();
    await page.goBack();
    await expect(heading(page, "San Jose ballot")).toBeVisible();
    await expect(page).toHaveTitle("San Jose endorsements (Nov 2026)");
    await expect(area(page).getByRole("link", { name: "Santa Clara", exact: true })).toHaveAttribute("data-within", "true");
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    expect(navigations).toEqual([]);
  });

  test("Back and Forward switch areas and restore each one's scroll; a chip leaves scroll alone", async ({ page }) => {
    await openBallot(page);
    await scrollTo(page, 1500);
    await pressChip(page, "Sonoma");
    await expect(heading(page, "Sonoma County ballot")).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
    await scrollTo(page, 700);
    await page.goBack();
    await expect(heading(page, "Bay Area ballot")).toBeAttached();
    await expect(page).toHaveTitle("Bay Area endorsements (Nov 2026)");
    await expect(area(page).getByRole("link", { name: "Bay Area" })).toHaveAttribute("aria-current", "page");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
    await page.goForward();
    await expect(heading(page, "Sonoma County ballot")).toBeAttached();
    await expect(page).toHaveTitle("Sonoma County endorsements (Nov 2026)");
    await expect(area(page).getByRole("link", { name: "Clear Sonoma" })).toHaveAttribute("aria-current", "page");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
  });

  test("the clear button widens in after a switch", async ({ page }) => {
    await openBallot(page);
    await area(page).getByRole("link", { name: "Marin", exact: true }).click();
    const x = area(page).getByRole("link", { name: "Clear Marin" }).locator(".chip-clear");
    const start = await x.evaluate((el) => {
      const [a] = el.getAnimations();
      if (!a) return null;
      a.pause();
      a.currentTime = 0;
      return el.getBoundingClientRect().width;
    });
    expect(start).toBe(0);
  });

  test("a reload after a switch renders that area's page", async ({ page }) => {
    await openBallot(page);
    await area(page).getByRole("link", { name: "Napa", exact: true }).click();
    await expect(heading(page, "Napa County ballot")).toBeVisible();
    await page.reload();
    await expect(heading(page, "Napa County ballot")).toBeVisible();
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bayballot.com${BALLOT}/napa-county`);
  });

  test("an open contest stays open when the new area has it, and closes when it doesn't", async ({ page }, info) => {
    test.skip(isPhone(info), "the details pane is desktop only");
    await openBallot(page, "?c=governor");
    await expect(page.getByRole("region", { name: "Governor" })).toBeVisible();
    await area(page).getByRole("link", { name: "Sonoma", exact: true }).click();
    await expect(heading(page, "Sonoma County ballot")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sonoma\\?c=governor$`));
    await expect(page.getByRole("region", { name: "Governor" })).toBeVisible();

    await openBallot(page, "?c=prop-b");
    await expect(page.getByRole("region", { name: "Proposition B" })).toBeVisible();
    await area(page).getByRole("link", { name: "Sonoma", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sonoma$`));
    await expect(page.getByRole("region", { name: "Proposition B" })).toHaveCount(0);
  });

  test("filters and the filter search survive a switch", async ({ page }, info) => {
    await openBallot(page, "?why=1");
    if (!isPhone(info)) await page.locator(FILTER_SEARCH).fill("press");
    await area(page).getByRole("link", { name: "Sonoma", exact: true }).click();
    await expect(heading(page, "Sonoma County ballot")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BALLOT}/sonoma\\?why=1$`));
    if (!isPhone(info)) await expect(page.locator(FILTER_SEARCH)).toHaveValue("press");
  });

  test("an area's saved section choice applies after a switch", async ({ page }) => {
    const JUDICIAL = "section-state-judicial";
    const chips = countyPages(data.areas);
    const pick = chips.map((a) => ({ a, fb: ballotViewProps(data, { area: a }).fallback?.sections.find((s) => s.id === JUDICIAL) })).find((x) => x.fb);
    test.skip(!pick, "No county falls back on a judicial contest in today's data");
    const { a, fb } = pick!;
    const saved = fb!.initial === "bay" ? "area" : "bay";
    await page.goto("/about");
    await page.evaluate(([k, v]) => localStorage.setItem("bb-scope", `${k}=${v}`), [`${a.id}:${JUDICIAL}`, saved]);
    await openBallot(page);
    const chip = a.jurisdictions.find((j) => j.level === "county")!.name;
    await area(page).getByRole("link", { name: chip, exact: true }).click();
    await expect(heading(page, `${a.name} ballot`)).toBeVisible();
    const sw = page.getByRole("region", { name: "California: Judicial" }).getByRole("group", { name: "Show guides from" }).filter({ visible: true }).first();
    await expect(sw.getByRole("button", { name: saved === "bay" ? "Bay Area" : scopeName(a) })).toHaveAttribute("aria-pressed", "true");
  });

  test("every area drawn in the browser matches its server-rendered page", async ({ page, browser }, info) => {
    test.skip(isPhone(info), "one viewport is enough");
    test.setTimeout(120_000);
    const direct = await browser.newPage({ viewport: page.viewportSize()! });
    const snapshot = async (p: Page) => ({
      title: await p.title(),
      list: await p.locator("[data-keys=list]").innerText(),
      filters: await p.locator("aside[aria-label=Filters]").innerText(),
      hrefs: await p.locator("[data-keys=list] a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href"))),
    });
    await openBallot(page);
    for (const a of data.areas) {
      await page.evaluate((href) => {
        window.history.pushState(null, "", href);
        window.dispatchEvent(new Event("bb-filters-change"));
      }, `${BALLOT}/${a.id}`);
      await expect(heading(page, `${a.name} ballot`)).toBeVisible();
      await expect(page.locator("[aria-busy]")).toHaveCount(0);
      await direct.goto(`${BALLOT}/${a.id}`);
      await expect(heading(direct, `${a.name} ballot`)).toBeVisible();
      expect(await snapshot(page), a.id).toEqual(await snapshot(direct));
    }
    await direct.close();
  });
});
