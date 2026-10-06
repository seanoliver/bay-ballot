import { describe, expect, it } from "vitest";
import { barLegend, barSegments, barShort, barShortParts, barSummary, candidateSlots, slotTone, surname, winnerTone } from "@/lib/bar";
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
  it("leader first; tones never yes/no", () => {
    const segs = bar(race, [e(["Scott Wiener", "Connie Chan"], true), e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(segs).toEqual([
      { key: "Scott Wiener", label: "Scott Wiener", count: 3, pct: 75, tone: "c1" },
      { key: "Connie Chan", label: "Connie Chan", count: 1, pct: 25, tone: "c2" },
    ]);
  });
  it("more than four names: the top four keep their colors, the rest fold into Others", () => {
    const segs = bar(race, [e(["A"]), e(["A"]), e(["B"]), e(["C"]), e(["D"]), e(["E"]), e(["F"])]);
    expect(segs.map((s) => [s.key, s.count, s.tone])).toEqual([
      ["A", 2, "c1"],
      ["B", 1, "c2"],
      ["C", 1, "c3"],
      ["D", 1, "c4"],
      ["others", 2, "other"],
    ]);
    expect(segs.at(-1)?.label).toBe("2 others");
    expect(segs.reduce((n, s) => n + s.pct, 0)).toBe(100);
  });
  it("one leftover reads singular", () => {
    const segs = bar(race, [e(["A"]), e(["B"]), e(["C"]), e(["D"]), e(["E"])]);
    expect(segs.at(-1)).toMatchObject({ key: "others", label: "1 other", tone: "other" });
  });
  it("colors come from the slots passed in, not the current rank", () => {
    const ballot = { ...race, candidates: ["Connie Chan", "Scott Wiener"] } as Contest;
    const slots = candidateSlots(ballot, [e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    const segs = barSegments(tally(ballot, [e(["Scott Wiener"])]), ballot, slots);
    expect(segs).toEqual([{ key: "Scott Wiener", label: "Scott Wiener", count: 1, pct: 100, tone: "c2" }]);
  });
  it("exactly four names keeps all four", () => {
    expect(bar(race, [e(["A"]), e(["B"]), e(["C"]), e(["D"])]).map((s) => s.key)).toEqual(["A", "B", "C", "D"]);
  });
  it("a lone candidate is drawn neutral (no rival to tell apart)", () => {
    expect(bar(race, [e(["Xavier Becerra"]), e(["Xavier Becerra"])])).toEqual([
      { key: "Xavier Becerra", label: "Xavier Becerra", count: 2, pct: 100, tone: "other" },
    ]);
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
      { key: "B", label: "B", count: 2, pct: 50, tone: "c2" },
      { key: "C", label: "C", count: 1, pct: 25, tone: "c3" },
    ]);
  });
  it("fewer names than seats shows only those names", () => {
    expect(bar(board, [e(["A"]), e(["A"])]).map((s) => s.key)).toEqual(["A"]);
  });
});

