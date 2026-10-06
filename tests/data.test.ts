import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadElection, validateElection, type ElectionData } from "@/lib/data";
import type { EndorsementFile, Entry } from "@/lib/schema";
import { SF, SM } from "./fixtures/areas";

const root = path.join(process.cwd(), "tests/fixtures/data");

const juris = { level: "city" as const, name: "San Francisco" };
function base(): ElectionData {
  return {
    ballot: {
      election: "2026-11",
      title: "T",
      date: "2026-11-03",
      contests: [
        { id: "prop-b", section: "S", title: "B", kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: juris },
        { id: "board", section: "S", title: "Board", kind: "candidate", candidates: ["A One", "B Two", "C Three", "D Four"], seats: 3, rankedChoice: false, jurisdiction: juris },
      ],
    },
    guides: [{ id: "g", name: "G", description: "", type: "civic", homepage: "https://g.org/", areas: ["sf"] }],
    endorsements: {},
    areas: [SF],
  };
}
function withFile(
  d: ElectionData,
  picks: EndorsementFile["picks"],
  over: Partial<EndorsementFile> = {},
  id = "g",
): ElectionData {
  d.endorsements[id] = { guide: id, election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: false, picks, ...over };
  return d;
}
const e = (pick: Entry["pick"]): Entry => ({ pick, ranked: false, quotes: [] });

