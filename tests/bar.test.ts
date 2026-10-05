import { describe, expect, it } from "vitest";
import { barSegments, barShort, barSummary, surname } from "@/lib/bar";
import { tally } from "@/lib/score";
import type { Contest, Entry } from "@/lib/schema";

const measure = { id: "prop-b", title: "Proposition B", kind: "measure", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const retention = { id: "groban", title: "Justice Groban", kind: "retention", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const race = { id: "sup-8", title: "Supervisor, District 8", kind: "candidate", seats: 1, candidates: [], rankedChoice: true } as unknown as Contest;
const board = { id: "boe", title: "Board of Education", kind: "candidate", seats: 3, candidates: [], rankedChoice: false } as unknown as Contest;

const e = (pick: Entry["pick"], ranked = false): Entry => ({ pick, ranked, quotes: [] });
const ys = (n: number) => Array.from({ length: n }, () => e("Y"));
const ns = (n: number) => Array.from({ length: n }, () => e("N"));
const bar = (c: Contest, entries: Entry[]) => barSegments(tally(c, entries), c);

describe("barSegments: measures", () => {
  it("yes then no, widths by count, percents sum to 100", () => {
    expect(bar(measure, [...ys(5), ...ns(1)])).toEqual([
      { key: "Y", label: "Yes 83%", count: 5, pct: 83, tone: "yes" },
      { key: "N", label: "No 17%", count: 1, pct: 17, tone: "no" },
    ]);
  });
  it("rounds so the stack always fills exactly 100", () => {
    const segs = bar(measure, [...ys(2), ...ns(1)]);
    expect(segs.map((s) => s.pct)).toEqual([67, 33]);
    expect(segs.reduce((n, s) => n + s.pct, 0)).toBe(100);
  });
  it("unanimous drops the empty side", () => {
    expect(bar(retention, ys(4))).toEqual([{ key: "Y", label: "Yes 100%", count: 4, pct: 100, tone: "yes" }]);
  });
  it("split is two equal halves", () => {
    expect(bar(measure, [...ys(3), ...ns(3)])).toEqual([
      { key: "Y", label: "Yes 50%", count: 3, pct: 50, tone: "yes" },
      { key: "N", label: "No 50%", count: 3, pct: 50, tone: "no" },
    ]);
  });
  it("no picks is one muted empty segment", () => {
    expect(bar(measure, [])).toEqual([{ key: "none", label: "No picks yet", count: 0, pct: 100, tone: "empty" }]);
  });
});

describe("barSegments: single-seat candidates", () => {
  it("leader first, neutral-to-accent tones, never yes/no", () => {
    const segs = bar(race, [e(["Scott Wiener", "Connie Chan"], true), e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(segs).toEqual([
      { key: "Scott Wiener", label: "Scott Wiener", count: 3, pct: 75, tone: "c1" },
      { key: "Connie Chan", label: "Connie Chan", count: 1, pct: 25, tone: "c2" },
    ]);
  });
  it("more than four names folds the tail into Others", () => {
    const segs = bar(race, [e(["A"]), e(["A"]), e(["B"]), e(["C"]), e(["D"]), e(["E"])]);
    expect(segs.map((s) => [s.key, s.count, s.tone])).toEqual([
      ["A", 2, "c1"],
      ["B", 1, "c2"],
      ["C", 1, "c3"],
      ["others", 2, "c4"],
    ]);
    expect(segs.at(-1)?.label).toBe("2 others");
    expect(segs.reduce((n, s) => n + s.pct, 0)).toBe(100);
  });
  it("exactly four names keeps all four", () => {
    expect(bar(race, [e(["A"]), e(["B"]), e(["C"]), e(["D"])]).map((s) => s.key)).toEqual(["A", "B", "C", "D"]);
  });
  it("no picks", () => {
    expect(bar(race, [])).toEqual([{ key: "none", label: "No picks yet", count: 0, pct: 100, tone: "empty" }]);
  });
});

describe("barSegments: multi-seat", () => {
  it("up to `seats` independent bars, each filled count of total guides", () => {
    const segs = bar(board, [e(["A", "B", "C"]), e(["A", "B", "D"]), e(["A", "E"]), e(["A"])]);
    expect(segs).toEqual([
      { key: "A", label: "A", count: 4, pct: 100, tone: "c1" },
      { key: "B", label: "B", count: 2, pct: 50, tone: "c1" },
      { key: "C", label: "C", count: 1, pct: 25, tone: "c1" },
    ]);
  });
  it("fewer names than seats shows only those names", () => {
    expect(bar(board, [e(["A"]), e(["A"])]).map((s) => s.key)).toEqual(["A"]);
  });
});

describe("barSummary", () => {
  it("measure: aria counts and visible guide count", () => {
    expect(barSummary(tally(measure, [...ys(5), ...ns(1)]), measure)).toEqual({
      aria: "Proposition B: 5 Yes, 1 No",
      caption: "5 of 6 guides",
    });
  });
  it("measure split", () => {
    expect(barSummary(tally(measure, [...ys(3), ...ns(3)]), measure)).toEqual({
      aria: "Proposition B: 3 Yes, 3 No",
      caption: "Split 3–3",
    });
  });
  it("single-seat legend", () => {
    const t = tally(race, [e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(barSummary(t, race)).toEqual({
      aria: "Supervisor, District 8: Scott Wiener 3, Connie Chan 1",
      caption: "Scott Wiener 3 · Connie Chan 1",
    });
  });
  it("multi-seat lists each top name out of the total", () => {
    const t = tally(board, [e(["A", "B"]), e(["A"])]);
    expect(barSummary(t, board)).toEqual({ aria: "Board of Education: A 2 of 2, B 1 of 2", caption: "2 guides" });
  });
  it("no picks", () => {
    expect(barSummary(tally(measure, []), measure)).toEqual({ aria: "Proposition B: no picks yet", caption: "No picks yet" });
  });
});

describe("barShort", () => {
  it("measure verdicts", () => {
    expect(barShort(tally(measure, [...ys(5), ...ns(1)]), measure)).toBe("Yes 83%");
    expect(barShort(tally(measure, [...ys(1), ...ns(2)]), measure)).toBe("No 67%");
    expect(barShort(tally(measure, [...ys(3), ...ns(3)]), measure)).toBe("Split");
    expect(barShort(tally(measure, []), measure)).toBe("No picks");
  });
  it("single-seat leader by surname and share of guides, or a tie", () => {
    const t = tally(race, [e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(barShort(t, race)).toBe("Wiener 75%");
    expect(barShort(tally(race, [e(["A"]), e(["B"])]), race)).toBe("Split");
  });
  it("multi-seat says how many seats", () => {
    expect(barShort(tally(board, [e(["A", "B", "C", "D"]), e(["A", "B", "C"])]), board)).toBe("Top 3");
  });
});

describe("surname", () => {
  it.each([
    ["Scott Wiener", "Wiener"],
    ["Dionjay (DJ) Brookter", "Brookter"],
    ['Emanuel "Manny" Yekutiel', "Yekutiel"],
    ["Martin Luther King Jr.", "King"],
    ["John Smith, III", "Smith"],
    ["J.R. Eppler", "Eppler"],
    ["Madonna", "Madonna"],
  ])("%s -> %s", (name, want) => {
    expect(surname(name)).toBe(want);
  });
});
