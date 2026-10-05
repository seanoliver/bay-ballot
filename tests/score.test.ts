import { describe, expect, it } from "vitest";
import { tally } from "@/lib/score";
import type { Contest, Entry } from "@/lib/schema";

const measure = { id: "prop-b", kind: "measure", seats: 1, candidates: [] } as unknown as Contest;
const retention = { id: "judge", kind: "retention", seats: 1, candidates: [] } as unknown as Contest;
const race = { id: "sup-d8", kind: "candidate", seats: 1, candidates: ["A", "B", "C"] } as unknown as Contest;
const board = { id: "boe", kind: "candidate", seats: 3, candidates: ["A", "B", "C", "D"] } as unknown as Contest;
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
    expect(t.kind === "candidate" && t.counts.find((c) => c.name === "C")).toBeFalsy();
  });
  it("dual endorsement counts both names", () => {
    const t = tally(race, [e(["A", "B"]), e(["A"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2 });
    expect(t.kind === "candidate" && t.counts.find((c) => c.name === "B")?.count).toBe(1);
  });
  it("candidate tie is split", () => {
    expect(tally(race, [e(["A"]), e(["B"])])).toMatchObject({ split: true });
  });
  it("multi-seat counts every name", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "D"])]);
    expect(t).toMatchObject({ leader: "A", count: 2, total: 2, pct: 100 });
  });
  it("duplicate name in one entry counts once", () => {
    const t = tally(board, [e(["A", "A", "B"])]);
    expect(t.kind === "candidate" && t.counts.find((c) => c.name === "A")?.count).toBe(1);
  });
  it("empty candidate input", () => {
    expect(tally(race, [])).toMatchObject({ kind: "candidate", total: 0, leader: null, pct: 0, split: false });
  });
});
