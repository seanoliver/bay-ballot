import { describe, expect, it } from "vitest";
import { areaGuides, areaLinks, areasOf, BAY_AREA, contestArea, contestPlace, inArea, placeGroups, placeName } from "@/lib/areas";
import type { Area } from "@/lib/schema";
import { c, mpP, PA, prop1, propB, rc2, rep15, rtm, sccA, SF, SM, smL, smX, sup8 } from "./fixtures/areas";

const areas = [SF, SM, PA];
const ids = (as: Area[]) => as.map((a) => a.id);

describe("areasOf", () => {
  it("puts statewide contests in every area", () => {
    expect(ids(areasOf(prop1, areas))).toEqual(["sf", "san-mateo", "palo-alto"]);
  });
  it("matches county, city, district and region contests by place", () => {
    expect(ids(areasOf(propB, areas))).toEqual(["sf"]);
    expect(ids(areasOf(sup8, areas))).toEqual(["sf"]);
    expect(ids(areasOf(rep15, areas))).toEqual(["sf", "san-mateo"]);
    expect(ids(areasOf(rtm, areas))).toEqual(["sf", "san-mateo", "palo-alto"]);
    expect(ids(areasOf(mpP, areas))).toEqual(["san-mateo"]);
    expect(ids(areasOf(rc2, areas))).toEqual(["san-mateo"]);
    expect(ids(areasOf(sccA, areas))).toEqual(["palo-alto"]);
  });
  it("puts a contest in no area when no area lists its place", () => {
    expect(areasOf(c("x", { level: "city", name: "Atlantis" }), areas)).toEqual([]);
    expect(areasOf(c("y", { level: "district", name: "Supervisor", district: "1" }), areas)).toEqual([]);
    expect(inArea(c("z", { level: "county", name: "San Francisco" }), SM)).toBe(false);
  });
});

describe("contestArea", () => {
  it("is the one area a contest is in, or null when it is in several", () => {
    expect(contestArea(propB, areas)?.id).toBe("sf");
    expect(contestArea(prop1, areas)).toBeNull();
    expect(contestArea(prop1, [SF])?.id).toBe("sf");
  });
});

describe("areaGuides", () => {
  it("keeps the guides that cover the area", () => {
    const gs = [{ id: "a", areas: ["sf"] }, { id: "b", areas: ["san-mateo"] }, { id: "c", areas: ["sf", "san-mateo"] }];
    expect(areaGuides(gs, SM).map((g) => g.id)).toEqual(["b", "c"]);
  });
});

describe("placeName", () => {
  it("uses the area's name and short name, or the Bay Area", () => {
    expect(placeName(SF)).toEqual({ name: "San Francisco", short: "SF" });
    expect(placeName(SM)).toEqual({ name: "San Mateo County", short: "San Mateo County" });
    expect(placeName(null)).toEqual(BAY_AREA);
  });
});

describe("areaLinks", () => {
  it("lists the Bay Area then each area, marking the current one", () => {
    expect(areaLinks("2026-11", [SF, SM], "sf")).toEqual([
      { href: "/2026-11", label: "Bay Area", current: false },
      { href: "/2026-11/sf", label: "San Francisco", current: true },
      { href: "/2026-11/san-mateo", label: "San Mateo County", current: false },
    ]);
    expect(areaLinks("2026-11", [SF], null)[0].current).toBe(true);
  });
});

describe("placeGroups", () => {
  const all = [mpP, propB, prop1, smL, rc2, sup8, rep15, rtm, smX, sccA];
  const groups = placeGroups(all, areas);
  it("puts California first, then the regional measure, then each county in areas.yml order with its cities after it", () => {
    expect(groups.map((g) => [g.heading, g.sections.flatMap((s) => s.contests.map((x) => x.id))])).toEqual([
      ["California", ["prop-1", "us-rep-15"]],
      ["Bay Area", ["rtm"]],
      ["San Francisco", ["prop-b", "supervisor-8"]],
      ["San Mateo County", ["san-mateo-county-measure-l"]],
      ["Menlo Park", ["menlo-park-measure-p"]],
      ["Redwood City", ["redwood-city-council-2"]],
      ["San Mateo", ["san-mateo-measure-x"]],
      ["Santa Clara County", ["santa-clara-county-measure-a"]],
    ]);
  });
  it("records each group's county for the county filter", () => {
    expect(groups.map((g) => g.county)).toEqual([null, null, "San Francisco", "San Mateo", "San Mateo", "San Mateo", "San Mateo", "Santa Clara"]);
  });
  it("keeps sections in first-appearance order inside a group", () => {
    const a = { ...prop1, id: "a", section: "State" };
    const b = { ...prop1, id: "b", section: "State propositions" };
    expect(placeGroups([b, a], [SF])[0].sections.map((s) => s.name)).toEqual(["State propositions", "State"]);
  });
});

