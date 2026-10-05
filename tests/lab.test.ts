import { describe, expect, it } from "vitest";
import { topQuote } from "@/lib/display";
import type { Contest, Entry } from "@/lib/schema";
import type { Row } from "@/lib/filters";

const measure = { id: "prop-b", kind: "measure", seats: 1, candidates: [], rankedChoice: false } as unknown as Contest;
const q = (text: string) => ({ text, source: "https://g.org/a" });
const row = (name: string, pick: Entry["pick"], quotes: Entry["quotes"], hasReasoning = true): Row =>
  ({ guide: { id: name.toLowerCase(), name, type: "club" }, entry: { pick, ranked: false, quotes }, file: { hasReasoning, picks: {} } });

describe("topQuote", () => {
  it("takes the first kept quote, leading side first", () => {
    const rows = [row("NoGuide", "N", [q("Bad idea.")]), row("A", "Y", []), row("B", "Y", [q("Good."), q("Also.")]), row("C", "Y", [q("Fine.")])];
    expect(topQuote(measure, rows)).toEqual({ guideName: "B", text: "Good.", pick: "Yes" });
  });
  it("a No-leaning measure quotes the No side", () => {
    const rows = [row("A", "Y", [q("Yes!")]), row("B", "N", [q("No.")]), row("C", "N", [])];
    expect(topQuote(measure, rows)?.guideName).toBe("B");
  });
  it("skips quotes from list-only guides", () => {
    expect(topQuote(measure, [row("A", "Y", [q("Hidden.")], false)])).toBeNull();
  });
  it("none when no rows", () => {
    expect(topQuote(measure, [])).toBeNull();
  });
});
