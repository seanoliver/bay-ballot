import { describe, expect, it } from "vitest";
import { pinParts } from "@/lib/pins";
import type { Entry } from "@/lib/schema";

const e = (pick: Entry["pick"], over: Partial<Entry> = {}): Entry => ({ pick, ranked: false, quotes: [], ...over });
const labels = (entry: Entry) => pinParts(entry, new Map()).map((p) => p.label);

describe("pinParts", () => {
  it("labels a measure pick Yes or No in the bar's tones", () => {
    expect(pinParts(e("Y"), new Map())).toEqual([{ key: "Y", label: "Yes", tone: "yes" }]);
    expect(pinParts(e("N"), new Map())).toEqual([{ key: "N", label: "No", tone: "no" }]);
  });
  it("shows candidates by surname, in each candidate's bar color", () => {
    const parts = pinParts(e(["Scott Wiener", "Connie Chan"]), new Map([["Connie Chan", 1]]));
    expect(parts.map((p) => [p.label, p.tone])).toEqual([["Wiener", "other"], ["Chan", "c1"]]);
  });
  it("numbers only the names the guide ranked", () => {
    expect(labels(e(["Dionjay (DJ) Brookter", "J.R. Eppler", "Deandra Bryant"], { ranked: true, rankedCount: 1 }))).toEqual(["1. Brookter", "Eppler", "Bryant"]);
    expect(labels(e(["Gary McCoy", "Michael T. Nguyen"], { ranked: true }))).toEqual(["1. McCoy", "2. Nguyen"]);
  });
});
