import { describe, expect, it } from "vitest";
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
});
