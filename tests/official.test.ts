import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import { markSharedLinks, officialSource } from "@/lib/official";
import type { Contest } from "@/lib/schema";

const measure = (over: Partial<Contest>): Contest =>
  ({ id: "m", section: "Measures", kind: "measure", candidates: [], seats: 1, rankedChoice: false, title: "Measure A", jurisdiction: { level: "county", name: "X" }, ...over }) as Contest;

const prop43 = measure({ id: "prop-43", title: "Proposition 43", link: "https://voterguide.sos.ca.gov/propositions/43/", jurisdiction: { level: "state", name: "California" } });
const sf = (letter: string) =>
  measure({ id: `sf-${letter}`, title: `Proposition ${letter}`, link: "https://www.sf.gov/qualified-ballot-measures", jurisdiction: { level: "city", name: "San Francisco" } });

describe("officialSource", () => {
  it("reads a state prop in the state voter guide", () => {
    const [c] = markSharedLinks([prop43]);
    expect(officialSource(c)).toEqual({
      href: "https://voterguide.sos.ca.gov/propositions/43/",
      label: "Read Prop 43 in the official state voter guide",
      note: "From the California Secretary of State, voterguide.sos.ca.gov. Bay Ballot does not write or edit it.",
    });
  });

  it("says find, not read, when several measures share one list page", () => {
    const [d] = markSharedLinks([sf("D"), sf("E")]);
    expect(officialSource(d)).toMatchObject({
      label: "Find Prop D on the city's official measures page",
      note: "From the City and County of San Francisco, sf.gov. Bay Ballot does not write or edit it.",
    });
  });

  it("names the county for a county site's list page, even for a city measure", () => {
    const oak = (l: string) => measure({ title: `City of Alameda Measure ${l}`, link: "https://alamedacountyca.gov/rov_app/measures", jurisdiction: { level: "city", name: "Alameda" } });
    const [l] = markSharedLinks([oak("L"), oak("M")]);
    expect(officialSource(l)?.label).toBe("Find Measure L on the county's official measures page");
  });

  it("reads a local measure on its own page", () => {
    const [w] = markSharedLinks([measure({ title: "Measure W", link: "https://www.marincounty.gov/measure-w" })]);
    expect(officialSource(w)).toMatchObject({ label: "Read Measure W on the county's official page", note: expect.stringContaining("From the County of Marin, marincounty.gov.") });
  });

  it("names an unknown host by the host alone and takes the level from the contest", () => {
    const [y] = markSharedLinks([measure({ title: "Measure Y", link: "https://www.townofyountville.gov/659/Measure-Y", jurisdiction: { level: "city", name: "Yountville" } })]);
    expect(officialSource(y)).toMatchObject({
      label: "Read Measure Y on the city's official page",
      note: "From townofyountville.gov. Bay Ballot does not write or edit it.",
    });
  });

  it("leaves out the level for an unknown host and a district measure", () => {
    const c = measure({ title: "Measure J", link: "https://example.org/j", jurisdiction: { level: "district", name: "School District" } });
    expect(officialSource(c)?.label).toBe("Read Measure J on the official page");
  });

  it("is null for candidate races and measures without a link", () => {
    expect(officialSource(measure({ kind: "candidate", link: "https://www.sf.gov/x" }))).toBeNull();
    expect(officialSource(measure({}))).toBeNull();
  });
});

describe("markSharedLinks", () => {
  it("marks only links more than one contest uses", () => {
    const out = markSharedLinks([sf("D"), sf("E"), prop43, measure({ id: "none" })]);
    expect(out.map((c) => c.linkShared)).toEqual([true, true, undefined, undefined]);
  });
});

describe("the ballot data", () => {
  const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");
  const label = (id: string) => officialSource(ballot.contests.find((c) => c.id === id)!)?.label;

  it("gives each state prop its own page and SF one shared page", () => {
    expect(label("prop-43")).toBe("Read Prop 43 in the official state voter guide");
    const sfMeasures = ballot.contests.filter((c) => c.link === "https://www.sf.gov/qualified-ballot-measures");
    expect(sfMeasures.length).toBeGreaterThan(1);
    for (const c of sfMeasures) expect(officialSource(c)?.label).toMatch(/^Find (Prop|Measure) \w+ on the city's official measures page$/);
  });
});
