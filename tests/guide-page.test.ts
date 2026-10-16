import { describe, expect, it } from "vitest";
import { guideBallot, guidePickGroups, guideStats } from "@/lib/guide-page";
import type { Area, Contest, EndorsementFile, Entry } from "@/lib/schema";
import { c, PA, prop1, propB, rtm, SF, SM, smL, sup8 } from "./fixtures/areas";

const withSection = (x: Contest, section: string): Contest => ({ ...x, section });
const yes = (quotes = 0): Entry => ({ pick: "Y", quotes: Array.from({ length: quotes }, () => ({ text: "Because.", source: "https://example.com" })) }) as Entry;
const file = (picks: Record<string, Entry>, hasReasoning = true) => ({ picks, hasReasoning }) as unknown as EndorsementFile;

const SMC: Area = { ...SM, id: "san-mateo" };
const areas = [SF, SMC, PA];

describe("guidePickGroups", () => {
  const contests = [
    withSection(prop1, "State propositions"),
    withSection(rtm, "Regional measures"),
    withSection(sup8, "Local candidates"),
    withSection(propB, "Local propositions"),
    withSection(c("prop-c", { level: "city", name: "San Francisco" }), "Local propositions"),
    withSection(smL, "Local measures"),
  ];

  it("groups picks under the ballot's place and section headings, in ballot order", () => {
    const groups = guidePickGroups(contests, file({ "prop-c": yes(), "prop-b": yes(), "prop-1": yes(), "supervisor-8": yes() }), areas);
    expect(groups.map((g) => [g.heading, g.sections.map((s) => [s.name, s.picks.map((p) => p.contest.id)])])).toEqual([
      ["California", [["State propositions", ["prop-1"]]]],
      ["San Francisco", [["Local candidates", ["supervisor-8"]], ["Local propositions", ["prop-b", "prop-c"]]]],
    ]);
  });

  it("leaves out sections and places the guide made no pick in", () => {
    const groups = guidePickGroups(contests, file({ "san-mateo-county-measure-l": yes() }), areas);
    expect(groups.map((g) => g.heading)).toEqual(["San Mateo County"]);
    expect(groups[0].sections.map((s) => s.name)).toEqual(["Local measures"]);
  });
});

describe("guideBallot", () => {
  it("links a one-area guide to that area's ballot", () => {
    expect(guideBallot({ areas: ["sf"] }, areas, "2026-11")).toEqual({ href: "/2026-11/sf", label: "San Francisco ballot" });
  });
  it("links a guide spanning counties to the Bay Area ballot", () => {
    expect(guideBallot({ areas: ["sf", "san-mateo"] }, areas, "2026-11")).toEqual({ href: "/2026-11", label: "Bay Area ballot" });
  });
  it("links a guide whose areas share a county to that county's page", () => {
    const sc: Area = { id: "santa-clara-county", name: "Santa Clara County", kind: "county", jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "Santa Clara" }] };
    expect(guideBallot({ areas: ["palo-alto", "santa-clara-county"] }, [...areas, sc], "2026-11")).toEqual({ href: "/2026-11/santa-clara-county", label: "Santa Clara County ballot" });
  });
});

describe("guideStats", () => {
  const picks = guidePickGroups([prop1, propB], file({ "prop-1": yes(1), "prop-b": yes() }), areas).flatMap((g) => g.sections.flatMap((s) => s.picks));
  it("counts picks and the ones with reasons", () => {
    expect(guideStats(picks, { hasReasoning: true })).toEqual({ picks: 2, withReasons: 1 });
  });
  it("has no reasons count for a list-only guide", () => {
    expect(guideStats(picks, { hasReasoning: false })).toEqual({ picks: 2, withReasons: null });
  });
});
