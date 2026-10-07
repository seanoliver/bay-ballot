import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadElection } from "@/lib/data";
import before from "./fixtures/contest-order-2026-11.json";

describe("the real ballot", () => {
  it("keeps the contest order from before the per-county split", () => {
    const ids = loadElection(path.join(process.cwd(), "data"), "2026-11").ballot.contests.map((c) => c.id);
    const known = new Set<string>(before);
    expect(ids.filter((id) => known.has(id))).toEqual(before);
  });
});
