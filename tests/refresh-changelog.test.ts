import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { guideChangelogEntry, refreshEntryFile, writeRefreshEntry } from "@/pipeline/changelog";
import type { Contest, EndorsementFile, Entry } from "@/lib/schema";

const c = (id: string, title: string, kind: Contest["kind"] = "measure") => ({ id, title, kind, seats: 1, candidates: [] }) as unknown as Contest;
const contests = [
  c("mayor", "Mayor", "candidate"),
  c("governor", "Governor", "candidate"),
  c("prop-b", "Proposition B"),
  c("prop-c", "Proposition C"),
  c("prop-d", "Proposition D"),
  c("prop-e", "Proposition E"),
];
const e = (pick: Entry["pick"], quotes = 0, ranked = false): Entry => ({ pick, ranked, quotes: Array.from({ length: quotes }, (_, i) => ({ text: `q${i}`, source: "https://g.org/a" })) });
const file = (picks: Record<string, Entry>, over: Partial<EndorsementFile> = {}): EndorsementFile =>
  ({ guide: "growsf", election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: true, picks, ...over }) as EndorsementFile;
const title = (before: EndorsementFile, after: EndorsementFile) => guideChangelogEntry({ guideName: "GrowSF", before, after, contests, date: "2026-10-07" })?.title ?? null;

describe("guideChangelogEntry", () => {
  it("announces a first publication with its contest count", () => {
    expect(guideChangelogEntry({ guideName: "GrowSF", before: file({}, { status: "pending" }), after: file({ "prop-b": e("Y"), governor: e(["Xavier Becerra"]) }), contests, date: "2026-10-07" })).toEqual({
      date: "2026-10-07",
      type: "data",
      title: "GrowSF published endorsements for 2 contests",
    });
  });
  it("describes changed picks, joining names with commas", () => {
    expect(title(file({ "prop-c": e("Y") }), file({ "prop-c": e("N") }))).toBe("GrowSF changed Prop C from Yes to No");
    expect(title(file({}), file({ governor: e(["A", "B", "C"]) }))).toBe("GrowSF endorsed A, B and C for Governor");
    expect(title(file({ governor: e(["A"]) }), file({ governor: e(["B", "C"]) }))).toBe("GrowSF changed Governor from A to B and C");
  });
  it("a reordered ranking is a ranking change", () => {
    expect(title(file({ mayor: e(["A", "B"], 0, true) }), file({ mayor: e(["B", "A"], 0, true) }))).toBe("GrowSF changed its ranking for Mayor");
  });
  it("describes added and removed endorsements and new reasons", () => {
    expect(title(file({}), file({ "prop-b": e("Y") }))).toBe("GrowSF endorsed Yes on Prop B");
    expect(title(file({ "prop-b": e("Y") }), file({}))).toBe("GrowSF removed its endorsement for Prop B");
    expect(title(file({ "prop-b": e("Y", 0) }), file({ "prop-b": e("Y", 1) }))).toBe("GrowSF added a reason for Prop B");
    expect(title(file({ "prop-b": e("Y", 0) }), file({ "prop-b": e("Y", 2) }))).toBe("GrowSF added 2 reasons for Prop B");
  });
  it("separates distinct changes with semicolons and counts the rest", () => {
    expect(title(file({ "prop-b": e("Y") }), file({ "prop-b": e("N"), "prop-c": e("Y") }))).toBe("GrowSF changed Prop B from Yes to No; endorsed Yes on Prop C");
    expect(title(file({}), file({ "prop-b": e("Y"), "prop-c": e("Y"), "prop-d": e("N"), "prop-e": e("N") }))).toBe(
      "GrowSF endorsed Yes on Prop B; endorsed Yes on Prop C; and 2 more changes",
    );
  });
  it("does not announce held picks, and nothing changed means no entry", () => {
    const held = [{ contestId: "prop-b", pick: "N" as const, reason: "wrong-pick" as const, evidence: "x" }];
    expect(title(file({ "prop-b": e("Y") }), file({}, { held }))).toBeNull();
    const f = file({ "prop-b": e("Y", 1) });
    expect(title(f, structuredClone(f))).toBeNull();
  });
});

