import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadElection, validateElection, type ElectionData } from "@/lib/data";

const root = path.join(process.cwd(), "tests/fixtures/data");

const juris = { level: "city" as const, name: "San Francisco" };
function base(): ElectionData {
  return {
    ballot: {
      election: "2026-11",
      title: "T",
      date: "2026-11-03",
      contests: [
        { id: "prop-b", section: "S", title: "B", kind: "measure", candidates: [], seats: 1, jurisdiction: juris },
        { id: "board", section: "S", title: "Board", kind: "candidate", candidates: ["A One", "B Two", "C Three", "D Four"], seats: 3, jurisdiction: juris },
      ],
    },
    guides: [{ id: "g", name: "G", description: "", type: "civic", homepage: "https://g.org/" }],
    endorsements: {},
  };
}
function withFile(d: ElectionData, picks: Record<string, unknown>, over: Record<string, unknown> = {}, id = "g") {
  d.endorsements[id] = { guide: id, election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: false, picks, ...over } as never;
  return d;
}
const e = (pick: unknown) => ({ pick, ranked: false, quotes: [] });

describe("data", () => {
  it("loads an election", () => {
    const d = loadElection(root, "2026-11");
    expect(d.ballot.contests).toHaveLength(2);
    expect(d.guides.map((g) => g.id)).toEqual(["growsf"]);
    expect(d.endorsements.growsf.status).toBe("published");
  });
  it("reports unknown contests as errors and fuzzy names as warnings", () => {
    const r = validateElection(loadElection(root, "2026-11"));
    expect(r.errors).toEqual(["growsf: unknown contest 'prop-z'"]);
    expect(r.warnings).toEqual(["growsf/assessor: 'Joaquin Torres' matched 'Joaquín Torres' — fix spelling"]);
  });
  it("flags pick/kind mismatch", () => {
    const r = validateElection(withFile(base(), { "prop-b": e(["A One"]), board: e("Y") }));
    expect(r.errors).toEqual([
      "g/prop-b: pick type doesn't match contest kind",
      "g/board: pick type doesn't match contest kind",
    ]);
  });
  it("flags non-candidates", () => {
    const r = validateElection(withFile(base(), { board: e(["Zed"]) }));
    expect(r.errors).toEqual(["g/board: 'Zed' is not a candidate"]);
  });
  it("flags missing guide file and election mismatch", () => {
    const d = withFile(base(), {}, { election: "2026-06" }, "nope");
    expect(validateElection(d).errors).toEqual([
      "nope: no guides/nope.yml",
      "nope: election '2026-06' does not match ballot '2026-11'",
    ]);
  });
  it("flags duplicate contests, duplicate candidates, district without district", () => {
    const d = base();
    d.ballot.contests.push({ ...d.ballot.contests[1], candidates: [], jurisdiction: { level: "district", name: "Supervisor" } });
    d.ballot.contests[1].candidates.push("A One");
    const r = validateElection(d);
    expect(r.errors).toEqual([
      "board: duplicate candidate 'A One'",
      "duplicate contest id 'board'",
      "board: district jurisdiction requires a district",
    ]);
  });
  it("warns on too many names and pending files with picks", () => {
    const r = validateElection(withFile(base(), { board: e(["A One", "B Two", "C Three", "D Four"]) }, { status: "pending" }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      "g: pending file has picks",
      "g/board: 4 names exceeds 3 seat(s)",
    ]);
  });
  it("does not warn on ranked picks beyond seats", () => {
    const d = withFile(base(), { board: { ...e(["A One", "B Two", "C Three", "D Four"]), ranked: true } });
    expect(validateElection(d).warnings).toEqual([]);
  });
});

describe("loadElection failures", () => {
  function tmp(files: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-"));
    for (const [p, c] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), c);
    }
    return dir;
  }
  const ballot = fs.readFileSync(path.join(root, "2026-11/ballot.yml"), "utf8");
  it("throws with the path on schema errors", () => {
    const dir = tmp({ "2026-11/ballot.yml": "election: nope\n" });
    expect(() => loadElection(dir, "2026-11")).toThrow(/2026-11\/ballot\.yml/);
  });
  it("throws with the path on YAML syntax errors", () => {
    const dir = tmp({ "2026-11/ballot.yml": "a: [unclosed\n" });
    expect(() => loadElection(dir, "2026-11")).toThrow(/2026-11\/ballot\.yml/);
  });
  it("throws when filename differs from guide field", () => {
    const dir = tmp({
      "2026-11/ballot.yml": ballot,
      "2026-11/endorsements/other.yml": "guide: growsf\nelection: 2026-11\nstatus: pending\nfetchedAt: 2026-10-05\nhasReasoning: false\n",
    });
    expect(() => loadElection(dir, "2026-11")).toThrow(/other\.yml.*growsf/);
  });
});
