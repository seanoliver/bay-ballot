import { describe, expect, it } from "vitest";
import { myBallotIndex, myBallotText, myPickLabel, pageSlug, parseMyBallot, pickArea, setPick, tapCandidate, type MyBallot } from "@/lib/my-ballot";
import { election, myBallotData, myBallotUrl } from "@/lib/site-data";
import type { Area, Contest } from "@/lib/schema";

const RANKED = { seats: 1, rankedChoice: true };
const BOARD = { seats: 3, rankedChoice: false };
const ONE = { seats: 1, rankedChoice: false };

describe("parseMyBallot", () => {
  it("reads a saved ballot", () => {
    expect(parseMyBallot('{"started":true,"picks":{"prop-1":"Y","supervisor-8":["Gary McCoy"]}}')).toEqual({
      started: true,
      picks: { "prop-1": "Y", "supervisor-8": ["Gary McCoy"] },
    });
  });

  it("drops picks that aren't a pick, and survives junk", () => {
    expect(parseMyBallot('{"started":"yes","picks":{"a":"maybe","b":[],"c":[1],"d":"blank"}}')).toEqual({ started: false, picks: { d: "blank" } });
    expect(parseMyBallot("not json")).toEqual({ started: false, picks: {} });
    expect(parseMyBallot(null)).toEqual({ started: false, picks: {} });
    expect(parseMyBallot("[]")).toEqual({ started: false, picks: {} });
  });
});

describe("setPick", () => {
  const b: MyBallot = { started: true, picks: { "prop-1": "Y" } };
  it("sets, replaces, and clears", () => {
    expect(setPick(b, "prop-2", "N").picks).toEqual({ "prop-1": "Y", "prop-2": "N" });
    expect(setPick(b, "prop-1", "N").picks).toEqual({ "prop-1": "N" });
    expect(setPick(b, "prop-1", null).picks).toEqual({});
    expect(setPick(b, "prop-1", []).picks).toEqual({});
  });
});

describe("tapCandidate", () => {
  it("ranks in tap order and closes the gap on removal", () => {
    let p = tapCandidate(undefined, "A", RANKED);
    p = tapCandidate(p, "B", RANKED);
    p = tapCandidate(p, "C", RANKED);
    expect(p).toEqual(["A", "B", "C"]);
    expect(tapCandidate(p, "B", RANKED)).toEqual(["A", "C"]);
  });

  it("caps a vote-for-N board at N", () => {
    expect(tapCandidate(["A", "B", "C"], "D", BOARD)).toEqual(["A", "B", "C"]);
    expect(tapCandidate(["A", "B"], "D", BOARD)).toEqual(["A", "B", "D"]);
  });

  it("swaps a pick-one race, and clears on a second tap", () => {
    expect(tapCandidate(["A"], "B", ONE)).toEqual(["B"]);
    expect(tapCandidate(["A"], "A", ONE)).toEqual([]);
  });

  it("starts from nothing when the contest was left blank", () => {
    expect(tapCandidate("blank", "A", ONE)).toEqual(["A"]);
  });
});

describe("myPickLabel", () => {
  it("labels each kind of pick", () => {
    expect(myPickLabel("Y")).toBe("Yes");
    expect(myPickLabel("blank")).toBe("Leaving blank");
    expect(myPickLabel(["Gary McCoy", "Michael T. Nguyen"], { ranked: true })).toBe("1. McCoy · 2. Nguyen");
    expect(myPickLabel(["Virginia Cheung", "Reina Tello"])).toBe("Cheung, Tello");
    expect(myPickLabel(["Gary McCoy"], { short: false })).toBe("Gary McCoy");
  });
});

const SF: Area = { id: "sf", name: "San Francisco", kind: "city", jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "San Francisco" }, { level: "city", name: "San Francisco" }] };
const OAK: Area = { id: "oakland", name: "Oakland", kind: "city", jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: "Alameda" }, { level: "city", name: "Oakland" }] };
const contest = (c: Partial<Contest> & Pick<Contest, "id" | "title" | "section" | "jurisdiction">): Contest =>
  ({ kind: "measure", candidates: [], seats: 1, rankedChoice: false, ...c }) as Contest;