describe("a district in several places", () => {
  const ward = c("water-ward-1", {
    level: "district", name: "Water Board", district: "1",
    within: [{ level: "city", name: "Menlo Park" }, { level: "city", name: "Redwood City" }],
  });
  it("is in every area that lists one of its places", () => {
    expect(ids(areasOf(ward, areas))).toEqual(["san-mateo"]);
  });
  it("sits under its county, not under its first city", () => {
    expect(placeGroups([ward], areas).map((g) => [g.heading, g.county])).toEqual([["San Mateo County", "San Mateo"]]);
  });
});

describe("Court of Appeal", () => {
  it("lists a Court of Appeal district under California", () => {
    const coa = c("court-of-appeal-6", { level: "district", name: "Court of Appeal", district: "6", within: [{ level: "county", name: "Santa Clara" }] });
    expect(placeGroups([coa], [PA])[0].heading).toBe("California");
  });
});

describe("contestPlace", () => {
  const MV: Area = { id: "mountain-view", name: "Mountain View", kind: "city", jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "Santa Clara" }, { level: "city", name: "Mountain View" }] };
  const all = [SF, SM, PA, MV];
  it("is the one area a contest is in", () => {
    expect(contestPlace(propB, all)).toEqual({ area: SF, place: { name: "San Francisco", short: "SF" } });
  });
  it("names the county when every area it is in shares that county", () => {
    const water = c("valley-water-7", { level: "district", name: "Santa Clara Valley Water District", district: "7", within: [{ level: "county", name: "Santa Clara" }] });
    expect(contestPlace(water, all)).toEqual({ area: null, place: { name: "Santa Clara County", short: "Santa Clara County" } });
    expect(contestPlace(sccA, all).place.name).toBe("Santa Clara County");
  });
  it("is the Bay Area for a state-drawn district in several areas, even when they share a county", () => {
    const coa6 = c("court-of-appeal-6", { level: "district", name: "Court of Appeal", district: "6", within: [{ level: "county", name: "Santa Clara" }] });
    expect(contestPlace(coa6, all)).toEqual({ area: null, place: BAY_AREA });
  });
  describe("with a county page that lists every city", () => {
    const SCC: Area = {
      id: "santa-clara-county", name: "Santa Clara County", kind: "county",
      jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "Santa Clara" }, { level: "city", name: "Palo Alto" }, { level: "city", name: "Mountain View" }, { level: "city", name: "San Jose" }],
    };
    const SJ: Area = { id: "san-jose", name: "San Jose", kind: "city", jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "Santa Clara" }, { level: "city", name: "San Jose" }] };
    const withCounty = [SF, SM, SCC, PA, MV, SJ];
    it("is the city page for a contest in one city", () => {
      const council = c("palo-alto-council", { level: "city", name: "Palo Alto" });
      expect(contestPlace(council, withCounty)).toEqual({ area: PA, place: { name: "Palo Alto", short: "Palo Alto" } });
      const ward = c("valley-water-6", { level: "district", name: "Santa Clara Valley Water District", district: "6", within: [{ level: "city", name: "San Jose" }] });
      expect(contestPlace(ward, withCounty).area?.id).toBe("san-jose");
    });
    it("is the county page for a district in several of its cities", () => {
      const lasd = c("los-altos-sd-trustee", { level: "district", name: "Los Altos School District", district: "at-large", within: [{ level: "city", name: "Palo Alto" }, { level: "city", name: "Mountain View" }] });
      expect(contestPlace(lasd, withCounty)).toEqual({ area: SCC, place: { name: "Santa Clara County", short: "Santa Clara County" } });
    });
    it("is the county page for a state-drawn district inside that county", () => {
      const cd19 = c("us-rep-19", { level: "district", name: "Congress", district: "19", within: [{ level: "city", name: "San Jose" }] });
      expect(contestPlace(cd19, withCounty)).toEqual({ area: SCC, place: { name: "Santa Clara County", short: "Santa Clara County" } });
      const ad26 = c("assembly-26", { level: "district", name: "Assembly", district: "26", within: [{ level: "city", name: "San Jose" }, { level: "city", name: "Mountain View" }] });
      expect(contestPlace(ad26, withCounty).area).toBe(SCC);
    });
    it("stays on the Bay Area for a district in two counties", () => {
      const ad23 = c("assembly-23", { level: "district", name: "Assembly", district: "23", within: [{ level: "county", name: "San Mateo" }, { level: "city", name: "Palo Alto" }] });
      expect(contestPlace(ad23, withCounty)).toEqual({ area: null, place: BAY_AREA });
    });
  });
  it("is the Bay Area for statewide, regional and cross-county contests", () => {
    expect(contestPlace(prop1, all)).toEqual({ area: null, place: BAY_AREA });
    expect(contestPlace(rtm, all).place).toEqual(BAY_AREA);
    expect(contestPlace(rep15, all).place).toEqual(BAY_AREA);
  });
});
