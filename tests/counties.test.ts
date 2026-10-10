import { describe, expect, it } from "vitest";
import { countySlug } from "@/lib/counties";

describe("countySlug", () => {
  it("slugs county names", () => {
    expect(countySlug("San Mateo")).toBe("san-mateo");
    expect(countySlug("San Francisco")).toBe("san-francisco");
  });
});