describe("data", () => {
  it("requires every contest to be in an area, and districts to say where they are", () => {
    const d = base();
    const m = d.ballot.contests[0];
    d.ballot.contests.push({ ...m, id: "far", jurisdiction: { level: "city", name: "Atlantis" } });
    d.ballot.contests.push({ ...m, id: "dist", jurisdiction: { level: "district", name: "Supervisor", district: "1" } });
    d.ballot.contests.push({
      ...m, id: "wide",
      jurisdiction: { level: "district", name: "Water Board", district: "1", within: [{ level: "county", name: "San Francisco" }, { level: "city", name: "San Francisco" }] },
    });
    expect(validateElection(d).errors).toEqual([
      "dist: district jurisdiction requires within",
      "wide: a local district must be within one place",
      "far: in no area (check its jurisdiction and data/areas.yml)",
      "dist: in no area (check its jurisdiction and data/areas.yml)",
    ]);
  });
  it("fails when an area id collides with a contest id", () => {
    const d = base();
    d.ballot.contests.push({ ...d.ballot.contests[0], id: "sf" });
    expect(validateElection(d).errors).toEqual(["area 'sf' collides with contest 'sf': both would be /2026-11/sf"]);
  });
  it("checks guide areas and that each pick is in one of them", () => {
    const d = base();
    d.areas.push(SM);
    d.ballot.contests.push({ ...d.ballot.contests[0], id: "mp-p", jurisdiction: { level: "city", name: "Menlo Park" } });
    d.guides.push({ ...d.guides[0], id: "x", areas: ["nowhere"] });
    const r = validateElection(withFile(d, { "mp-p": e("Y"), "prop-b": e("N") }));
    expect(r.errors).toEqual(["x: unknown area 'nowhere'", "g/mp-p: contest is outside the guide's areas (sf)"]);
  });
  it("loads an election", () => {
    const d = loadElection(root, "2026-11");
    expect(d.ballot.contests).toHaveLength(2);
    expect(d.guides.map((g) => g.id)).toEqual(["growsf"]);
    expect(d.endorsements.growsf.status).toBe("published");
    expect(d.areas.map((a) => a.id)).toEqual(["sf"]);
  });
  it("reports unknown contests as errors and fuzzy names as warnings", () => {
    const r = validateElection(loadElection(root, "2026-11"));
    expect(r.errors).toEqual(["growsf: unknown contest 'prop-z'"]);
    expect(r.warnings).toEqual(["growsf/assessor: 'Joaquin Torres' matched 'Joaquín Torres' — fix spelling"]);
  });
  it("flags pick/kind mismatch", () => {
    const r = validateElection(withFile(base(), { "prop-b": e(["A One"]), board: e("Y") }));
    expect(r.errors).toEqual([
      "g/prop-b: expected Y/N for a measure contest, got a name list",
      "g/board: expected a name list for a candidate contest, got 'Y'",
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
      "board: district jurisdiction requires within",
      "board: in no area (check its jurisdiction and data/areas.yml)",
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
  it("warns on published files without picks", () => {
    const r = validateElection(withFile(base(), {}, { status: "published" }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(["g: published file has no picks"]);
  });
  it("checks rankedCount against the names and the ranked flag", () => {
    const d = base();
    d.ballot.contests.push({ id: "sup", section: "S", title: "Sup", kind: "candidate", candidates: ["A One", "B Two", "C Three"], seats: 1, rankedChoice: true, jurisdiction: juris });
    const ok = validateElection(withFile(d, { sup: { ...e(["A One", "B Two", "C Three"]), ranked: true, rankedCount: 1 } }));
    expect(ok.errors).toEqual([]);
    const tooMany = validateElection(withFile(structuredClone(d), { sup: { ...e(["A One", "B Two"]), ranked: true, rankedCount: 3 } }));
    expect(tooMany.errors).toEqual(["g/sup: rankedCount 3 exceeds 2 name(s)"]);
    const unranked = validateElection(withFile(structuredClone(d), { sup: { ...e(["A One", "B Two"]), rankedCount: 1 } }));
    expect(unranked.errors).toEqual(["g/sup: rankedCount set on an unranked pick"]);
  });
  it("requires held picks to reference real contests", () => {
    const held = [{ contestId: "prop-zz", pick: "Y" as const, reason: "wrong-pick" as const, evidence: "x" }];
    const r = validateElection(withFile(base(), {}, { status: "pending", held }));
    expect(r.errors).toEqual(["g: held pick for unknown contest 'prop-zz'"]);
    const ok = validateElection(withFile(base(), {}, { status: "pending", held: [{ ...held[0], contestId: "prop-b" }] }));
    expect(ok.errors).toEqual([]);
  });
  it("does not warn on ranked picks beyond seats", () => {
    const d = base();
    d.ballot.contests.push({ id: "sup", section: "S", title: "Sup", kind: "candidate", candidates: ["A One", "B Two"], seats: 1, rankedChoice: true, jurisdiction: juris });
    const r = validateElection(withFile(d, { sup: { ...e(["A One", "B Two"]), ranked: true } }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it("flags a ranked pick on a contest without ranked-choice voting", () => {
    const d = withFile(base(), { board: { ...e(["A One", "B Two"]), ranked: true } });
    expect(validateElection(d).errors).toEqual(["g/board: ranked pick on a contest without ranked-choice voting"]);
  });
  it("does not warn on an unranked dual endorsement in a single-seat race", () => {
    const d = base();
    d.ballot.contests.push({ id: "sup", section: "S", title: "Sup", kind: "candidate", candidates: ["A One", "B Two"], seats: 1, rankedChoice: false, jurisdiction: juris });
    const r = validateElection(withFile(d, { sup: e(["A One", "B Two"]) }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe("loadElection failures", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  function tmp(files: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-"));
    dirs.push(dir);
    for (const [p, c] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), c);
    }
    return dir;
  }
  const ballot = fs.readFileSync(path.join(root, "2026-11/ballot.yml"), "utf8");
  const areas = fs.readFileSync(path.join(root, "areas.yml"), "utf8");
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
  const guide = (id: string) =>
    `id: ${id}\nname: G\ndescription: d\ntype: civic\nhomepage: https://g.org/\nareas: [sf]\n`;
  it("throws when a guide id differs from its filename", () => {
    const dir = tmp({ "2026-11/ballot.yml": ballot, "guides/a.yml": guide("b") });
    expect(() => loadElection(dir, "2026-11")).toThrow(/guides\/a\.yml.*'b'/);
  });
  it("throws on duplicate guide ids", () => {
    const dir = tmp({ "2026-11/ballot.yml": ballot, "guides/a.yml": guide("a"), "guides/b.yml": guide("a") });
    expect(() => loadElection(dir, "2026-11")).toThrow(/b\.yml/);
  });
  it("throws on non-.yml entries but ignores dotfiles", () => {
    const ok = { "2026-11/ballot.yml": ballot, "areas.yml": areas, "guides/.gitkeep": "", "guides/.DS_Store": "" };
    expect(() => loadElection(tmp(ok), "2026-11")).not.toThrow();
    expect(() => loadElection(tmp({ ...ok, "guides/growsf.yaml": guide("growsf") }), "2026-11")).toThrow(/growsf\.yaml/);
    expect(() => loadElection(tmp({ ...ok, "2026-11/endorsements/notes.txt": "x" }), "2026-11")).toThrow(/notes\.txt/);
  });
  it("throws with the path when areas.yml is missing or has a duplicate id", () => {
    expect(() => loadElection(tmp({ "2026-11/ballot.yml": ballot }), "2026-11")).toThrow(/areas\.yml/);
    const dup = `areas:\n${areas.split("areas:\n")[1]}${areas.split("areas:\n")[1]}`;
    expect(() => loadElection(tmp({ "2026-11/ballot.yml": ballot, "areas.yml": dup }), "2026-11")).toThrow(/duplicate area id 'sf'/);
  });
  it("throws when ballot election differs from directory", () => {
    const dir = tmp({ "2026-06/ballot.yml": ballot });
    expect(() => loadElection(dir, "2026-06")).toThrow(/ballot\.yml: election '2026-11' does not match directory '2026-06'/);
  });
});
