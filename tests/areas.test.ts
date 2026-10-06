import { describe, expect, it } from "vitest";
import { areaGuides, areaLinks, areasOf, BAY_AREA, contestArea, inArea, placeName } from "@/lib/areas";
import type { Area } from "@/lib/schema";
import { c, mpP, PA, prop1, propB, rc2, rep15, rtm, sccA, SF, SM, sup8 } from "./fixtures/areas";

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
