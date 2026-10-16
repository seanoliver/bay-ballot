import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { areaGuides } from "../src/lib/areas";
import { readChangelog } from "../src/lib/changelog";
import { changelogDays, dataSummary, rowInArea } from "../src/lib/changelog-digest";
import { loadElection } from "../src/lib/data";
import { monthDay } from "../src/lib/display";
import { watchErrors } from "./helpers";

const root = path.join(process.cwd(), "data");
const data = loadElection(root, "2026-11");
const days = changelogDays(readChangelog(root).entries, data.guides);
const dataDays = days.filter((d) => d.data.length > 0);
const allRows = dataDays.flatMap((d) => d.data);

const summaries = (page: Page) => page.locator("main button[aria-expanded]");
const rows = (page: Page) => page.getByRole("list", { name: /^Data updates/ }).getByRole("listitem");
const show = (page: Page, name: string) => page.getByRole("group", { name: "Show" }).getByRole("button", { name, exact: true });

test("the changelog shows one block per day with each day's data updates folded", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/changelog");
  const headings = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(headings).toHaveText(days.map((d) => monthDay(d.date)));
  await expect(summaries(page)).toHaveCount(dataDays.length);
  for (const b of await summaries(page).all()) await expect(b).toHaveAttribute("aria-expanded", "false");
  await expect(rows(page)).toHaveCount(0);
  await expect(show(page, "All")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Pull request #1 (opens in new tab)" })).toHaveAttribute("href", "https://github.com/seanoliver/bay-ballot/pull/1");
  await expect(page.getByLabel("Area")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a day's summary expands in place to one row per update", async ({ page }) => {
  await page.goto("/changelog");
  const [day] = dataDays;
  const button = page.getByRole("button", { name: dataSummary(day.data) }).first();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(rows(page)).toHaveCount(day.data.length);
  const named = day.data.find((r) => r.name);
  if (named) await expect(rows(page).filter({ hasText: named.text }).first().locator(".font-semibold")).toHaveText(named.name!);
  await expect(page.getByLabel("Area")).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(rows(page)).toHaveCount(0);
});

test("Site hides data updates and Data shows only them, every day expanded", async ({ page }) => {
  await page.goto("/changelog");
  await show(page, "Site").click();
  await expect(show(page, "Site")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?show=site$/);
  await expect(summaries(page)).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(days.filter((d) => d.site.length > 0).length);

  await show(page, "Data").click();
  await expect(page).toHaveURL(/\?show=data$/);
  await expect(summaries(page)).toHaveCount(0);
  await expect(rows(page)).toHaveCount(allRows.length);
  const withPr = allRows.filter((r) => r.pr);
  await expect(page.getByRole("link", { name: /^Pull request/ })).toHaveCount(withPr.length);
  const withDetails = allRows.find((r) => r.details);
  if (withDetails) await expect(rows(page).filter({ hasText: withDetails.details! })).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "The Mercury News and East Bay Times editorial boards recommend No on Prop 44" })).toHaveCount(1);

  await show(page, "All").click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(summaries(page)).toHaveCount(dataDays.length);
});

test("the area filter narrows data rows to guides that cover the area, and survives a reload", async ({ page }) => {
  const area = data.areas.find((a) => a.id === "marin")!;
  const covered = new Set(areaGuides(data.guides, area).map((g) => g.id));
  const expected = allRows.filter((r) => rowInArea(r, covered)).length;
  expect(expected).toBeGreaterThan(0);
  expect(expected).toBeLessThan(allRows.length);

  await page.goto("/changelog?show=data");
  await expect(rows(page)).toHaveCount(allRows.length);
  await page.getByLabel("Area").selectOption({ label: area.name });
  await expect(page).toHaveURL(/\?show=data&area=marin$/);
  await expect(rows(page)).toHaveCount(expected);

  await page.reload();
  await expect(page.getByLabel("Area")).toHaveValue("marin");
  await expect(rows(page)).toHaveCount(expected);

  await page.getByLabel("Area").selectOption({ label: "All areas" });
  await expect(page).toHaveURL(/\?show=data$/);
  await expect(rows(page)).toHaveCount(allRows.length);
  await page.getByLabel("Area").selectOption({ label: area.name });
  await show(page, "Site").click();
  await expect(page).toHaveURL(/\?show=site$/);
  await expect(page.getByLabel("Area")).toHaveCount(0);
  await show(page, "Data").click();
  await expect(page.getByLabel("Area")).toHaveValue("");
  await expect(rows(page)).toHaveCount(allRows.length);
});
