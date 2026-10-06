import { describe, expect, it } from "vitest";
import { isRejected } from "@/lib/quote-key";

const long = "Prop 4 would lift the ban on public funding for state and local election campaigns.";

describe("isRejected", () => {
  it("matches the same sentence whatever its spacing, apostrophes or case", () => {
    expect(isRejected("Prop 4 would lift  the BAN on public funding for state and local election campaigns.", "prop-4", [{ text: long }])).toBe(true);
  });
  it("matches when one long sentence contains the other", () => {
    expect(isRejected(`${long} Vote yes.`, "prop-4", [{ text: long }])).toBe(true);
    expect(isRejected("would lift the ban on public funding for state and local election", "prop-4", [{ text: long }])).toBe(true);
  });
  it("ignores containment of short text, so a short phrase can't reject a real quote", () => {
    expect(isRejected(long, "prop-4", [{ text: "public funding" }])).toBe(false);
  });
  it("applies a rejection to one contest when it names one", () => {
    expect(isRejected(long, "prop-5", [{ text: long, contestId: "prop-4" }])).toBe(false);
    expect(isRejected(long, "prop-4", [{ text: long, contestId: "prop-4" }])).toBe(true);
  });
});
