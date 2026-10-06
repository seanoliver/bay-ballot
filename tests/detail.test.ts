import { describe, expect, it } from "vitest";
import { detailSides, pickReasons, resultHeadline, type Side } from "@/lib/detail";
import type { Row } from "@/lib/filters";
import type { Contest, Entry, GuideType } from "@/lib/schema";

const measure = { id: "prop-b", title: "Proposition B", kind: "measure", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const race = { id: "sup-8", title: "Supervisor, District 8", kind: "candidate", seats: 1, candidates: ["Connie Chan", "Scott Wiener"], rankedChoice: true } as unknown as Contest;
const board = { id: "boe", title: "Board of Education", kind: "candidate", seats: 3, candidates: [], rankedChoice: false } as unknown as Contest;

const q = (text: string, source = "https://g.org/a") => ({ text, source });
type Opts = { ranked?: boolean; list?: boolean; archived?: { source: string; snapshot: string }[]; type?: GuideType; short?: string };
const row = (name: string, pick: Entry["pick"], quotes: Entry["quotes"] = [], opts: Opts = {}): Row => ({
  guide: { id: name.toLowerCase().replace(/\s+/g, "-"), name, type: opts.type ?? "club", ...(opts.short ? { shortName: opts.short } : {}) },
  entry: { pick, ranked: opts.ranked ?? false, quotes },
  file: { hasReasoning: !opts.list, picks: {}, ...(opts.archived ? { archived: opts.archived } : {}) },
});

describe("detailSides", () => {
  it("measures: Yes then No, empty sides dropped; quoted guides first (row order), then A–Z", () => {
    const rows = [row("Zed", "Y"), row("Quoted Two", "Y", [q("b")]), row("Alpha", "Y", [], { list: true, short: "Al" }), row("Quoted One", "Y", [q("a")])];
    const { sides, others } = detailSides(measure, rows);
    expect(sides.map((s) => [s.key, s.label, s.count, s.tone])).toEqual([["Y", "Yes", 4, "yes"]]);
    expect(sides[0].guides.map((g) => [g.name, g.short, g.quoted])).toEqual([
      ["Quoted Two", "Quoted Two", true],
      ["Quoted One", "Quoted One", true],
      ["Alpha", "Al", false],
      ["Zed", "Zed", false],
    ]);
    expect(others).toEqual([]);
  });
  it("list-only guides' quotes are not shown and don't mark the chip quoted", () => {
    const { sides } = detailSides(measure, [row("A", "Y", [q("hidden")], { list: true })]);
    expect(sides[0].guides[0].quoted).toBe(false);
    expect(sides[0].quotes).toEqual([]);
  });
  it("quotes carry the guide, its type and the archived link", () => {
    const rows = [row("A", "N", [q("Bad.", "https://a.org/p")], { type: "newspaper", archived: [{ source: "https://a.org/p", snapshot: "https://web.archive.org/x" }] })];
    expect(detailSides(measure, rows).sides[0].quotes).toEqual([
      { guideId: "a", guideName: "A", type: "newspaper", text: "Bad.", href: "https://web.archive.org/x" },
    ]);
  });
  it("candidates: one side per name in bar order with its slot tone", () => {
    const rows = [row("A", ["Scott Wiener"]), row("B", ["Scott Wiener"]), row("C", ["Connie Chan"])];
    expect(detailSides(race, rows).sides.map((s) => [s.label, s.count, s.tone])).toEqual([
      ["Scott Wiener", 2, "c2"],
      ["Connie Chan", 1, "c1"],
    ]);
  });
  it("multi-seat: the top `seats` names are sides; the rest are others", () => {
    const rows = [row("A", ["W", "X", "Y", "Z"]), row("B", ["W", "X", "Y"]), row("C", ["W", "X"]), row("D", ["W"])];
    const { sides, others } = detailSides(board, rows);
    expect(sides.map((s) => [s.label, s.count])).toEqual([["W", 4], ["X", 3], ["Y", 2]]);
    expect(others.map((s) => [s.label, s.count])).toEqual([["Z", 1]]);
  });
});

describe("pickReasons", () => {
  const side = (contest: Contest, rows: Row[], key: string): Side => detailSides(contest, rows).sides.find((s) => s.key === key) as Side;
  it("one quote per guide, up to two, the rest behind 'All reasons'", () => {
    const rows = [row("A", "Y", [q("a1"), q("a2")]), row("B", "Y", [q("b1")]), row("C", "Y", [q("c1")])];
    const { top, rest } = pickReasons(side(measure, rows, "Y"), rows, measure);
    expect(top.map((x) => x.text)).toEqual(["a1", "b1"]);
    expect(rest.map((x) => x.text)).toEqual(["a2", "c1"]);
  });
  it("prefers different guide types", () => {
    const rows = [
      row("A", "Y", [q("a1")], { type: "club" }),
      row("B", "Y", [q("b1")], { type: "club" }),
      row("C", "Y", [q("c1")], { type: "newspaper" }),
    ];
    expect(pickReasons(side(measure, rows, "Y"), rows, measure).top.map((x) => x.guideName)).toEqual(["A", "C"]);
  });
  it("prefers quotes of 200 characters or fewer, then shorter", () => {
    const long = "x".repeat(201);
    const rows = [row("A", "Y", [q(long)], { type: "club" }), row("B", "Y", [q("medium length quote")], { type: "union" }), row("C", "Y", [q("short")], { type: "civic" })];
    expect(pickReasons(side(measure, rows, "Y"), rows, measure).top.map((x) => x.guideName)).toEqual(["C", "B"]);
  });
  it("within a guide, picks its best quote", () => {
    const rows = [row("A", "Y", [q("y".repeat(250)), q("short one")])];
    expect(pickReasons(side(measure, rows, "Y"), rows, measure).top.map((x) => x.text)).toEqual(["short one"]);
  });
  it("attacks on rivals rank after quotes about the side's own candidate", () => {
    const rows = [
      row("A", ["Scott Wiener"], [q("Connie Chan is wrong for the job.")], { type: "club" }),
      row("B", ["Scott Wiener"], [q("Wiener gets bills passed, unlike Chan.")], { type: "union" }),
      row("C", ["Scott Wiener"], [q("A proven legislator.")], { type: "civic" }),
    ];
    expect(pickReasons(side(race, rows, "Scott Wiener"), rows, race).top.map((x) => x.guideName)).toEqual(["C", "B"]);
  });
  it("no quotes: nothing", () => {
    const rows = [row("A", "Y")];
    expect(pickReasons(side(measure, rows, "Y"), rows, measure)).toEqual({ top: [], rest: [] });
  });
});

describe("resultHeadline", () => {
  const ys = (n: number) => Array.from({ length: n }, (_, i) => row(`Y${i}`, "Y"));
  const ns = (n: number) => Array.from({ length: n }, (_, i) => row(`N${i}`, "N"));
  it("measure verdict", () => {
    expect(resultHeadline(measure, [...ys(5), ...ns(1)])).toEqual({ lead: "Yes 83%", tone: "yes", detail: "6 guides" });
    expect(resultHeadline(measure, [...ys(1), ...ns(2)])).toEqual({ lead: "No 67%", tone: "no", detail: "3 guides" });
  });
  it("measure split", () => {
    expect(resultHeadline(measure, [...ys(3), ...ns(3)])).toEqual({ lead: "Split", tone: "split", detail: "6 guides" });
  });
  it("candidate leader", () => {
    const rows = [row("A", ["Scott Wiener"]), row("B", ["Scott Wiener"]), row("C", ["Scott Wiener"]), row("D", ["Connie Chan"])];
    expect(resultHeadline(race, rows)).toEqual({ lead: "Scott Wiener 75%", tone: "candidate", detail: "4 guides" });
  });
  it("candidate tie", () => {
    expect(resultHeadline(race, [row("A", ["Scott Wiener"]), row("B", ["Connie Chan"])])).toEqual({
      lead: "Split",
      tone: "split",
      detail: "2 guides",
    });
  });
  it("a single endorsed candidate: no share, and says there are no other endorsements", () => {
    const rows = [row("A", ["Scott Wiener"]), row("B", ["Scott Wiener"]), row("C", ["Scott Wiener"])];
    expect(resultHeadline(race, rows)).toEqual({ lead: "Scott Wiener", tone: "candidate", detail: "3 guides, no other endorsements" });
  });
    it("multi-seat", () => {
    expect(resultHeadline(board, [row("A", ["X", "Y"]), row("B", ["X"])])).toEqual({ lead: "X, Y", tone: "candidate", detail: "2 guides" });
  });
  it("no picks", () => {
    expect(resultHeadline(measure, [])).toEqual({ lead: "No endorsements yet", tone: "none", detail: "" });
  });
});
