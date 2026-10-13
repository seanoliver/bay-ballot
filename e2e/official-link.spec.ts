import { expect, test } from "@playwright/test";
import { BALLOT, contestRow, isPhone } from "./helpers";

const SF_LIST = "https://www.sf.gov/qualified-ballot-measures";

test("a state prop's page links its own page in the state voter guide", async ({ page }) => {
  await page.goto(`${BALLOT}/prop-43`);
  const link = page.getByRole("link", { name: "Read Prop 43 in the official state voter guide (opens in a new tab)" });
  await expect(link).toHaveAttribute("href", "https://voterguide.sos.ca.gov/propositions/43/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("From the California Secretary of State, voterguide.sos.ca.gov. Bay Ballot does not write or edit it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Official text" })).toHaveCount(0);
});

test("an SF measure's panel or sheet points to the city's shared measures page", async ({ page }, info) => {
  await page.goto(`${BALLOT}/sf`);
  await contestRow(page, "Proposition D").click();
  const detail = isPhone(info) ? page.getByRole("dialog", { name: "Proposition D" }) : page.getByRole("region", { name: "Proposition D" });
  const link = detail.getByRole("link", { name: "Find Prop D on the city's official measures page (opens in a new tab)" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", SF_LIST);
  await expect(detail.getByText("From the City and County of San Francisco, sf.gov. Bay Ballot does not write or edit it.")).toBeVisible();
  await expect(detail.getByRole("link", { name: "Official text" })).toHaveCount(0);
});

test("a measure linked to a PDF says so", async ({ page }) => {
  await page.goto(`${BALLOT}/fairfield-measure-p`);
  const link = page.getByRole("link", { name: "Read the impartial analysis of Measure P (PDF) (opens in a new tab)" });
  await expect(link).toHaveAttribute("href", /\.pdf$/);
  await expect(page.getByText("From the County of Solano, content.solanocounty.gov. Bay Ballot does not write or edit it.")).toBeVisible();
});
