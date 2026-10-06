import { describe, expect, it } from "vitest";
import { countyOptions, countySlug, hiddenCountiesLabel, hiddenCountyOf, parseCounties, showCountyFilter, toCountiesParam, toggleCounty, visibleGroups } from "@/lib/counties";
import { placeGroups } from "@/lib/areas";
import { mpP, PA, prop1, propB, rtm, sccA, SF, SM, smL } from "./fixtures/areas";

const groups = placeGroups([prop1, rtm, propB, smL, mpP, sccA], [SF, SM, PA]);
const options = countyOptions(groups);

describe("county filter", () => {
  it("slugs county names", () => {
    expect(countySlug("San Mateo")).toBe("san-mateo");
    expect(countySlug("San Francisco")).toBe("san-francisco");
  });
  it("offers each county with local contests, in list order", () => {
    expect(options).toEqual([
      { id: "san-francisco", name: "San Francisco" },
      { id: "san-mateo", name: "San Mateo" },
      { id: "santa-clara", name: "Santa Clara" },
    ]);
    expect(showCountyFilter(options)).toBe(true);
    expect(showCountyFilter(countyOptions(placeGroups([prop1, propB], [SF])))).toBe(false);
  });
  it("parses the URL value, dropping unknown counties", () => {
    expect(parseCounties("santa-clara,nowhere,san-mateo", options)).toEqual(["san-mateo", "santa-clara"]);
    expect(parseCounties(null, options)).toEqual([]);
    expect(toCountiesParam(["santa-clara", "san-mateo"])).toBe("san-mateo,santa-clara");
  });
  it("toggles a county", () => {
    expect(toggleCounty([], "san-mateo")).toEqual(["san-mateo"]);
    expect(toggleCounty(["san-mateo"], "san-mateo")).toEqual([]);
  });
  it("hides a county's county and city groups and always keeps California and the Bay Area measure", () => {
    expect(visibleGroups(groups, ["san-mateo"]).map((g) => g.heading)).toEqual(["California", "Bay Area", "San Francisco", "Santa Clara County"]);
    expect(visibleGroups(groups, options.map((o) => o.id)).map((g) => g.heading)).toEqual(["California", "Bay Area"]);
  });
  it("finds the hidden county that holds a linked contest", () => {
    expect(hiddenCountyOf(groups, ["san-mateo"], "menlo-park-measure-p")).toEqual({ id: "san-mateo", name: "San Mateo" });
    expect(hiddenCountyOf(groups, ["santa-clara"], "menlo-park-measure-p")).toBeNull();
    expect(hiddenCountyOf(groups, ["san-mateo"], "prop-1")).toBeNull();
    expect(hiddenCountyOf(groups, ["san-mateo"], null)).toBeNull();
  });
  it("labels hidden counties for the phone Filters button", () => {
    expect(hiddenCountiesLabel(0)).toBe("");
    expect(hiddenCountiesLabel(1)).toBe("1 county hidden");
    expect(hiddenCountiesLabel(2)).toBe("2 counties hidden");
  });
});