const CONTESTS = [
  contest({ id: "prop-1", title: "Proposition 1", section: "State propositions", jurisdiction: { level: "state", name: "California" } }),
  contest({ id: "prop-a", title: "Proposition A", section: "Local propositions", jurisdiction: { level: "city", name: "San Francisco" } }),
  contest({ id: "measure-x", title: "Measure X", section: "Local propositions", jurisdiction: { level: "city", name: "Oakland" } }),
  contest({ id: "assessor", title: "Assessor-Recorder", section: "Local candidates", kind: "candidate", candidates: ["Joaquín Torres"], rankedChoice: true, jurisdiction: { level: "city", name: "San Francisco" } }),
];

describe("myBallotIndex", () => {
  const index = myBallotIndex(CONTESTS, [SF, OAK]);
  it("lists each area's contests in ballot order", () => {
    expect(index.areas.sf.groups.flatMap((g) => g.sections.flatMap((s) => s.ids))).toEqual(["prop-1", "prop-a", "assessor"]);
    expect(index.areas.oakland.groups.flatMap((g) => g.sections.flatMap((s) => s.ids))).toEqual(["prop-1", "measure-x"]);
  });

  it("notes a contest's own area, and none for a statewide one", () => {
    expect(index.contests["prop-a"]).toEqual({ title: "Proposition A", ranked: false, area: "sf" });
    expect(index.contests.assessor.ranked).toBe(true);
    expect(index.contests["prop-1"].area).toBeUndefined();
  });

  it("copies picks as text in ballot order, with picks from other areas last", () => {
    const b: MyBallot = { started: true, picks: { "prop-a": "N", "prop-1": "Y", "measure-x": "blank", assessor: ["Joaquín Torres"] } };
    expect(myBallotText(b, index, index.areas.sf.groups, "Your ballot · San Francisco")).toBe(
      ["Your ballot · San Francisco", "California\nProposition 1: Yes", "San Francisco\nProposition A: No\nAssessor-Recorder: 1. Joaquín Torres", "Other\nMeasure X: Leaving blank"].join("\n\n"),
    );
  });
});

describe("pickArea", () => {
  const index = myBallotIndex(CONTESTS, [SF, OAK]);
  it("prefers a remembered area, then the page's area, then the contest's own", () => {
    expect(pickArea(index, "prop-1", ["oakland", "sf"])).toEqual({ area: "oakland", here: "prop-1" });
    expect(pickArea(index, "sf", ["oakland", null])).toEqual({ area: "oakland", here: null });
    expect(pickArea(index, "sf", [null, "bay-area"])).toEqual({ area: "sf", here: null });
    expect(pickArea(index, "prop-a", [null, null])).toEqual({ area: "sf", here: "prop-a" });
    expect(pickArea(index, "prop-1", [null, "bay-area"])).toEqual({ area: null, here: "prop-1" });
  });

  it("ignores keys inherited from Object", () => {
    expect(pickArea(index, "constructor", ["toString", "__proto__"])).toEqual({ area: null, here: null });
  });
});

describe("pageSlug", () => {
  it("reads one segment under the election, and nothing deeper", () => {
    expect(pageSlug("2026-11", "/2026-11/prop-5")).toBe("prop-5");
    expect(pageSlug("2026-11", "/2026-11")).toBeNull();
    expect(pageSlug("2026-11", "/guides/spur")).toBeNull();
    expect(pageSlug("2026-11", "/2026-11/prop-5/extra")).toBeNull();
  });
});

describe("my-ballot.json", () => {
  const d = election("2026-11")!;
  it("covers every area and contest, versioned by content", () => {
    const data = myBallotData(d);
    expect(Object.keys(data.areas).sort()).toEqual(d.areas.map((a) => a.id).sort());
    expect(Object.keys(data.contests)).toHaveLength(d.ballot.contests.length);
    expect(myBallotUrl(d)).toMatch(/^\/2026-11\/my-ballot\.json\?v=[0-9a-f]{10}$/);
  });
});
