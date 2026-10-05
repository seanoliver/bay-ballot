import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/schema";
import { diffPicks } from "@/pipeline/diff";

const q = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ text: `Reason number ${i + 1} for this pick.`, source: "https://a.org/" }));
const e = (pick: Entry["pick"], { ranked = false, quotes = 0 } = {}): Entry => ({ pick, ranked, quotes: q(quotes) });

describe("diffPicks", () => {
  it("lists added, changed and removed picks", () => {
    const before = { "prop-a": e("Y"), "prop-b": e("N") };
    const after = { "prop-a": e("N"), "prop-c": e("Y") };
    expect(diffPicks(before, after)).toEqual(["~ prop-a: Y -> N", "+ prop-c: Y", "- prop-b: N"]);
  });

  it("shows candidate lists and ranking", () => {
    const before = { "mayor": e(["A One", "B Two"]) };
    const after = { "mayor": e(["A One", "B Two"], { ranked: true }), "da": e(["C Three"]) };
    expect(diffPicks(before, after)).toEqual([
      "~ mayor: A One / B Two -> A One / B Two (ranked)",
      "+ da: C Three",
    ]);
  });

  it("reports quote count changes", () => {
    const before = { "prop-a": e("Y"), "prop-b": e("N", { quotes: 3 }) };
    const after = { "prop-a": e("Y", { quotes: 2 }), "prop-b": e("Y", { quotes: 1 }) };
    expect(diffPicks(before, after)).toEqual(["q prop-a: 0 -> 2", "~ prop-b: N -> Y", "q prop-b: 3 -> 1"]);
  });

  it("is empty when nothing changed", () => {
    const picks = { "prop-a": e("Y", { quotes: 1 }) };
    expect(diffPicks(picks, structuredClone(picks))).toEqual([]);
  });
});
