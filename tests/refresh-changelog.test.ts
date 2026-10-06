import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { guideChangelogEntry, prependChangelog } from "@/pipeline/changelog";
import type { Contest, EndorsementFile, Entry } from "@/lib/schema";

const c = (id: string, title: string, kind: Contest["kind"] = "measure") => ({ id, title, kind, seats: 1, candidates: [] }) as unknown as Contest;
const contests = [c("governor", "Governor", "candidate"), c("prop-b", "Proposition B"), c("prop-c", "Proposition C"), c("prop-d", "Proposition D"), c("prop-e", "Proposition E")];
const e = (pick: Entry["pick"], quotes = 0): Entry => ({ pick, ranked: false, quotes: Array.from({ length: quotes }, (_, i) => ({ text: `q${i}`, source: "https://g.org/a" })) });
const file = (picks: Record<string, Entry>, over: Partial<EndorsementFile> = {}): EndorsementFile =>
  ({ guide: "growsf", election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: true, picks, ...over }) as EndorsementFile;
const entry = (before: EndorsementFile, after: EndorsementFile) => guideChangelogEntry({ guideName: "GrowSF", before, after, contests, date: "2026-10-07" });

describe("guideChangelogEntry", () => {
  it("announces a guide's first publication with its contest count", () => {
    const before = file({}, { status: "pending" });
    const after = file({ "prop-b": e("Y"), "prop-c": e("N"), governor: e(["Xavier Becerra"]) });
    expect(entry(before, after)).toEqual({ date: "2026-10-07", type: "data", title: "GrowSF published endorsements for 3 contests" });
  });
  it("describes a changed pick", () => {
    expect(entry(file({ "prop-c": e("Y") }), file({ "prop-c": e("N") }))?.title).toBe("GrowSF changed Prop C from Yes to No");
    expect(entry(file({ governor: e(["Xavier Becerra"]) }), file({ governor: e(["Steve Hilton"]) }))?.title).toBe(
      "GrowSF changed Governor from Xavier Becerra to Steve Hilton",
    );
  });
  it("describes added and removed endorsements and new reasons", () => {
    expect(entry(file({}), file({ "prop-b": e("Y") }))?.title).toBe("GrowSF endorsed Yes on Prop B");
    expect(entry(file({}), file({ governor: e(["Xavier Becerra"]) }))?.title).toBe("GrowSF endorsed Xavier Becerra for Governor");
    expect(entry(file({ "prop-b": e("Y") }), file({}))?.title).toBe("GrowSF removed its endorsement for Prop B");
    expect(entry(file({ "prop-b": e("Y", 0) }), file({ "prop-b": e("Y", 1) }))?.title).toBe("GrowSF added a reason for Prop B");
    expect(entry(file({ "prop-b": e("Y", 0) }), file({ "prop-b": e("Y", 2) }))?.title).toBe("GrowSF added 2 reasons for Prop B");
  });
  it("one entry per guide: two changes are joined, more are counted", () => {
    expect(entry(file({ "prop-b": e("Y") }), file({ "prop-b": e("N"), "prop-c": e("Y") }))?.title).toBe(
      "GrowSF changed Prop B from Yes to No and endorsed Yes on Prop C",
    );
    const many = entry(file({}), file({ "prop-b": e("Y"), "prop-c": e("Y"), "prop-d": e("N"), "prop-e": e("N") }));
    expect(many?.title).toBe("GrowSF endorsed Yes on Prop B, endorsed Yes on Prop C, and 2 more changes");
  });
  it("does not announce held picks", () => {
    const held = [{ contestId: "prop-b", pick: "N" as const, reason: "wrong-pick" as const, evidence: "x" }];
    expect(entry(file({ "prop-b": e("Y") }), file({}, { held }))).toBeNull();
  });
  it("nothing changed: no entry", () => {
    const f = file({ "prop-b": e("Y", 1) });
    expect(entry(f, structuredClone(f))).toBeNull();
    expect(entry(file({ "prop-b": e("Y", 2) }), file({ "prop-b": e("Y", 1) }))).toBeNull();
  });
});

describe("prependChangelog", () => {
  const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bb-cl-")), "changelog.yml");
  it("adds new entries to the top and keeps the rest", () => {
    const p = tmp();
    fs.writeFileSync(p, "- date: 2026-10-06\n  type: new\n  title: Launch\n");
    prependChangelog(p, [{ date: "2026-10-07", type: "data", title: "GrowSF changed Prop C from Yes to No" }]);
    expect(parse(fs.readFileSync(p, "utf8")).map((x: { title: string }) => x.title)).toEqual(["GrowSF changed Prop C from Yes to No", "Launch"]);
  });
  it("leaves the file untouched when there is nothing to add, and creates it when missing", () => {
    const p = tmp();
    fs.writeFileSync(p, "# keep\n- date: 2026-10-06\n  type: new\n  title: Launch\n");
    const before = fs.readFileSync(p, "utf8");
    prependChangelog(p, []);
    expect(fs.readFileSync(p, "utf8")).toBe(before);
    const q = tmp();
    prependChangelog(q, [{ date: "2026-10-07", type: "data", title: "x" }]);
    expect(parse(fs.readFileSync(q, "utf8"))).toHaveLength(1);
  });
});
