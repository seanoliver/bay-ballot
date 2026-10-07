import { describe, expect, it } from "vitest";
import { badFlag } from "@/pipeline/args";

const KNOWN = ["--all", "--force", "--only-areas"];

describe("badFlag", () => {
  it("accepts known flags and their values", () => {
    expect(badFlag(["alpha", "--force", "--only-areas", "marin"], KNOWN)).toBeNull();
  });
  it("rejects an unknown flag, such as a typo, instead of running without it", () => {
    expect(badFlag(["alpha", "--only-area", "marin"], KNOWN)).toBe("unknown option --only-area");
  });
  it("rejects a flag given twice, since only the first value would be used", () => {
    expect(badFlag(["alpha", "--only-areas", "sf", "--only-areas", "san-mateo"], KNOWN)).toBe("--only-areas given twice");
  });
  it("rejects --flag=value, which would otherwise be ignored", () => {
    expect(badFlag(["alpha", "--only-areas=marin"], KNOWN)).toBe("use '--only-areas marin', not '--only-areas=marin'");
  });
});
