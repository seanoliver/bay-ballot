import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import { Contest } from "@/lib/schema";

const measure = { id: "prop-x", section: "State propositions", title: "Proposition X", kind: "measure", jurisdiction: { level: "state", name: "California" } };
const summary = { text: "Does a thing.", yes: "The thing happens.", no: "The thing does not happen." };

describe("Contest summary", () => {
  it("accepts a summary on a measure", () => {
    expect(Contest.safeParse({ ...measure, summary }).success).toBe(true);
  });
  it("rejects a summary on a candidate contest", () => {
    const r = Contest.safeParse({ ...measure, kind: "candidate", candidates: ["A"], summary });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("only a measure has a Yes/No summary");
  });
  it("rejects a summary missing what a No vote means", () => {
    expect(Contest.safeParse({ ...measure, summary: { text: "Does a thing.", yes: "It happens." } }).success).toBe(false);
  });

  it.each(["text", "yes", "no"] as const)("rejects an empty %s", (field) => {
    expect(Contest.safeParse({ ...measure, summary: { ...summary, [field]: "" } }).success).toBe(false);
  });
});

describe("November 2026 state propositions", () => {
  const props = loadElection(path.join(process.cwd(), "data"), "2026-11").ballot.contests.filter((c) => c.kind === "measure" && c.jurisdiction.level === "state");
  it("all 14 carry the official summary", () => {
    expect(props).toHaveLength(14);
    expect(props.filter((c) => !c.summary).map((c) => c.id)).toEqual([]);
  });
  it("have different Yes and No meanings", () => {
    for (const c of props) {
      expect(c.summary!.yes, c.id).not.toBe(c.summary!.no);
      expect(c.summary!.no.length, c.id).toBeGreaterThan(0);
    }
  });
});
