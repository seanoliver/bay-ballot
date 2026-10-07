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
    expect(hits(byId("college-board"), "Ed Lee Dems endorse")).toBe(false);
    expect(hits(byId("college-board"), "Jeremy Lee")).toBe(true);
  });
});

const page = (text: string, url = "https://g.org/"): Page => ({ url, text, kind: "html" });
const quote = (text: string, source = "https://g.org/") => ({ text, source });
const contests = ballot.contests;

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

describe("markers across places", () => {
  const measure = (id: string, title: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const race = (id: string, title: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title, kind: "candidate", candidates: ["Ann Lee", "Bo Diaz"], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const mpP = measure("menlo-park-measure-p", "Menlo Park Measure P", { level: "city", name: "Menlo Park" });
  const scP = measure("san-carlos-measure-p", "San Carlos Measure P", { level: "city", name: "San Carlos" });
  const hmbQ = measure("half-moon-bay-measure-q", "Half Moon Bay Measure Q", { level: "city", name: "Half Moon Bay" });
  const sfP = measure("prop-p", "Proposition P", { level: "city", name: "San Francisco" });
  const school = measure("sequoia-uhsd-measure-x", "Sequoia Union High School District Measure X", {
    level: "district", name: "Sequoia Union High School District", district: "at-large", within: [{ level: "county", name: "San Mateo" }],
  });
  const rc2 = race("redwood-city-council-2", "Redwood City Council, District 2", {
    level: "district", name: "City Council", district: "2", within: [{ level: "city", name: "Redwood City" }],
  });
  const smSup5 = race("san-mateo-county-supervisor-5", "San Mateo County Board of Supervisors, District 5", {
    level: "district", name: "Supervisor", district: "5", within: [{ level: "county", name: "San Mateo" }],
  });
  const sfSup5 = race("supervisor-5", "Board of Supervisors, District 5", {
    level: "district", name: "Supervisor", district: "5", within: [{ level: "county", name: "San Francisco" }],
  });
  const marks = (c: Contest, siblings: Contest[], text: string) => contestMarkers(c, siblings).some((re) => re.test(text));

  it("finds a local measure by its letter when no sibling shares it", () => {
    for (const t of ["Measure Q — Yes", "Yes on Q", "Half Moon Bay Measure Q"]) expect(marks(hmbQ, [hmbQ, mpP], t)).toBe(true);
    expect(marks(school, [school], "Measure X: Yes")).toBe(true);
  });
  it("marks every contest that shares a letter on an unqualified heading, and only the named one on a qualified heading", () => {
    const sibs = [mpP, scP, hmbQ];
    const page = (heading: string): Page => ({
      url: "https://g.org/m", kind: "html",
      text: ["Half Moon Bay Measure Q: Yes", "Farmworkers need homes.", "", heading, "Voters should decide this one carefully."].join("\n"),
    });
    const q = { text: "Voters should decide this one carefully.", source: "https://g.org/m" };
    expect(misplacedUnder(q, "menlo-park-measure-p", [page("Measure P: Yes")], sibs)).toBeNull();
    expect(misplacedUnder(q, "san-carlos-measure-p", [page("Measure P: Yes")], sibs)).toBeNull();
    expect(misplacedUnder(q, "menlo-park-measure-p", [page("San Carlos Measure P: No")], sibs)).toBe("san-carlos-measure-p");
    expect(marks(mpP, sibs, "Menlo Park Measure P: Yes")).toBe(true);
    expect(marks(mpP, sibs, "Measure P (Menlo Park)")).toBe(true);
  });
  it("gives an SF proposition both its Prop marker and the shared bare marker", () => {
    expect(marks(sfP, [sfP, mpP], "Prop P")).toBe(true);
    expect(marks(sfP, [sfP, mpP], "Measure P")).toBe(true);
    expect(marks(mpP, [sfP, mpP], "Menlo Park Measure P")).toBe(true);
  });
  it("finds council districts, and qualifies a district number shared across counties", () => {
    expect(marks(rc2, [rc2], "City Council District 2")).toBe(true);
    expect(marks(rc2, [rc2], "Council, District 2")).toBe(true);
    expect(marks(smSup5, [smSup5, sfSup5], "District 5")).toBe(false);
    expect(marks(smSup5, [smSup5, sfSup5], "San Mateo County Supervisor, District 5")).toBe(true);
    expect(marks(smSup5, [smSup5], "Supervisor, District 5")).toBe(true);
    expect(marks(smSup5, [smSup5], "District 5 - Margo Meiman")).toBe(false);
    const smc1 = race("san-mateo-council-1", "San Mateo City Council, District 1", { level: "district", name: "City Council", district: "1", within: [{ level: "city", name: "San Mateo" }] });
    const fc1 = race("foster-city-council-1", "Foster City Council, District 1", { level: "district", name: "City Council", district: "1", within: [{ level: "city", name: "Foster City" }] });
    expect(marks(smc1, [smc1, fc1], "San Mateo County: Foster City Council, District 1")).toBe(false);
    expect(marks(fc1, [smc1, fc1], "San Mateo County: Foster City Council, District 1")).toBe(true);
    expect(marks(smc1, [smc1, fc1], "San Mateo City Council, District 1")).toBe(true);
    expect(marks(smSup5, [smSup5, sfSup5], "San Mateo County Supervisor, District 5")).toBe(true);
    expect(marks(sfSup5, [sfSup5], "District 5")).toBe(true);
  });
  it("tells Court of Appeal districts apart, and keeps the bare name when only one is on the ballot", () => {
    const coa = (n: string, county: string) =>
      ({ id: `court-of-appeal-${n}`, section: "Judicial", title: `${n === "1" ? "1st" : "6th"} District Court of Appeal`, kind: "retention", candidates: [], seats: 1, rankedChoice: false,
         jurisdiction: { level: "district", name: "Court of Appeal", district: n, within: [{ level: "county", name: county }] } }) as Contest;
    const one = coa("1", "San Francisco");
    const six = coa("6", "Santa Clara");
    expect(marks(one, [one], "Court of Appeal: retain all")).toBe(true);
    expect(marks(one, [one, six], "Court of Appeal")).toBe(false);
    expect(marks(one, [one, six], "First District Court of Appeal")).toBe(true);
    expect(marks(six, [one, six], "6th District Court of Appeal")).toBe(true);
    expect(marks(six, [one, six], "Court of Appeal, Sixth District")).toBe(true);
    expect(marks(six, [one, six], "Sixth Appellate District")).toBe(true);
    expect(marks(six, [one, six], "6th Appellate District: retain all five")).toBe(true);
    expect(marks(one, [one, six], "First Court of Appeals")).toBe(true);
    expect(marks(six, [one, six], "6th Court of Appeal")).toBe(true);
    expect(marks(one, [one, six], "6th Court of Appeals")).toBe(false);
  });
  it("places a quote under the right city's Measure P", () => {
    const page: Page = {
      url: "https://g.org/e", kind: "html",
      text: ["Menlo Park Measure P: Yes", "Menlo Park needs the homes this measure allows.", "", "San Carlos Measure P: No", "San Carlos voters should keep the current height limits."].join("\n"),
    };
    const q = { text: "San Carlos voters should keep the current height limits.", source: "https://g.org/e" };
    expect(misplacedUnder(q, "menlo-park-measure-p", [page], [mpP, scP])).toBe("san-carlos-measure-p");
    expect(misplacedUnder(q, "san-carlos-measure-p", [page], [mpP, scP])).toBeNull();
  });
});

describe("quotes under a letter shared across areas", () => {
  it("keeps Greenbelt's Sunset Dunes reason under SF Prop G", () => {
    const page: Page = {
      url: "https://www.greenbelt.org/voter-guide-26/", kind: "html",
      text: [
        "Vote No on Proposition 43 to Keep Citizen-Led Tax Measures Accessible",
        "Greenbelt Alliance opposes Proposition 43’s goal to raise the threshold for citizen-initiated local special tax measures.",
        "Read More »",
        "Vote No on Measure G to Keep Sunset Dunes Park Open in San Francisco",
        "Vote NO on Measure G to save Sunset Dunes and keep the 2-mile stretch of the Upper Great Highway along San Francisco’s Ocean Beach closed to cars and open for people.",
      ].join("\n"),
    };
    const q = { text: "Vote NO on Measure G to save Sunset Dunes and keep the 2-mile stretch of the Upper Great Highway along San Francisco’s Ocean Beach closed to cars and open for people.", source: page.url };
    expect(misplacedUnder(q, "prop-g", [page], ballot.contests)).toBeNull();
  });
  it("keeps Bay Rising's renter reason under Redwood City Measure E", () => {
    const page: Page = {
      url: "https://bayrisingaction.org/voterguide/", kind: "html",
      text: [
        "Yes on Prop I: Ensure Luxury Real Estate Tax is Spent on Affordable Housing",
        "San Francisco faces an affordable housing crisis that is displacing thousands of people from the city.",
        "REDWOOD CITY, SAN MATEO COUNTY",
        "Yes on Measure E: Stabilize Rents and Protect Against Unjust Evictions",
        "Half of Redwood City residents are renters. Measure E would strengthen protections for renters, including rent stabilization capped at 5% per year.",
      ].join("\n"),
    };
    const q = { text: "Measure E would strengthen protections for renters, including rent stabilization capped at 5% per year.", source: page.url };
    expect(misplacedUnder(q, "redwood-city-measure-e", [page], ballot.contests)).toBeNull();
  });
  it("flags an SF Measure I reason extracted under Half Moon Bay Measure I", () => {
    const page: Page = {
      url: "https://bayrisingaction.org/voterguide/", kind: "html",
      text: [
        "Yes on Prop I: Ensure Luxury Real Estate Tax is Spent on Affordable Housing",
        "San Francisco faces an affordable housing crisis. Measure I dedicates an existing, voter-approved tax to fund permanently affordable housing and preventing displacement.",
      ].join("\n"),
    };
    const q = { text: "Measure I dedicates an existing, voter-approved tax to fund permanently affordable housing and preventing displacement.", source: page.url };
    expect(misplacedUnder(q, "half-moon-bay-measure-i", [page], ballot.contests)).toBe("prop-i");
    expect(misplacedUnder(q, "prop-i", [page], ballot.contests)).toBeNull();
  });
  it("places quotes under Mountain View's Measure E and El Camino Healthcare's Measure S, not the other cities' E and S", () => {
    const page: Page = {
      url: "https://g.org/scc", kind: "html",
      text: [
        "Redwood City Measure E: Yes",
        "Renters need stable rents.",
        "",
        "Mountain View Measure E: Yes",
        "The charter should use gender-neutral language.",
        "",
        "El Camino Healthcare District Measure S: Yes",
        "Term limits keep the board accountable.",
        "",
        "San Bruno Measure S: No",
        "The housing rules are too loose.",
      ].join("\n"),
    };
    const q = (text: string) => ({ text, source: page.url });
    expect(misplacedUnder(q("The charter should use gender-neutral language."), "mountain-view-measure-e", [page], ballot.contests)).toBeNull();
    expect(misplacedUnder(q("The charter should use gender-neutral language."), "redwood-city-measure-e", [page], ballot.contests)).toBe("mountain-view-measure-e");
    expect(misplacedUnder(q("Term limits keep the board accountable."), "el-camino-healthcare-measure-s", [page], ballot.contests)).toBeNull();
    expect(misplacedUnder(q("Term limits keep the board accountable."), "san-bruno-measure-s", [page], ballot.contests)).toBe("el-camino-healthcare-measure-s");
  });
});
