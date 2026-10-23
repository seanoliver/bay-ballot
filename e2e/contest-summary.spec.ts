import path from "node:path";
import { expect, test } from "@playwright/test";
import { loadElection } from "../src/lib/data";
import { BALLOT } from "./helpers";

const data = loadElection(path.join(process.cwd(), "data"), "2026-11");
const contest = (id: string) => data.ballot.contests.find((c) => c.id === id)!;

test("a state proposition shows its official summary and what a Yes and a No vote mean", async ({ page }) => {
  const prop = contest("prop-40");
  await page.goto(`${BALLOT}/prop-40`);
  const card = page.locator("main section:has(h1)");
  await expect(card.getByText(prop.summary!.text, { exact: true })).toBeVisible();
  await expect(card.getByText(prop.description!, { exact: true })).toHaveCount(0);
  const terms = card.locator("dl dt");
  await expect(terms).toHaveText(["Yes means", "No means"]);
  await expect(card.locator("dl dd")).toHaveText([prop.summary!.yes, prop.summary!.no]);
});

test("a measure without a summary keeps its ballot label", async ({ page }) => {
  const local = data.ballot.contests.find((c) => c.kind === "measure" && !c.summary && c.description)!;
  await page.goto(`${BALLOT}/${local.id}`);
  const card = page.locator("main section:has(h1)");
  await expect(card.getByText(local.description!, { exact: true })).toBeVisible();
  await expect(card.locator("dl")).toHaveCount(0);
});