describe("barSummary", () => {
  it("measure aria counts", () => {
    expect(barSummary(tally(measure, [...ys(5), ...ns(1)]), measure).aria).toBe("Proposition B: 5 Yes, 1 No");
  });
  it("single-seat aria lists every candidate", () => {
    const t = tally(race, [e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(barSummary(t, race).aria).toBe("Supervisor, District 8: Scott Wiener 3, Connie Chan 1");
  });
  it("single-candidate aria says there are no other endorsements", () => {
    expect(barSummary(tally(race, [e(["Xavier Becerra"]), e(["Xavier Becerra"])]), race).aria).toBe(
      "Supervisor, District 8: Xavier Becerra 2, no other endorsements",
    );
  });
  it("multi-seat lists each top name out of the total", () => {
    const t = tally(board, [e(["A", "B"]), e(["A"])]);
    expect(barSummary(t, board).aria).toBe("Board of Education: A 2 of 2, B 1 of 2");
  });
  it("no picks", () => {
    expect(barSummary(tally(measure, []), measure).aria).toBe("Proposition B: no picks yet");
  });
});

describe("barLegend", () => {
  it("measure: the winner's share leads, then one guide count; the loser's % isn't repeated", () => {
    expect(barLegend(tally(measure, [...ys(1), ...ns(15)]), measure)).toEqual({
      lead: { key: "N", label: "No", value: "94%", tone: "no" },
      others: [],
      caption: "15 of 16 guides",
    });
  });
  it("measure split", () => {
    expect(barLegend(tally(measure, [...ys(3), ...ns(3)]), measure)).toEqual({
      lead: { key: "split", label: "Split", value: "3–3", tone: "split" },
      others: [],
      caption: "6 guides",
    });
  });
  it("candidates: leader's share, others' counts, then the guide total", () => {
    const t = tally(race, [...Array(15)].map(() => e(["Scott Wiener"])).concat([...Array(12)].map(() => e(["Connie Chan"]))));
    expect(barLegend(t, race)).toEqual({
      lead: { key: "Scott Wiener", label: "Scott Wiener", value: "56%", tone: "c1" },
      others: [{ key: "Connie Chan", label: "Connie Chan", value: "12", tone: "c2" }],
      caption: "27 guides",
    });
  });
  it("a tie has no lead", () => {
    const l = barLegend(tally(race, [e(["A"]), e(["B"])]), race);
    expect(l.lead).toBeNull();
    expect(l.others.map((o) => [o.label, o.value])).toEqual([["A", "1"], ["B", "1"]]);
    expect(l.caption).toBe("Split · 2 guides");
  });
  it("a single candidate: no %, neutral, and says so", () => {
    expect(barLegend(tally(race, [...Array(13)].map(() => e(["Xavier Becerra"]))), race)).toEqual({
      lead: { key: "Xavier Becerra", label: "Xavier Becerra", value: "", tone: "other" },
      others: [],
      caption: "13 guides, no other endorsements",
    });
  });
  it("no picks", () => {
    expect(barLegend(tally(measure, []), measure)).toEqual({ lead: null, others: [], caption: "No picks yet" });
  });
});

describe("barShortParts", () => {
  it("splits the label (may truncate) from the number (never truncates)", () => {
    expect(barShortParts(tally(measure, [...ys(5), ...ns(1)]), measure)).toEqual({ label: "Yes", value: "83%" });
    const t = tally(race, [e(["Theo Ellington"]), e(["Theo Ellington"]), e(["X"])]);
    expect(barShortParts(t, race)).toEqual({ label: "Ellington", value: "67%" });
    expect(barShortParts(tally(race, [e(["Xavier Becerra"]), e(["Xavier Becerra"])]), race)).toEqual({ label: "Becerra", value: "· 2" });
    expect(barShortParts(tally(board, [e(["A"])]), board)).toEqual({ label: "Top 3", value: "" });
  });
});

describe("barShort", () => {
  it("measure verdicts", () => {
    expect(barShort(tally(measure, [...ys(5), ...ns(1)]), measure)).toBe("Yes 83%");
    expect(barShort(tally(measure, [...ys(1), ...ns(2)]), measure)).toBe("No 67%");
    expect(barShort(tally(measure, [...ys(3), ...ns(3)]), measure)).toBe("Split");
    expect(barShort(tally(measure, []), measure)).toBe("No picks");
  });
  it("a single candidate: surname and count, no %", () => {
    expect(barShort(tally(race, [...Array(13)].map(() => e(["Xavier Becerra"]))), race)).toBe("Becerra · 13");
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

describe("candidateSlots", () => {
  const ballot = (candidates: string[]) => ({ ...race, candidates }) as Contest;
  const slotsOf = (m: Map<string, unknown>) => Object.fromEntries(m);

  it("slots follow ballot order among endorsed candidates, not rank", () => {
    const c = ballot(["Connie Chan", "Scott Wiener", "Nobody Endorsed"]);
    const m = candidateSlots(c, [e(["Scott Wiener"]), e(["Scott Wiener"]), e(["Connie Chan"])]);
    expect(slotsOf(m)).toEqual({ "Connie Chan": 1, "Scott Wiener": 2 });
  });
  it("names missing from the ballot list follow it, by count then name", () => {
    const c = ballot(["B"]);
    expect(slotsOf(candidateSlots(c, [e(["Z"]), e(["Y"]), e(["Y"]), e(["B"])]))).toEqual({ B: 1, Y: 2, Z: 3 });
  });
  it("more than four: the top four by count keep slots (in ballot order), the rest are other", () => {
    const c = ballot(["E", "D", "C", "B", "A"]);
    const m = candidateSlots(c, [e(["A"]), e(["A"]), e(["B"]), e(["B"]), e(["C"]), e(["C"]), e(["D"]), e(["D"]), e(["E"])]);
    expect(slotsOf(m)).toEqual({ D: 1, C: 2, B: 3, A: 4, E: "other" });
  });
  it("a ranked single-seat pick counts only its #1", () => {
    const m = candidateSlots(ballot(["A", "B"]), [e(["B", "A"], true), e(["C"])]);
    expect(slotsOf(m)).toEqual({ B: 1, C: 2 });
  });
  it("a lone endorsed candidate has no slot color (neutral)", () => {
    expect(slotsOf(candidateSlots(ballot(["A", "B"]), [e(["A"]), e(["A"])]))).toEqual({ A: "other" });
  });
  it("no endorsements, no slots", () => {
    expect(candidateSlots(ballot(["A"]), []).size).toBe(0);
  });
});

describe("slotTone", () => {
  it("maps slots to tones; unknown names are other", () => {
    const m = new Map<string, 1 | 2 | 3 | 4 | "other">([["A", 3], ["B", "other"]]);
    expect([slotTone(m, "A"), slotTone(m, "B"), slotTone(m, "C")]).toEqual(["c3", "other", "other"]);
  });
});

describe("winnerTone", () => {
  it("colors a measure by its winner, not the first segment", () => {
    expect(winnerTone(tally(measure, [...ys(1), ...ns(5)]))).toBe("no");
    expect(winnerTone(tally(measure, [...ys(5), ...ns(1)]))).toBe("yes");
    expect(winnerTone(tally(measure, [...ys(3), ...ns(3)]))).toBe("split");
    expect(winnerTone(tally(measure, ns(4)))).toBe("no");
  });
  it("none for empty measures and for candidate races", () => {
    expect(winnerTone(tally(measure, []))).toBeNull();
    expect(winnerTone(tally(race, [e(["A"])]))).toBeNull();
  });
});
