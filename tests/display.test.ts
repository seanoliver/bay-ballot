import { describe, expect, it } from "vitest";
import { groupByPick, headline, officialLink, pendingNote, sourceLink, rankedDetails, topPicks } from "@/lib/display";
import { tally } from "@/lib/score";
import type { Contest, Entry, Guide } from "@/lib/schema";
import type { Row } from "@/lib/filters";

const measure = { id: "prop-c", kind: "measure", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const race = { id: "sup-d8", kind: "candidate", seats: 1, candidates: [], rankedChoice: true } as unknown as Contest;
const board = { id: "boe", kind: "candidate", seats: 3, candidates: [], rankedChoice: false } as unknown as Contest;

const e = (pick: Entry["pick"], ranked = false): Entry => ({ pick, ranked, quotes: [] });
const row = (name: string, entry: Entry): Row =>
  ({ guide: { id: name.toLowerCase(), name } as Guide, entry, file: {} as Row["file"] });
const ys = (n: number) => Array.from({ length: n }, () => e("Y"));
const ns = (n: number) => Array.from({ length: n }, () => e("N"));

describe("headline", () => {
  it("measure yes", () => {
    expect(headline(tally(measure, [...ys(5), ...ns(1)]))).toEqual({ tone: "yes", label: "Yes 83%", detail: "5 of 6", ranked: false });
  });
  it("measure no", () => {
    expect(headline(tally(measure, [...ns(2), ...ys(1)]))).toEqual({ tone: "no", label: "No 67%", detail: "2 of 3", ranked: false });
  });
  it("measure split", () => {
    expect(headline(tally(measure, [...ys(3), ...ns(3)]))).toEqual({ tone: "split", label: "Split", detail: "3 Yes · 3 No", ranked: false });
  });
  it("candidate leader, ranked", () => {
    const t = tally(race, [e(["A", "B"], true), e(["A"]), e(["A"]), e(["B"])]);
    expect(headline(t)).toEqual({ tone: "candidate", label: "A", detail: "75% (3 of 4)", ranked: true });
  });
  it("candidate tie", () => {
    expect(headline(tally(race, [e(["A"]), e(["B"])]))).toEqual({ tone: "split", label: "Split", detail: "A, B", ranked: false });
  });
  it("no picks, measure and candidate", () => {
    const none = { tone: "none", label: "No picks yet", detail: "", ranked: false };
    expect(headline(tally(measure, []))).toEqual(none);
    expect(headline(tally(race, []))).toEqual(none);
  });
  it("candidate tally with no counts is none, not split", () => {
    const t = { ...tally(race, []), total: 2 };
    expect(headline(t)).toEqual({ tone: "none", label: "No picks yet", detail: "", ranked: false });
  });
  it("single candidate 1 of 1", () => {
    expect(headline(tally(race, [e(["A"])]))).toEqual({ tone: "candidate", label: "A", detail: "100% (1 of 1)", ranked: false });
  });
});

describe("multi-seat headline", () => {
  it("is 'Most endorsed' with no detail", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "B", "D"])]);
    expect(headline(t, 3)).toEqual({ tone: "candidate", label: "Most endorsed", detail: "", ranked: false });
  });
  it("never returns Split, even when the top names tie", () => {
    const t = tally(board, [e(["A"]), e(["B"])]);
    expect(headline(t, 3).label).toBe("Most endorsed");
    expect(headline(t, 3).tone).toBe("candidate");
  });
  it("still says no picks yet when nobody has picked", () => {
    expect(headline(tally(board, []), 3)).toEqual({ tone: "none", label: "No picks yet", detail: "", ranked: false });
  });
  it("single-seat default is unchanged", () => {
    expect(headline(tally(race, [e(["A"]), e(["B"])]), 1).label).toBe("Split");
  });
});

describe("topPicks", () => {
  it("returns the top `seats` names with counts out of all guides", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "B", "D"]), e(["A", "E", "C"])]);
    expect(topPicks(t, 3)).toEqual([
      { name: "A", count: 3, total: 3 },
      { name: "B", count: 2, total: 3 },
      { name: "C", count: 2, total: 3 },
    ]);
  });
  it("includes names tied at the cutoff", () => {
    const t = tally(board, [e(["A", "B", "C"]), e(["A", "D", "E"])]);
    expect(topPicks(t, 2).map((p) => p.name)).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("returns fewer when fewer names were picked", () => {
    expect(topPicks(tally(board, [e(["A"])]), 3)).toEqual([{ name: "A", count: 1, total: 1 }]);
  });
  it("is empty for measures and empty tallies", () => {
    expect(topPicks(tally(measure, ys(2)), 3)).toEqual([]);
    expect(topPicks(tally(board, []), 3)).toEqual([]);
  });
});

