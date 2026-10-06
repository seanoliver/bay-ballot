import { describe, expect, it } from "vitest";
import { mostPositions, shareCard, shareDescription, shortTitle } from "@/lib/share";
import type { Row } from "@/lib/filters";
import type { Contest, Entry } from "@/lib/schema";

const contest = (over: Partial<Contest>) =>
  ({ id: "x", section: "Local", title: "Proposition B", kind: "measure", seats: 1, candidates: [], rankedChoice: false, ...over }) as Contest;
const measure = contest({ id: "prop-b", title: "Proposition B", description: "Establishing a Municipal Finance Corporation and a Public Bank" });
const race = contest({ id: "us-rep-11", title: "United States Representative, District 11", kind: "candidate", candidates: ["Connie Chan", "Scott Wiener"] });
const rcv = contest({ id: "supervisor-8", title: "Board of Supervisors, District 8", kind: "candidate", candidates: ["A B", "C D"], rankedChoice: true });
const board = contest({ id: "boe", title: "Board of Education", kind: "candidate", seats: 3, candidates: [] });

let n = 0;
const row = (pick: Entry["pick"], ranked = false): Row => {
  n += 1;
  return { guide: { id: `g${n}`, name: `Guide ${n}`, type: "club" }, entry: { pick, ranked, quotes: [] }, file: { hasReasoning: true, picks: {} } };
};
const many = (k: number, pick: Entry["pick"], ranked = false) => Array.from({ length: k }, () => row(pick, ranked));

describe("shortTitle", () => {
  it("shortens common long forms", () => {
    expect(shortTitle("Proposition B")).toBe("Prop B");
    expect(shortTitle("United States Representative, District 11")).toBe("U.S. Rep., District 11");
    expect(shortTitle("Board of Supervisors, District 8")).toBe("Supervisor, District 8");
    expect(shortTitle("Board of Education")).toBe("Board of Education");
  });
  it("caps very long titles at a word boundary", () => {
    const t = shortTitle("Supreme Court Associate Justice Joshua Groban and a Few More Words That Go On and On Forever");
    expect(t.length).toBeLessThanOrEqual(56);
    expect(t.endsWith("…")).toBe(true);
    expect(t).not.toMatch(/\s…$/);
  });
});

describe("shareCard", () => {
  it("measure: winner's share leads, its count of the total is the sub line", () => {
    const card = shareCard(measure, [...many(16, "Y"), ...many(12, "N")]);
    expect(card).toMatchObject({
      title: "Prop B",
      kicker: "Establishing a Municipal Finance Corporation and a Public Bank",
      lead: "Yes 57%",
      leadTone: "yes",
      sub: "16 of 28 guides",
      ranked: false,
      multi: false,
    });
    expect(card.segments.map((s) => [s.key, s.count, s.tone])).toEqual([
      ["Y", 16, "yes"],
      ["N", 12, "no"],
    ]);
    expect(card.legend).toEqual([
      { label: "Yes", count: 16, tone: "yes" },
      { label: "No", count: 12, tone: "no" },
    ]);
  });
  it("single seat: the leader's share, surnames in the legend, slot colors", () => {
    const card = shareCard(race, [...many(15, ["Scott Wiener"]), ...many(12, ["Connie Chan"])]);
    expect(card).toMatchObject({ title: "U.S. Rep., District 11", lead: "Scott Wiener 56%", leadTone: "candidate", sub: "15 of 27 guides" });
    expect(card.legend).toEqual([
      { label: "Wiener", count: 15, tone: "c2" },
      { label: "Chan", count: 12, tone: "c1" },
    ]);
  });
  it("marks ranked leads as the site does", () => {
    expect(shareCard(rcv, [...many(2, ["A B", "C D"], true), row(["C D"])]).ranked).toBe(true);
  });
  it("tie: Split with the guide total", () => {
    const card = shareCard(measure, [...many(3, "Y"), ...many(3, "N")]);
    expect(card).toMatchObject({ lead: "Split", leadTone: "split", sub: "6 guides" });
    expect(shareCard(race, [row(["Scott Wiener"]), row(["Connie Chan"])])).toMatchObject({ lead: "Split", sub: "2 guides" });
  });
  it("one endorsed candidate: no share, neutral, and says so", () => {
    const card = shareCard(race, many(13, ["Scott Wiener"]));
    expect(card).toMatchObject({ lead: "Scott Wiener", sub: "13 guides, no other endorsements" });
    expect(card.segments.map((s) => s.tone)).toEqual(["other"]);
  });
  it("multi-seat: the top `seats` names as rows with their share of guides", () => {
    const card = shareCard(board, [row(["W", "X", "Y", "Z"]), row(["W", "X", "Y"]), row(["W", "X"]), row(["W"])]);
    expect(card).toMatchObject({ lead: "Top 3 of 4 candidates", sub: "4 guides", multi: true });
    expect(card.seats).toEqual([
      { label: "W", count: 4, pct: 100, tone: "c1" },
      { label: "X", count: 3, pct: 75, tone: "c2" },
      { label: "Y", count: 2, pct: 50, tone: "c3" },
    ]);
  });
  it("no positions", () => {
    const card = shareCard(measure, []);
    expect(card).toMatchObject({ lead: null, leadTone: "none", sub: "No guide has taken a position yet", segments: [], legend: [] });
  });
});

describe("shareDescription", () => {
  it("states the result in one line", () => {
    expect(shareDescription(shareCard(measure, [...many(16, "Y"), ...many(12, "N")]))).toBe("Prop B: Yes 57% of 28 SF voter guides");
    expect(shareDescription(shareCard(race, [...many(15, ["Scott Wiener"]), ...many(12, ["Connie Chan"])]))).toBe(
      "U.S. Rep., District 11: Scott Wiener 56% of 27 SF voter guides",
    );
    expect(shareDescription(shareCard(measure, [...many(3, "Y"), ...many(3, "N")]))).toBe("Prop B: split among 6 SF voter guides");
    expect(shareDescription(shareCard(race, many(13, ["Scott Wiener"])))).toBe("U.S. Rep., District 11: Scott Wiener, endorsed by 13 SF voter guides");
    expect(shareDescription(shareCard(board, [row(["W", "X", "Y"])]))).toBe("Board of Education: W, X, Y lead among 1 SF voter guide");
    expect(shareDescription(shareCard(measure, []))).toBe("Prop B: no SF voter guide has taken a position yet");
  });
});

describe("mostPositions", () => {
  it("picks the contest with the most guides taking a position, first on ties", () => {
    const rowsFor = (id: string) => (id === "b" ? many(3, "Y") : many(2, "Y"));
    expect(mostPositions([contest({ id: "a" }), contest({ id: "b" }), contest({ id: "c" })], rowsFor)?.id).toBe("b");
  });
});
