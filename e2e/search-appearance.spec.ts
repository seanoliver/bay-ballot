import { expect, test, type Page } from "@playwright/test";
import { BALLOT } from "./helpers";

const jsonLd = (page: Page) =>
  page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? "null")));

type Crumb = { "@type": string; position: number; name: string; item: string };

async function breadcrumbs(page: Page): Promise<Crumb[]> {
  const lists = (await jsonLd(page)).filter((d) => d["@type"] === "BreadcrumbList");
  expect(lists).toHaveLength(1);
  expect(lists[0]["@context"]).toBe("https://schema.org");
  return lists[0].itemListElement;
}

async function expectTrailMatchesPage(page: Page, path: string) {
  const crumbs = await breadcrumbs(page);
  expect(crumbs.map((c) => c.position)).toEqual(crumbs.map((_, i) => i + 1));
  expect(crumbs.every((c) => c["@type"] === "ListItem" && c.item.startsWith("https://bayballot.com/"))).toBe(true);
  const [back, ...rest] = crumbs;
  await expect(page.getByRole("link", { name: back.name, exact: true })).toHaveAttribute("href", new URL(back.item).pathname);
  const last = rest.at(-1)!;
  expect(last.item).toBe(`https://bayballot.com${path}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", last.item);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(last.name);
  return crumbs;
}

test("the home page names the site Bay Ballot in exactly one WebSite block", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`${BALLOT}$`));
  const sites = (await jsonLd(page)).filter((d) => d["@type"] === "WebSite");
  expect(sites).toEqual([{ "@context": "https://schema.org", "@type": "WebSite", name: "Bay Ballot", url: "https://bayballot.com/" }]);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Bay Ballot");
});

test("a contest page's BreadcrumbList is its back link, then the contest", async ({ page }) => {
  await page.goto(`${BALLOT}/prop-d`);
  const crumbs = await expectTrailMatchesPage(page, `${BALLOT}/prop-d`);
  expect(crumbs.map((c) => c.name)).toEqual(["San Francisco ballot", "Proposition D"]);
  expect((await jsonLd(page)).some((d) => d["@type"] === "WebSite")).toBe(false);
});

test("a guide page's BreadcrumbList is its back link, then the guide", async ({ page }) => {
  await page.goto("/guides/sf-chronicle");
  const crumbs = await expectTrailMatchesPage(page, "/guides/sf-chronicle");
  expect(crumbs.map((c) => c.name)).toEqual(["Bay Area ballot", "San Francisco Chronicle"]);
});

test("the robots meta lets Google show large image previews", async ({ page }) => {
  await page.goto(BALLOT);
  const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? ""));
  expect(robots).toHaveLength(1);
  expect(robots[0]).toContain("max-image-preview:large");
  expect(robots[0]).not.toMatch(/noindex|nofollow/);
});

test("an icon link of at least 192px serves a square image that size", async ({ page, request }) => {
  await page.goto(BALLOT);
  const icons = await page.locator('link[rel="icon"]').evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href")!, sizes: e.getAttribute("sizes") ?? "" })));
  const big = icons.filter((i) => /^(\d+)x\1$/.test(i.sizes) && Number(i.sizes.split("x")[0]) >= 192);
  expect(big).toHaveLength(1);
  const res = await request.get(big[0].href);
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toBe("image/png");
  const png = await res.body();
  // PNG header: width and height are big-endian at bytes 16 and 20.
  const size = String(png.readUInt32BE(16));
  expect([size, String(png.readUInt32BE(20))]).toEqual(big[0].sizes.split("x"));
});
