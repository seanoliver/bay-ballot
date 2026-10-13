import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import { linkKey, markSharedLinks, measureName, officialSource } from "@/lib/official";
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

  it("names the place when a regional measure links to a narrower government's page", () => {
    const rtm = (id: string) => measure({ id, title: "Regional Measure RTM", link: "https://www.sf.gov/qualified-ballot-measures", jurisdiction: { level: "region", name: "Bay Area" } });
    const [r] = markSharedLinks([rtm("rtm"), sf("D")]);
    expect(officialSource(r)?.label).toBe("Find Measure RTM on San Francisco's official measures page");
  });

  it("gives an unknown host no possessive and names it by its host", () => {
    const [y] = markSharedLinks([measure({ title: "Measure Y", link: "https://www.townofyountville.gov/659/Measure-Y", jurisdiction: { level: "city", name: "Yountville" } })]);
    expect(officialSource(y)).toMatchObject({
      label: "Read Measure Y on its official page",
      note: "From townofyountville.gov. Bay Ballot does not write or edit it.",
    });
  });

  it("calls a PDF a document, or an impartial analysis when its file name says so", () => {
    const pdf = (link: string) => officialSource(measure({ title: "Fairfield Measure P", link }))?.label;
    expect(pdf("https://content.solanocounty.gov/x/Fairfield_-_Final_Impartial_Analysis__Measure_P_.pdf")).toBe("Read the impartial analysis of Measure P (PDF)");
    expect(pdf("https://sonomacounty.gov/Docs/SoCo_MeasP_EN.PDF")).toBe("Read the official document on Measure P (PDF)");
  });

  it("looks up the government without www", () => {
    expect(officialSource(measure({ link: "https://smcacre.gov/e" }))?.note).toContain("the County of San Mateo, smcacre.gov");
    expect(officialSource(measure({ link: "https://www.smcacre.gov/e" }))?.note).toContain("the County of San Mateo, smcacre.gov");
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

  it("counts a link with another host case, www, trailing slash or fragment as the same page", () => {
    expect(linkKey("https://WWW.SF.gov/qualified-ballot-measures/#d")).toBe(linkKey("https://sf.gov/qualified-ballot-measures"));
    const out = markSharedLinks([measure({ link: "https://sf.gov/list/" }), measure({ link: "https://www.sf.gov/list#b" })]);
    expect(out.every((c) => c.linkShared)).toBe(true);
  });
});

describe("the ballot data", () => {
  const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");
  const linked = ballot.contests.filter((c) => c.kind === "measure" && c.link);
  const label = (id: string) => officialSource(ballot.contests.find((c) => c.id === id)!)?.label;

  it("gives each state prop its own page and SF's props one shared page", () => {
    expect(label("prop-43")).toBe("Read Prop 43 in the official state voter guide");
    expect(label("prop-d")).toBe("Find Prop D on the city's official measures page");
    expect(label("rtm")).toBe("Find Measure RTM on San Francisco's official measures page");
  });

  it("never says the city's or the county's for a regional or state contest", () => {
    for (const c of linked.filter((c) => c.jurisdiction.level === "region" || c.jurisdiction.level === "state")) {
      expect(officialSource(c)?.label, c.id).not.toMatch(/the (city|county)'s/);
    }
  });

  it("labels every PDF as one and never calls it a page", () => {
    const pdfs = linked.filter((c) => /\.pdf$/i.test(new URL(c.link!).pathname));
    expect(pdfs.length).toBeGreaterThan(0);
    for (const c of pdfs) expect(officialSource(c)?.label, c.id).toMatch(/^Read the (impartial analysis of|official document on) .+ \(PDF\)$/);
    for (const c of linked.filter((c) => !pdfs.includes(c))) expect(officialSource(c)?.label, c.id).not.toContain("(PDF)");
  });

  it("shortens every linked title without cutting it, and uniquely within each shared page", () => {
    const names = new Map<string, Set<string>>();
    for (const c of linked) {
      const name = measureName(c.title);
      expect(name, c.id).not.toContain("…");
      const key = linkKey(c.link!);
      const seen = names.get(key) ?? new Set<string>();
      expect(seen.has(name), `${name} twice on ${key}`).toBe(false);
      names.set(key, seen.add(name));
    }
  });
});
