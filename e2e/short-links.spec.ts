import { expect, test } from "@playwright/test";
import { BALLOT } from "./helpers";

test("short area links go to the area's page for the current election", async ({ page, request }) => {
  const res = await request.get("/marin", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toBe(`${BALLOT}/marin`);

  await page.goto("/marin");
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/marin$`));
  await expect(page.getByRole("heading", { level: 1, name: "Marin County ballot" })).toBeVisible();
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bayballot.com${BALLOT}/marin`);

  await page.goto("/sf?off=sf-gop");
  await expect(page).toHaveURL(new RegExp(`${BALLOT}/sf\\?off=sf-gop$`));
});

test("top-level pages still work next to the short links", async ({ request }) => {
  for (const url of ["/about", "/changelog", "/guides/sf-chronicle", BALLOT]) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
  }
});