describe("groupByPick", () => {
  it("measure: Yes first, input order kept, empty omitted", () => {
    const rows = [row("G1", e("N")), row("G2", e("Y")), row("G3", e("Y"))];
    const g = groupByPick(measure, rows);
    expect(g.map((x) => [x.key, x.label, x.rows.map((r) => r.guide.name)])).toEqual([
      ["Y", "Yes", ["G2", "G3"]],
      ["N", "No", ["G1"]],
    ]);
    expect(groupByPick(measure, [row("G1", e("N"))]).map((x) => x.key)).toEqual(["N"]);
  });
  it("tones groups: yes, no, candidate", () => {
    expect(groupByPick(measure, [row("G1", e("Y")), row("G2", e("N"))]).map((x) => x.tone)).toEqual(["yes", "no"]);
    expect(groupByPick(race, [row("G1", e(["A"]))]).map((x) => x.tone)).toEqual(["candidate"]);
  });
  it("candidate: groups in tally order, dual endorsement in both", () => {
    const rows = [row("G1", e(["A", "B"])), row("G2", e(["A"])), row("G3", e(["C"]))];
    const g = groupByPick(race, rows);
    expect(g.map((x) => [x.key, x.label, x.rows.map((r) => r.guide.name)])).toEqual([
      ["A", "A", ["G1", "G2"]],
      ["B", "B", ["G1"]],
      ["C", "C", ["G3"]],
    ]);
  });
  it("ranked single-seat guide appears only under #1", () => {
    const rows = [row("G1", e(["A", "B"], true)), row("G2", e(["B"]))];
    const g = groupByPick(race, rows);
    expect(g.map((x) => [x.key, x.rows.map((r) => r.guide.name)])).toEqual([
      ["A", ["G1"]],
      ["B", ["G2"]],
    ]);
  });
  it("multi-seat: guide under each listed name", () => {
    const rows = [row("G1", e(["A", "B", "C"])), row("G2", e(["A", "B"]))];
    const g = groupByPick(board, rows);
    expect(g.map((x) => [x.key, x.rows.map((r) => r.guide.name)])).toEqual([
      ["A", ["G1", "G2"]],
      ["B", ["G1", "G2"]],
      ["C", ["G1"]],
    ]);
  });
  it("no rows gives no groups", () => {
    expect(groupByPick(race, [])).toEqual([]);
  });
});

describe("rankedDetails", () => {
  it("returns ranked orders in rows order", () => {
    const rows = [
      row("G1", e(["Gary McCoy", "Michael T. Nguyen"], true)),
      row("G2", e(["A"])),
      row("G3", e(["X", "Y"], true)),
    ];
    expect(rankedDetails(rows)).toEqual([
      { guideName: "G1", order: ["Gary McCoy", "Michael T. Nguyen"] },
      { guideName: "G3", order: ["X", "Y"] },
    ]);
  });
  it("empty when none ranked", () => {
    expect(rankedDetails([row("G1", e(["A"])), row("G2", e("Y"))])).toEqual([]);
  });
});

describe("pendingNote", () => {
  const g = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i}` }) as Guide);
  it("handles 0, 1, many", () => {
    expect(pendingNote(g(0))).toBeNull();
    expect(pendingNote(g(1))).toBe("1 guide hasn't published yet.");
    expect(pendingNote(g(3))).toBe("3 guides haven't published yet.");
  });
});

describe("officialLink", () => {
  it("is the measure's link", () => {
    expect(officialLink({ ...measure, link: "https://sf.gov/b" } as Contest)).toBe("https://sf.gov/b");
  });
  it("is null for candidate races and measures without a link", () => {
    expect(officialLink({ ...race, link: "https://sf.gov/r" } as Contest)).toBeNull();
    expect(officialLink(measure)).toBeNull();
  });
});

describe("sourceLink", () => {
  const archived = [
    { source: "https://g.org/a", snapshot: "https://web.archive.org/web/1/https://g.org/a" },
    { source: "https://g.org/b", snapshot: "https://web.archive.org/web/2/https://g.org/b" },
  ];
  it("returns the archived snapshot for a matching source", () => {
    expect(sourceLink({ archived }, "https://g.org/b")).toBe("https://web.archive.org/web/2/https://g.org/b");
  });
  it("falls back to the live url when no snapshot matches or nothing is archived", () => {
    expect(sourceLink({ archived }, "https://g.org/c")).toBe("https://g.org/c");
    expect(sourceLink({}, "https://g.org/a")).toBe("https://g.org/a");
  });
});