describe("writeRefreshEntry", () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bb-clw-"));
  const entry = { date: "2026-10-07", type: "data" as const, title: "GrowSF changed Prop C from Yes to No" };

  it("writes one file per guide with a deterministic name", () => {
    const d = tmp();
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep: new Set() });
    expect(fs.readdirSync(d)).toEqual(["2026-10-07-refresh-growsf.yml"]);
    expect(parse(fs.readFileSync(path.join(d, "2026-10-07-refresh-growsf.yml"), "utf8"))).toEqual(entry);
    expect(refreshEntryFile("2026-10-07", "spur")).not.toBe(refreshEntryFile("2026-10-07", "growsf"));
  });
  it("is idempotent: a rerun with the same entry leaves the same single file", () => {
    const d = tmp();
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep: new Set() });
    const before = fs.readFileSync(path.join(d, "2026-10-07-refresh-growsf.yml"), "utf8");
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep: new Set() });
    expect(fs.readdirSync(d)).toEqual(["2026-10-07-refresh-growsf.yml"]);
    expect(fs.readFileSync(path.join(d, "2026-10-07-refresh-growsf.yml"), "utf8")).toBe(before);
  });
  it("replaces this guide's earlier entry from the open refresh, keeping files already on main", () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "2026-10-01-refresh-growsf.yml"), "date: 2026-10-01\ntype: data\ntitle: shipped\n");
    fs.writeFileSync(path.join(d, "2026-10-06-refresh-growsf.yml"), "date: 2026-10-06\ntype: data\ntitle: yesterday's run\n");
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep: new Set(["2026-10-01-refresh-growsf.yml"]) });
    expect(fs.readdirSync(d).sort()).toEqual(["2026-10-01-refresh-growsf.yml", "2026-10-07-refresh-growsf.yml"]);
  });
  it("never overwrites a file already on main: a same-day run after a merge writes -2, then rewrites it", () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "2026-10-07-refresh-growsf.yml"), "date: 2026-10-07\ntype: data\ntitle: merged this morning\n");
    const keep = new Set(["2026-10-07-refresh-growsf.yml"]);
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep });
    expect(fs.readdirSync(d).sort()).toEqual(["2026-10-07-refresh-growsf-2.yml", "2026-10-07-refresh-growsf.yml"]);
    expect(fs.readFileSync(path.join(d, "2026-10-07-refresh-growsf.yml"), "utf8")).toContain("merged this morning");
    writeRefreshEntry(d, "growsf", { ...entry, title: "GrowSF changed Prop C from Yes to No; endorsed Yes on Prop D" }, { date: "2026-10-07", keep });
    expect(fs.readdirSync(d).sort()).toEqual(["2026-10-07-refresh-growsf-2.yml", "2026-10-07-refresh-growsf.yml"]);
    expect(fs.readFileSync(path.join(d, "2026-10-07-refresh-growsf-2.yml"), "utf8")).toContain("Prop D");
    writeRefreshEntry(d, "growsf", null, { date: "2026-10-07", keep });
    expect(fs.readdirSync(d)).toEqual(["2026-10-07-refresh-growsf.yml"]);
  });
  it("skips every suffix already on main", () => {
    const d = tmp();
    const keep = new Set(["2026-10-07-refresh-growsf.yml", "2026-10-07-refresh-growsf-2.yml"]);
    for (const f of keep) fs.writeFileSync(path.join(d, f), "x");
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep });
    expect(fs.readdirSync(d).sort()).toEqual(["2026-10-07-refresh-growsf-2.yml", "2026-10-07-refresh-growsf-3.yml", "2026-10-07-refresh-growsf.yml"]);
  });
  it("does not touch another guide whose id starts the same way", () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "2026-10-06-refresh-growsf-action.yml"), "x");
    writeRefreshEntry(d, "growsf", entry, { date: "2026-10-07", keep: new Set() });
    expect(fs.readdirSync(d).sort()).toEqual(["2026-10-06-refresh-growsf-action.yml", "2026-10-07-refresh-growsf.yml"]);
  });
  it("a change undone before merge leaves no entry", () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "2026-10-06-refresh-growsf.yml"), "date: 2026-10-06\ntype: data\ntitle: flip\n");
    writeRefreshEntry(d, "growsf", null, { date: "2026-10-07", keep: new Set() });
    expect(fs.readdirSync(d)).toEqual([]);
  });
});
