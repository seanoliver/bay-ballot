import { describe, expect, it } from "vitest";
import { ChangelogFile } from "@/lib/schema";
import { changelogMonths, validateChangelog } from "@/lib/changelog";

const e = (date: string, title = "t", type: "new" | "data" | "fix" = "new") => ({ date, type, title });

describe("ChangelogFile schema", () => {
  it("accepts entries with optional details and PR number", () => {
    expect(ChangelogFile.parse([{ date: "2026-10-06", type: "new", title: "Launch", details: "d", pr: 1 }])).toHaveLength(1);
  });
  it("rejects bad types, dates and PR numbers", () => {
    expect(ChangelogFile.safeParse([{ date: "2026-13-01", type: "new", title: "x" }]).success).toBe(false);
    expect(ChangelogFile.safeParse([{ date: "2026-10-06", type: "feature", title: "x" }]).success).toBe(false);
    expect(ChangelogFile.safeParse([{ date: "2026-10-06", type: "new", title: "x", pr: 0 }]).success).toBe(false);
    expect(ChangelogFile.safeParse([{ date: "2026-10-06", type: "new", title: " " }]).success).toBe(false);
  });
});

describe("validateChangelog", () => {
  it("passes newest-first entries dated today or earlier", () => {
    expect(validateChangelog([e("2026-10-06"), e("2026-10-06"), e("2026-09-30")], "2026-10-06")).toEqual([]);
  });
  it("flags entries out of order and dates in the future", () => {
    expect(validateChangelog([e("2026-10-01"), e("2026-10-05")], "2026-10-06")).toEqual(["changelog: entry 2 (2026-10-05) is newer than the one before it"]);
    expect(validateChangelog([e("2026-10-07")], "2026-10-06")).toEqual(["changelog: entry 1 (2026-10-07) is in the future"]);
  });
});

describe("changelogMonths", () => {
  it("groups entries by month, newest first, keeping their order", () => {
    const out = changelogMonths([e("2026-10-06", "a"), e("2026-10-01", "b"), e("2026-09-30", "c")]);
    expect(out.map((m) => [m.label, m.entries.map((x) => x.title)])).toEqual([
      ["October 2026", ["a", "b"]],
      ["September 2026", ["c"]],
    ]);
  });
});
