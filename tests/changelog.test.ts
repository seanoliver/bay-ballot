import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChangelogEntry } from "@/lib/schema";
import { changelogMonths, readChangelog, utcDay, validateChangelog } from "@/lib/changelog";

const e = (date: string, title = "t", type: "new" | "data" | "fix" = "new") => ({ date, type, title });

function dir(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bb-cl-"));
  fs.mkdirSync(path.join(root, "changelog"));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, "changelog", name), body);
  return root;
}

describe("ChangelogEntry schema", () => {
  it("accepts an entry with optional details and PR number", () => {
    expect(ChangelogEntry.parse({ date: "2026-10-06", type: "new", title: "Launch", details: "d", pr: 1 }).pr).toBe(1);
  });
  it("rejects bad types, dates and PR numbers", () => {
    expect(ChangelogEntry.safeParse({ date: "2026-13-01", type: "new", title: "x" }).success).toBe(false);
    expect(ChangelogEntry.safeParse({ date: "2026-10-06", type: "feature", title: "x" }).success).toBe(false);
    expect(ChangelogEntry.safeParse({ date: "2026-10-06", type: "new", title: "x", pr: 0 }).success).toBe(false);
    expect(ChangelogEntry.safeParse({ date: "2026-10-06", type: "new", title: " " }).success).toBe(false);
  });
});

describe("readChangelog", () => {
  it("reads one entry per file, newest first, then by filename descending", () => {
    const root = dir({
      "2026-10-05-a.yml": "date: 2026-10-05\ntype: new\ntitle: A\n",
      "2026-10-06-b.yml": "date: 2026-10-06\ntype: fix\ntitle: B\n",
      "2026-10-06-c.yml": "date: 2026-10-06\ntype: new\ntitle: C\n",
    });
    const { entries, errors } = readChangelog(root);
    expect(errors).toEqual([]);
    expect(entries.map((x) => [x.file, x.title])).toEqual([
      ["2026-10-06-c.yml", "C"],
      ["2026-10-06-b.yml", "B"],
      ["2026-10-05-a.yml", "A"],
    ]);
  });
  it("reports invalid files instead of throwing", () => {
    const root = dir({ "2026-10-06-bad.yml": "date: 2026-10-06\ntype: feature\ntitle: x\n", "2026-10-06-junk.yml": "date: [" });
    const { entries, errors } = readChangelog(root);
    expect(entries).toEqual([]);
    expect(errors).toHaveLength(2);
    expect(errors.every((x) => x.startsWith("changelog/2026-10-06-"))).toBe(true);
  });
  it("no directory, no entries", () => {
    expect(readChangelog(fs.mkdtempSync(path.join(os.tmpdir(), "bb-cl-")))).toEqual({ entries: [], errors: [] });
  });
});

describe("validateChangelog", () => {
  const f = (file: string, date: string) => ({ ...e(date), file });
  it("passes well-named files dated today or earlier", () => {
    expect(validateChangelog([f("2026-10-06-launch.yml", "2026-10-06")], "2026-10-06")).toEqual([]);
  });
  it("flags future dates, names that don't follow <date>-<slug>.yml or don't match the entry date, and duplicates", () => {
    expect(validateChangelog([f("2026-10-07-x.yml", "2026-10-07")], "2026-10-06")).toEqual(["changelog/2026-10-07-x.yml: dated 2026-10-07, in the future"]);
    expect(validateChangelog([f("launch.yml", "2026-10-06")], "2026-10-06")).toEqual(["changelog/launch.yml: name must be <YYYY-MM-DD>-<slug>.yml"]);
    expect(validateChangelog([f("2026-10-05-x.yml", "2026-10-06")], "2026-10-06")).toEqual(["changelog/2026-10-05-x.yml: name date differs from entry date 2026-10-06"]);
    expect(validateChangelog([f("2026-10-06-x.yml", "2026-10-06"), f("2026-10-06-X.yml", "2026-10-06")], "2026-10-06")).toEqual([
      "changelog/2026-10-06-X.yml: duplicates 2026-10-06-x.yml",
    ]);
  });
});

describe("utcDay", () => {
  it("is the UTC calendar day, whatever the local time zone", () => {
    expect(utcDay(new Date("2026-10-06T23:30:00-07:00"))).toBe("2026-10-07");
    expect(utcDay(new Date("2026-10-07T00:30:00+09:00"))).toBe("2026-10-06");
  });
});

describe("changelogMonths", () => {
  it("groups entries by month in order", () => {
    const out = changelogMonths([e("2026-10-06", "a"), e("2026-10-01", "b"), e("2026-09-30", "c")]);
    expect(out.map((m) => [m.label, m.entries.map((x) => x.title)])).toEqual([
      ["October 2026", ["a", "b"]],
      ["September 2026", ["c"]],
    ]);
  });
});
