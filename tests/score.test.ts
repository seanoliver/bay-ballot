import { describe, expect, it } from "vitest";
import { countedNames, tally } from "@/lib/score";
import type { Contest, Entry } from "@/lib/schema";
import type { Tally } from "@/lib/score";

const measure = { id: "prop-b", kind: "measure", seats: 1, candidates: [] } as unknown as Contest;
const retention = { id: "judge", kind: "retention", seats: 1, candidates: [] } as unknown as Contest;
const race = { id: "sup-d8", kind: "candidate", seats: 1, candidates: ["A", "B", "C"] } as unknown as Contest;
const board = { id: "boe", kind: "candidate", seats: 3, candidates: ["A", "B", "C", "D"] } as unknown as Contest;
const cand = (t: Tally) => {
  if (t.kind !== "candidate") throw new Error("expected candidate tally");
  return t;
};
const e = (pick: Entry["pick"], ranked = false): Entry => ({ pick, ranked, quotes: [] });

describe("tally", () => {
  it("measure majority", () => {
    expect(tally(measure, [e("Y"), e("Y"), e("N")])).toMatchObject({ kind: "measure", yes: 2, no: 1, total: 3, verdict: "Y", pct: 67 });
  });
  it("measure tie is split", () => {
    expect(tally(measure, [e("Y"), e("N")])).toMatchObject({ verdict: "split" });
  });
  it("empty input", () => {
    expect(tally(measure, [])).toMatchObject({ total: 0, verdict: "none" });
  });
  it("retention contest behaves like a measure", () => {
    expect(tally(retention, [e("N"), e("N"), e("Y")])).toMatchObject({ kind: "measure", verdict: "N", pct: 67 });
  });
  it("single seat leader", () => {
    expect(tally(race, [e(["A"]), e(["A"]), e(["B"])])).toMatchObject({ kind: "candidate", leader: "A", count: 2, total: 3, pct: 67, split: false, leaderRanked: false });
  });
  it("ranked pick counts #1 only and flags leaderRanked", () => {
    const t = tally(race, [e(["B", "C"], true), e(["B"]), e(["A"])]);
    expect(t).toMatchObject({ leader: "B", count: 2, total: 3, leaderRanked: true });
    expect(cand(t).counts.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });
  it("dual endorsement counts both names", () => {
    const t = tally(race, [e(["A", "B"]), e(["A"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2 });
    expect(cand(t).counts.find((c) => c.name === "B")?.count).toBe(1);
  });
  it("candidate tie is split", () => {
    expect(tally(race, [e(["A"]), e(["B"])])).toMatchObject({
      split: true, leader: null, tied: ["A", "B"], count: 0, pct: 0, leaderRanked: false,
    });
  });
  it("tie including a ranked entry has leaderRanked false", () => {
    expect(tally(race, [e(["A"], true), e(["B"])])).toMatchObject({ split: true, leader: null, leaderRanked: false });
  });
  it("non-split has empty tied", () => {
    expect(cand(tally(race, [e(["A"]), e(["A"]), e(["B"])])).tied).toEqual([]);
  });
  it("wrong-shape candidate entry does not change total", () => {
    expect(tally(race, [e(["A"]), e("Y")])).toMatchObject({ total: 1, leader: "A", pct: 100 });
  });
  it("wrong-shape measure entry does not change total", () => {
    expect(tally(measure, [e("Y"), e(["A"])])).toMatchObject({ total: 1, yes: 1, pct: 100 });
  });
  it("multi-seat counts every name", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "D"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2, pct: 100 });
  });
  it("duplicate name in one entry counts once", () => {
    const t = tally(board, [e(["A", "A", "B"])]);
    expect(cand(t).counts.find((c) => c.name === "A")?.count).toBe(1);
  });
  it("empty candidate input", () => {
    expect(tally(race, [])).toMatchObject({ kind: "candidate", total: 0, leader: null, pct: 0, split: false });
  });
});

describe("countedNames", () => {
  it("non-array pick gives no names", () => {
    expect(countedNames(measure, e("Y"))).toEqual([]);
  });
  it("ranked single-seat counts first name only", () => {
    expect(countedNames(race, e(["A", "B"], true))).toEqual(["A"]);
  });
  it("unranked single-seat counts all names", () => {
    expect(countedNames(race, e(["A", "B"]))).toEqual(["A", "B"]);
  });
  it("ranked multi-seat counts all names", () => {
    expect(countedNames(board, e(["A", "B", "C"], true))).toEqual(["A", "B", "C"]);
  });
});

describe("tally with partial ranking", () => {
  it("still counts only the #1 name of a partially ranked pick", () => {
    const partial: Entry = { pick: ["A", "B", "C"], ranked: true, rankedCount: 1, quotes: [] };
    const t = cand(tally(race, [partial]));
    expect(t.counts.map((c) => [c.name, c.count])).toEqual([["A", 1]]);
  });
});
