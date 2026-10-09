import fs from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { parse } from "yaml";

export const BALLOT = "/2026-11";
export const isPhone = (info: TestInfo) => info.project.name === "phone";

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

export async function openBallot(page: Page, query = "") {
  await page.goto(`${BALLOT}${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Bay Area ballot" })).toBeVisible();
}

// Each row has a phone and a desktop link; take the visible one.
export function contestRow(page: Page, title: string) {
  return page.getByRole("link", { name: title, exact: true }).filter({ visible: true }).first();
}

/** Ids of the published guides with a pick on a contest, read from the data so tests survive a refresh. */
export function guidesOn(contestId: string, election = "2026-11"): string[] {
  const dir = path.join(process.cwd(), "data", election, "endorsements");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((d) => d.status === "published" && d.picks?.[contestId])
    .map((d) => d.guide as string)
    .sort();
}
