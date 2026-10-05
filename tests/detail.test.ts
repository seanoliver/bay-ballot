import { describe, expect, it } from "vitest";
import { reasonSections, resultHeadline, whoRows } from "@/lib/detail";
import type { Row } from "@/lib/filters";
import type { Contest, Entry } from "@/lib/schema";

const measure = { id: "prop-b", title: "Proposition B", kind: "measure", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const race = { id: "sup-8", title: "Supervisor, District 8", kind: "candidate", seats: 1, candidates: ["Connie Chan", "Scott Wiener"], rankedChoice: true } as unknown as Contest;
const board = { id: "boe", title: "Board of Education", kind: "candidate", seats: 3, candidates: [], rankedChoice: false } as unknown as Contest;

const q = (text: string, source = "https://g.org/a") => ({ text, source });
const row = (name: string, pick: Entry["pick"], quotes: Entry["quotes"] = [], opts: { ranked?: boolean; list?: boolean; archived?: { source: string; snapshot: string }[] } = {}): Row => ({
  guide: { id: name.toLowerCase().replace(/\s+/g, "-"), name, type: "club" },
  entry: { pick, ranked: opts.ranked ?? false, quotes },
  file: { hasReasoning: !opts.list, picks: {}, ...(opts.archived ? { archived: opts.archived } : {}) },
});

describe("whoRows", () => {
  it("measures: Yes then No, guide names with list-only marked", () => {
    const rows = [row("A", "Y"), row("B", "N"), row("C", "Y", [], { list: true })];
    expect(whoRows(measure, rows)).toEqual([
      { key: "Y", label: "Yes", count: 2, tone: "yes", guides: [{ id: "a", name: "A", listOnly: false, rank: null }, { id: "c", name: "C", listOnly: true, rank: null }] },
      { key: "N", label: "No", count: 1, tone: "no", guides: [{ id: "b", name: "B", listOnly: false, rank: null }] },
    ]);
  });
  it("candidates: bar order, slot tone, ranked guides carry the candidate's rank", () => {
    const rows = [row("A", ["Scott Wiener", "Connie Chan"], [], { ranked: true }), row("B", ["Scott Wiener"]), row("C", ["Connie Chan"])];
    const out = whoRows(race, rows);
    expect(out.map((r) => [r.label, r.count, r.tone])).toEqual([
      ["Scott Wiener", 2, "c2"],
      ["Connie Chan", 1, "c1"],
    ]);
    expect(out[0].guides[0]).toEqual({ id: "a", name: "A", listOnly: false, rank: 1 });
  });
  it("no picks, no rows", () => {
    expect(whoRows(measure, [])).toEqual([]);
  });
});

describe("reasonSections", () => {
  it("measures: Reasons for, then against; only sections with quotes; list-only quotes ignored", () => {
    const rows = [
      row("A", "Y", [q("Good."), q("Also good.")]),
      row("B", "Y", []),
      row("C", "N", [q("Hidden.")], { list: true }),
    ];
    expect(reasonSections(measure, rows)).toEqual([
      {
        key: "Y",
        title: "Reasons for",
        tone: "yes",
        items: [{ guideId: "a", guideName: "A", quotes: [{ text: "Good.", href: "https://g.org/a" }, { text: "Also good.", href: "https://g.org/a" }] }],
        hidden: 1,
      },
    ]);
  });
  it("Reasons against uses the No guides", () => {
    expect(reasonSections(measure, [row("A", "N", [q("Bad.")])]).map((s) => s.title)).toEqual(["Reasons against"]);
  });
  it("candidates: one section per backed candidate in bar order; source links prefer the archive", () => {
    const rows = [
      row("A", ["Scott Wiener"], [q("Wiener wins.", "https://a.org/p")], { archived: [{ source: "https://a.org/p", snapshot: "https://web.archive.org/x" }] }),
      row("B", ["Scott Wiener"]),
      row("C", ["Connie Chan"], [q("Chan cares.")]),
    ];
    const out = reasonSections(race, rows);
    expect(out.map((s) => [s.title, s.tone])).toEqual([
      ["Why guides back Scott Wiener", "c2"],
      ["Why guides back Connie Chan", "c1"],
    ]);
    expect(out[0].items[0].quotes[0].href).toBe("https://web.archive.org/x");
    expect(out[0].hidden).toBe(0);
  });
  it("no quotes anywhere: no sections", () => {
    expect(reasonSections(board, [row("A", ["X", "Y"])])).toEqual([]);
  });
});

describe("resultHeadline", () => {
  const ys = (n: number) => Array.from({ length: n }, (_, i) => row(`Y${i}`, "Y"));
  const ns = (n: number) => Array.from({ length: n }, (_, i) => row(`N${i}`, "N"));
  it("measure verdict", () => {
    expect(resultHeadline(measure, [...ys(5), ...ns(1)])).toEqual({ lead: "Yes", tone: "yes", detail: "5 of 6 guides · 83%" });
    expect(resultHeadline(measure, [...ys(1), ...ns(2)])).toEqual({ lead: "No", tone: "no", detail: "2 of 3 guides · 67%" });
  });
  it("measure split", () => {
    expect(resultHeadline(measure, [...ys(3), ...ns(3)])).toEqual({ lead: "Split", tone: "split", detail: "3 Yes · 3 No" });
  });
  it("candidate leader", () => {
    const rows = [row("A", ["Scott Wiener"]), row("B", ["Scott Wiener"]), row("C", ["Scott Wiener"]), row("D", ["Connie Chan"])];
    expect(resultHeadline(race, rows)).toEqual({ lead: "Scott Wiener", tone: "candidate", detail: "3 of 4 guides · 75%" });
  });
  it("candidate tie", () => {
    expect(resultHeadline(race, [row("A", ["Scott Wiener"]), row("B", ["Connie Chan"])])).toEqual({
      lead: "Split",
      tone: "split",
      detail: "Connie Chan, Scott Wiener · 1 each",
    });
  });
  it("multi-seat", () => {
    expect(resultHeadline(board, [row("A", ["X", "Y"]), row("B", ["X"])])).toEqual({ lead: "Most endorsed", tone: "candidate", detail: "2 guides" });
  });
  it("no picks", () => {
    expect(resultHeadline(measure, [])).toEqual({ lead: "No picks yet", tone: "none", detail: "" });
  });
});
