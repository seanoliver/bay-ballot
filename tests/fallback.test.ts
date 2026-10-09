import { describe, expect, it } from "vitest";
import { placeGroups } from "@/lib/areas";
import { bayHeading, bayLabel, eligible, fallbackFor, fallbackRows, parseScopes, scopeName, sectionScope, withScope } from "@/lib/fallback";
import { EMPTY, setTypeGroup, type GuideInfo, type PickFile } from "@/lib/filters";
import type { Contest, Entry } from "@/lib/schema";
import { c, PA, SF, SM, smL } from "./fixtures/areas";

const state = { level: "state" as const, name: "California" };
const at = (x: Contest, section: string) => ({ ...x, section });
const gov = at(c("governor", state), "State");
const lt = at(c("lt-governor", state), "State");
const groban = at(c("supreme-court-groban", state), "Judicial");
const evans = at(c("supreme-court-evans", state), "Judicial");
const rep15 = at(c("us-rep-15", { level: "district", name: "Congress", district: "15", within: [{ level: "county", name: "San Francisco" }, { level: "county", name: "San Mateo" }] }), "Federal");
const rtm = at(c("rtm", { level: "region", name: "Bay Area", within: [{ level: "county", name: "San Francisco" }, { level: "county", name: "San Mateo" }] }), "Regional measures");
const local = at(smL, "County measures");
const ward = at(c("ebmud-ward-3", { level: "district", name: "EBMUD Ward", district: "3", within: [{ level: "county", name: "San Francisco" }, { level: "county", name: "San Mateo" }] }), "School and special districts");
const contests = [rep15, gov, lt, groban, evans, rtm, ward, local];
const groups = placeGroups(contests, [SF, SM, PA]);

const yes: Entry = { pick: "Y", ranked: false, quotes: [] };
const file = (picks: string[], hasReasoning = true): PickFile => ({ hasReasoning, picks: Object.fromEntries(picks.map((id) => [id, yes])) });
const guide = (id: string, type: GuideInfo["type"] = "club"): GuideInfo => ({ id, name: id.toUpperCase(), type });

const smGuides = [guide("sm1")];
const smFiles = { sm1: file(["governor", local.id]) };
const bayGuides = [guide("sm1"), guide("sf1"), guide("sf2", "union"), guide("sf3")];
const bayFiles = {
  sm1: smFiles.sm1,
  sf1: file(["governor", "lt-governor", "supreme-court-groban", "rtm", "ebmud-ward-3", local.id]),
  sf2: file(["lt-governor", "supreme-court-groban", "supreme-court-evans"], false),
  sf3: file(["governor"]),
};
const fb = fallbackFor({ groups, place: "San Mateo", local: { guides: smGuides, files: smFiles }, bay: { guides: bayGuides, files: bayFiles } })!;

describe("eligible", () => {
  it("is statewide, regional and state-district contests, by jurisdiction", () => {
    expect([gov, rtm, rep15].map(eligible)).toEqual([true, true, true]);
    const assembly = c("assembly-19", { level: "district", name: "Assembly", district: "19", within: [{ level: "county", name: "San Mateo" }] });
    expect(eligible(assembly)).toBe(true);
  });
  it("is never a local contest, even a special district spanning counties", () => {
    expect([local, ward].map(eligible)).toEqual([false, false]);
  });
});

describe("fallbackFor", () => {
  it("offers only statewide, federal and regional contests the area's guides skipped and some Bay Area guide covered", () => {
    expect(fb.sections.flatMap((s) => s.contests)).toEqual(["lt-governor", "supreme-court-groban", "supreme-court-evans", "rtm"]);
  });

  it("never offers a local contest, even one Bay Area guides took a position on", () => {
    expect(fb.sections.flatMap((s) => s.contests)).not.toContain(local.id);
    expect(fb.sections.flatMap((s) => s.contests)).not.toContain(ward.id);
  });

  it("defaults a section to the Bay Area only when the area's guides skipped every contest in it", () => {
    expect(fb.sections.map((s) => [s.id, s.initial])).toEqual([
      ["section-state-state", "area"],
      ["section-state-judicial", "bay"],
      ["section-region-regional-measures", "bay"],
    ]);
  });

  it("ships only the Bay Area guides and picks the fallback contests need", () => {
    expect(fb.guides.map((g) => g.id)).toEqual(["sf1", "sf2"]);
    expect(Object.keys(fb.files.sf1.picks).sort()).toEqual(["lt-governor", "rtm", "supreme-court-groban"]);
  });

  it("is null when the area's guides covered every eligible contest", () => {
    const all = { guides: bayGuides, files: bayFiles };
    expect(fallbackFor({ groups, place: "San Mateo", local: { guides: [guide("sf1")], files: { sf1: file(contests.map((x) => x.id)) } }, bay: all })).toBeNull();
  });
});

describe("fallbackRows", () => {
  const ids = (f: typeof EMPTY) => fallbackRows("supreme-court-groban", fb, f).map((r) => r.guide.id);
  it("tallies every Bay Area guide that took a position", () => {
    expect(ids(EMPTY)).toEqual(["sf1", "sf2"]);
  });
  it("respects hidden guides, hidden types and the reasons-only filter", () => {
    expect(ids({ off: ["sf1"], whyOnly: false })).toEqual(["sf2"]);
    expect(ids(setTypeGroup(EMPTY, "union", bayGuides, false))).toEqual(["sf1"]);
    expect(ids({ off: [], whyOnly: true })).toEqual(["sf1"]);
  });
});

describe("scopes", () => {
  it("reads only known choices and writes one without dropping the others", () => {
    expect(parseScopes("a=bay&b=area&c=junk")).toEqual({ a: "bay", b: "area" });
    expect(parseScopes(null)).toEqual({});
    expect(parseScopes(withScope("a=bay", "b", "area"))).toEqual({ a: "bay", b: "area" });
    expect(parseScopes(withScope("a=bay", "a", "area"))).toEqual({ a: "area" });
  });
  it("uses the visitor's choice over the default", () => {
    expect(sectionScope(undefined, "bay")).toBe("bay");
    expect(sectionScope("area", "bay")).toBe("area");
  });
});

describe("labels", () => {
  it("names the area without 'County', preferring its short name", () => {
    expect([SF, SM, PA].map(scopeName)).toEqual(["SF", "San Mateo", "Palo Alto"]);
  });
  it("says how many Bay Area guides filters hide, and never shows zero guides", () => {
    expect(bayHeading(4, 4)).toEqual({ label: "4 guides from across the Bay Area", hidden: null });
    expect(bayHeading(3, 4)).toEqual({ label: "3 guides from across the Bay Area", hidden: "1 guide hidden" });
    expect(bayHeading(0, 3)).toEqual({ label: "Filters hide all 3 Bay Area guides", hidden: null });
    expect(bayHeading(0, 1)).toEqual({ label: "Filters hide the only Bay Area guide", hidden: null });
  });
  it("counts Bay Area guides", () => {
    expect(bayLabel(1)).toBe("1 guide from across the Bay Area");
    expect(bayLabel(14)).toBe("14 guides from across the Bay Area");
  });
});
