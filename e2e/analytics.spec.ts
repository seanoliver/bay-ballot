import path from "node:path";
import { expect, test } from "@playwright/test";
import { BALLOT, isPhone, waitForKeys, watchErrors } from "./helpers";

const HOST = "bb.test";
const PORT = Number(process.env.PORT ?? 3200);
const PRIVATE = ["zip", "addr", "94110", "Main"];

test.use({ launchOptions: { args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] } });

test("every route sends a strict-origin referrer policy header", async ({ request }) => {
  for (const url of ["/", BALLOT, `${BALLOT}/sf`, "/about"]) {
    const res = await request.get(url);
    expect(res.headers()["referrer-policy"], url).toBe("strict-origin");
  }
});

test.describe("Ahrefs", () => {
  test.use({ baseURL: `http://${HOST}:${PORT}` });

  test("never sees the address or ZIP, and Back and Forward still work", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), "one viewport is enough for the wiring");
    const errors = watchErrors(page);
    const events: string[] = [];
    await page.addInitScript(() => {
      window.__web_analytics = true;
      window.__bbTestAhrefs = true;
    });
    await page.route("https://analytics.ahrefs.com/analytics.js", (route) =>
      route.fulfill({
        path: path.join(process.cwd(), "e2e", "fixtures", "ahrefs-analytics.js"),
        contentType: "text/javascript",
      }),
    );
    await page.route("https://analytics.ahrefs.com/api/**", (route) => {
      events.push(route.request().postData() ?? "");
      return route.fulfill({ status: 202, body: "" });
    });
    const sent = () => events.map((e) => JSON.parse(e) as { n: string; u: string; p?: string });

    await page.goto(`${BALLOT}?zip=94110&addr=1+Main&off=x`);
    await expect(page.locator("#ahrefs-analytics")).toHaveAttribute("data-no-pageview-auto", "");
    await expect.poll(() => sent().filter((e) => e.n === "pageview").length).toBeGreaterThan(0);
    await expect(page).not.toHaveURL(/zip|addr/);
    expect(new URL(page.url()).searchParams.get("off")).toBe("x");
    expect(await page.evaluate(() => window.history.state?.__NA)).toBe(true);

    await waitForKeys(page);
    await page.locator("[data-section-nav]").getByRole("button").click();
    await page
      .getByRole("menu")
      .getByRole("menuitem", { name: /^Judicial/ })
      .click();
    await expect(page.locator("#section-state-judicial")).toBeFocused();
    await expect.poll(() => sent().filter((e) => e.n === "x-link-click").length).toBeGreaterThan(0);

    await page.getByRole("navigation", { name: "Area" }).getByRole("link", { name: "San Francisco" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();
    await expect.poll(() => sent().filter((e) => e.n === "pageview" && new URL(e.u).pathname === `${BALLOT}/sf`).length).toBe(1);

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
    await expect(page).not.toHaveURL(/zip|addr/);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: "San Francisco ballot" })).toBeVisible();

    for (const e of events) for (const word of PRIVATE) expect(e, e).not.toContain(word);
    expect(errors).toEqual([]);
  });
});

declare global {
  interface Window {
    __web_analytics?: boolean;
  }
}
