import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import type { Contest } from "@/lib/schema";
import { contestMarkers, misplacedUnder } from "@/pipeline/placement";
import type { Page } from "@/pipeline/quotes";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");
const byId = (id: string) => {
  const c = ballot.contests.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
};
const hits = (c: Contest, text: string) => contestMarkers(c).some((re) => re.test(text));

describe("contestMarkers", () => {
  it("finds measures by Prop, Proposition and Measure", () => {
    const g = byId("prop-g");
    for (const t of ["No on Prop G: Closing Sunset Dunes Park", "PROPOSITION G", "Prop. G", "Measure G — No"]) {
      expect(hits(g, t)).toBe(true);
    }
    expect(hits(g, "Prop GG")).toBe(false);
    expect(hits(g, "Prop H")).toBe(false);
  });
  it("does not confuse Prop 4 with Prop 40 or 4A", () => {
    const p4 = byId("prop-4");
    expect(hits(p4, "Prop 4: Campaign financing")).toBe(true);
    expect(hits(p4, "Prop 40: Billionaire tax")).toBe(false);
    expect(hits(p4, "Prop 4A")).toBe(false);
  });
  it("finds the regional transit measure by name or letters", () => {
    const rtm = byId("rtm");
    for (const t of ["Yes on RTM: Regional Transit Measure", "Regional Transit Measure", "Regional Measure RTM"]) {
      expect(hits(rtm, t)).toBe(true);
    }
  });
  it("finds candidate races by office and by candidate name", () => {
    const d10 = byId("supervisor-10");
    expect(hits(d10, "Supervisor, District 10: Non-Ranked Dual Endorsement")).toBe(true);
    expect(hits(d10, "District 10 Supervisor")).toBe(true);
    expect(hits(d10, "D10 Supervisor")).toBe(true);
    expect(hits(d10, "J.R. Eppler and D.J. Brookter")).toBe(true);
    expect(hits(d10, "Theo Ellington")).toBe(true);
    expect(hits(d10, "Supervisor, District 8")).toBe(false);
  });
  it("does not match across a line break", () => {
    expect(hits(byId("prop-a"), "Regional Transit Measure\nA 14-year sales tax")).toBe(false);
  });
  it("finds 'YES on A' style measure headings", () => {
    expect(hits(byId("prop-a"), "[✅] YES on A — Charter Changes")).toBe(true);
    expect(hits(byId("prop-g"), "No on G, and yes to Sunset Dunes.")).toBe(true);
    expect(hits(byId("prop-a"), "Vote yes on Alan Wong")).toBe(false);
  });
  it("finds district shorthand headings", () => {
    expect(hits(byId("supervisor-8"), "D8 Endorsement Explanation")).toBe(true);
    expect(hits(byId("bart-8"), "BART D8 Endorsement Explanation")).toBe(true);
    expect(hits(byId("bart-8"), "For BART Board of Directors, District 8, the Sierra Club endorses")).toBe(true);
  });
  it("matches statewide office titles only in heading form", () => {
    expect(hits(byId("governor"), "Governor: Xavier Becerra")).toBe(true);
    expect(hits(byId("governor"), "Governor")).toBe(true);
    expect(hits(byId("controller"), "Controller's report (PDF)")).toBe(false);
    expect(hits(byId("attorney-general"), "Attorney General initiative filing 25-0016")).toBe(false);
    expect(hits(byId("treasurer"), "State treasurer/CPA")).toBe(false);
    expect(hits(byId("governor"), "Lieutenant Governor of California")).toBe(false);
  });
  it("marks both Supreme Court retention races with 'Supreme Court'", () => {
    expect(hits(byId("supreme-court-groban"), "California Supreme Court")).toBe(true);
    expect(hits(byId("supreme-court-evans"), "California Supreme Court")).toBe(true);
  });
  it("does not use bare last names that collide with other words", () => {
    // Jeremy Lee runs for College Board; "Ed Lee Dems" is a club, not that race.
    expect(hits(byId("college-board"), "Ed Lee Dems endorse")).toBe(false);
    expect(hits(byId("college-board"), "Jeremy Lee")).toBe(true);
  });
});

const page = (text: string, url = "https://g.org/"): Page => ({ url, text, kind: "html" });
const quote = (text: string, source = "https://g.org/") => ({ text, source });
const contests = ballot.contests;

// Real layout from abundantsanfrancisco.org/vote/ballot-measures (Oct 2026).
const abundant = page(
  [
    "Ballot Measures",
    "Yes on RTM: Regional Transit Measure",
    "YES",
    "This measure is critical to saving Bay Area public transit – without it we will see catastrophic service cuts at BART, Muni and Caltrain. This would increase congestion, make it more expensive for people to get to work, and hurt our economy. Key to vote yes on BOTH RTM and Prop H (Muni Funding).",
    "[Regional Transit Measure]",
    "Yes on Prop A: Department, Board, Commission, and Advisory Body Updates",
    "YES",
    "Civic participation in government is important but San Francisco has too many commissions.",
    "No on Prop G: Closing Sunset Dunes Park",
    "NO",
    "Sunset Dunes park is already one of the most visited parks on the west coast of the United States.",
    "[Prop G: Closing Sunset Dunes Park]",
  ].join("\n"),
);

