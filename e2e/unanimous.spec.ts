import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, isPhone, openBallot, watchErrors } from "./helpers";

const TITLE = "Assessor-Recorder";
const ID = "assessor";
const COUNT = /Unanimous · (\d+) of \1 guides/;

test("a unanimous race says so and fills its bar in the candidate's color", async ({ page }, info) => {
  const errors = watchErrors(page);
  await openBallot(page);
  const row = page.locator(`div:has(> h4 #row-${isPhone(info) ? "m" : "d"}-${ID})`);
  const bar = row.getByRole("img", { name: /^Assessor-Recorder: Joaquín Torres, unanimous, (\d+) of \1 guides$/ });
  await expect(bar).toBeVisible();
  await expect(bar.locator("span").first()).toHaveClass(/bg-bar-\d/);
  if (isPhone(info)) {
    await expect(row.getByText("Torres", { exact: true })).toBeVisible();
    await expect(row.getByText("Unanimous", { exact: true })).toBeVisible();
  } else {
    await expect(row.getByText("Joaquín Torres · Unanimous", { exact: true })).toBeVisible();
    await expect(row.getByText(/^(\d+) of \1 guides$/)).toBeVisible();
  }

  await contestRow(page, TITLE).click();
  const detail = isPhone(info) ? page.getByRole("dialog") : page.getByRole("region", { name: TITLE });
  await expect(detail.getByText(COUNT)).toBeVisible();
  await expect(detail.getByRole("img", { name: /unanimous/ }).locator("span").first()).toHaveClass(/bg-bar-\d/);
  expect(errors).toEqual([]);
});

test("a unanimous race's own page says so", async ({ page }) => {
  await page.goto(`${BALLOT}/${ID}`);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText(COUNT)).toBeVisible();
});