describe("misplacedUnder", () => {
  const congestion = quote("This would increase congestion, make it more expensive for people to get to work, and hurt our economy.");
  const dunes = quote("Sunset Dunes park is already one of the most visited parks on the west coast of the United States.");

  it("keeps a quote under its own contest's heading", () => {
    expect(misplacedUnder(congestion, "rtm", [abundant], contests)).toBeNull();
    expect(misplacedUnder(dunes, "prop-g", [abundant], contests)).toBeNull();
  });
  it("names the contest a misattached quote sits under", () => {
    expect(misplacedUnder(dunes, "rtm", [abundant], contests)).toBe("prop-g");
    expect(misplacedUnder(congestion, "prop-g", [abundant], contests)).toBe("rtm");
  });
  it("catches a quote from one measure's section attached to another (congestion under Prop G)", () => {
    const p = page("Yes on RTM\nTransit funding keeps the region moving every day.\nNo on Prop G\nThis would increase congestion, make it more expensive for people to get to work, and hurt our economy.");
    expect(misplacedUnder(congestion, "rtm", [p], contests)).toBe("prop-g");
  });
  it("keeps quotes on a single-measure page with no other markers", () => {
    const p = page("SPUR Voter Guide\nRecommendation: Vote No\nProp. B's proposed charter amendment does not reflect SPUR's principles of good governance.", "https://spur.org/b");
    expect(misplacedUnder(quote("Prop. B's proposed charter amendment does not reflect SPUR's principles of good governance.", "https://spur.org/b"), "prop-b", [p], contests)).toBeNull();
    const none = page("Recommendation: Vote No\nThe charter amendment does not reflect our principles.", "https://spur.org/b2");
    expect(misplacedUnder(quote("The charter amendment does not reflect our principles.", "https://spur.org/b2"), "prop-b", [none], contests)).toBeNull();
  });
  it("assigns a slate page's sections in order", () => {
    const p = page("Prop A: Yes\nA consolidates commissions to speed up city hall.\nProp B: No\nA public bank would cost the city hundreds of millions.");
    const a = quote("A consolidates commissions to speed up city hall.");
    const b = quote("A public bank would cost the city hundreds of millions.");
    expect(misplacedUnder(a, "prop-a", [p], contests)).toBeNull();
    expect(misplacedUnder(b, "prop-b", [p], contests)).toBeNull();
    expect(misplacedUnder(b, "prop-a", [p], contests)).toBe("prop-b");
  });
  it("ignores markers mentioned mid-paragraph", () => {
    const p = page("Prop C: Yes\nThis measure works alongside the housing deal behind Prop I and Prop J. It funds affordable housing without new taxes.");
    expect(misplacedUnder(quote("It funds affordable housing without new taxes."), "prop-c", [p], contests)).toBeNull();
  });
  it("ignores prose lines that mention another contest", () => {
    const p = page("Prop B: No\nThe Controller cautions the real figure could be significantly higher or lower, and warns of risks.\nA public bank would cost the city hundreds of millions.");
    expect(misplacedUnder(quote("A public bank would cost the city hundreds of millions."), "prop-b", [p], contests)).toBeNull();
    const q = page("Prop E: Yes\nIn 2021, 46 candidates ran to replace Governor Newsom in the recall.\nOne person in charge makes contracting faster.");
    expect(misplacedUnder(quote("One person in charge makes contracting faster."), "prop-e", [q], contests)).toBeNull();
  });
  it("treats a heading that names several contests as covering all of them", () => {
    const p = page("November 2026: Vote YES on Prop H and RTM!\nInvesting in transit is an investment in a healthier Bay Area.");
    const q = quote("Investing in transit is an investment in a healthier Bay Area.");
    expect(misplacedUnder(q, "rtm", [p], contests)).toBeNull();
    expect(misplacedUnder(q, "prop-h", [p], contests)).toBeNull();
  });
  it("keeps a quote that names its own contest", () => {
    const p = page("Prop 37: Yes\nAttorney General initiative 25-0013\nProp 37 will help restart condo construction across the state.");
    expect(misplacedUnder(quote("Prop 37 will help restart condo construction across the state."), "prop-37", [p], contests)).toBeNull();
    const d = page("Board of Supervisors, District 6 — Recommended: Matt Dorsey\nIn Districts 4 and 6, we recommend Alan Wong and Matt Dorsey as the best candidates.");
    expect(misplacedUnder(quote("In Districts 4 and 6, we recommend Alan Wong and Matt Dorsey as the best candidates."), "supervisor-4", [d], contests)).toBeNull();
  });
  it("prefers the longer heading where markers overlap", () => {
    const q = quote("Transit needs an operator on the board who rides it every day.");
    const p = page(`BART Board, District 8\n${q.text}`);
    expect(misplacedUnder(q, "bart-8", [p], contests)).toBeNull();
    expect(misplacedUnder(q, "supervisor-8", [p], contests)).toBe("bart-8");
    const g = page(`Lieutenant Governor\n${q.text}`);
    expect(misplacedUnder(q, "governor", [g], contests)).toBe("lt-governor");
  });
  it("treats consecutive heading lines as one section", () => {
    const p = page("Prop 41: Wealth tax poison pill: Hell No!\nProp 42: Poison pill: Hell No!\nProp 43: Limit local taxes: Hell No!\nThese measures are designed to sabotage the billionaire tax.");
    const q = quote("These measures are designed to sabotage the billionaire tax.");
    expect(misplacedUnder(q, "prop-41", [p], contests)).toBeNull();
    expect(misplacedUnder(q, "prop-43", [p], contests)).toBeNull();
    expect(misplacedUnder(q, "prop-44", [p], contests)).toBe("prop-43");
  });
  it("keeps a quote whose page or text can't be located", () => {
    expect(misplacedUnder(quote("Not on the page at all, anywhere."), "prop-a", [abundant], contests)).toBeNull();
    expect(misplacedUnder(quote(dunes.text, "https://other.org/"), "rtm", [abundant], contests)).toBeNull();
  });
});
