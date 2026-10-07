import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
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

describe("ballot and area files", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  function tmp(files: Record<string, string | null>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-"));
    dirs.push(dir);
    for (const [p, c] of Object.entries({ ...base, ...files })) {
      if (c === null) continue;
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), c);
    }
    return dir;
  }
  const load = (files: Record<string, string | null> = {}) => loadElection(tmp(files), "2026-11");
  const area = (id: string, order: number, county: string, city?: string) =>
    `id: ${id}\nname: ${id}\nkind: ${city ? "city" : "county"}\norder: ${order}\njurisdictions:\n  - { level: state, name: California }\n  - { level: county, name: ${county} }\n${city ? `  - { level: city, name: ${city} }\n` : ""}`;
  const contest = (id: string, section: string, jurisdiction: string) =>
    `  - id: ${id}\n    section: ${section}\n    title: ${id}\n    kind: measure\n    jurisdiction: ${jurisdiction}\n`;
  const sf = "{ level: city, name: San Francisco }";
  const smc = "{ level: county, name: San Mateo }";
  const base: Record<string, string> = {
    "areas/sf.yml": area("sf", 10, "San Francisco", "San Francisco"),
    "areas/san-mateo.yml": area("san-mateo", 20, "San Mateo"),
    "2026-11/ballot.yml":
      "election: 2026-11\ntitle: T\ndate: 2026-11-03\ncontests:\n" +
      contest("governor", "State", "{ level: state, name: California }") +
      contest("prop-1", "State propositions", "{ level: state, name: California }") +
      contest("rtm", "Regional measures", `{ level: region, name: Bay Area, within: [${smc}] }`),
    "2026-11/ballot/san-mateo.yml": "contests:\n" + contest("smc-a", "Local measures", smc) + contest("smc-b", "Local candidates", smc),
    "2026-11/ballot/san-francisco.yml":
      "placement:\n  Local candidates: State\n  Local propositions: Regional measures\ncontests:\n" +
      contest("sup-1", "Local candidates", sf) +
      contest("prop-a", "Local propositions", sf) +
      contest("sup-2", "Local candidates", sf),
  };

  it("merges shared contests and county files in area order, placing sections a county file names", () => {
    expect(load().ballot.contests.map((c) => c.id)).toEqual(["governor", "sup-1", "sup-2", "prop-1", "rtm", "prop-a", "smc-a", "smc-b"]);
  });
  it("orders areas by their order field and leaves the field out", () => {
    const d = load({
      "areas/sf.yml": area("sf", 30, "San Francisco", "San Francisco"),
      "2026-11/ballot/san-francisco.yml": "contests:\n" + contest("sup-1", "Local candidates", sf),
    });
    expect(d.areas.map((a) => a.id)).toEqual(["san-mateo", "sf"]);
    expect(d.ballot.contests.map((c) => c.id)).toEqual(["governor", "prop-1", "rtm", "smc-a", "smc-b", "sup-1"]);
    expect(d.areas[0]).not.toHaveProperty("order");
  });
  it("names both files on a duplicate contest id", () => {
    const dup = "contests:\n" + contest("governor", "Local measures", smc);
    expect(() => load({ "2026-11/ballot/san-mateo.yml": dup })).toThrow(/duplicate contest id 'governor' in .*2026-11\/ballot\.yml and .*2026-11\/ballot\/san-mateo\.yml/);
  });
  it("rejects a county file contest from another county", () => {
    const wrong = "contests:\n" + contest("smc-a", "Local measures", sf);
    expect(() => load({ "2026-11/ballot/san-mateo.yml": wrong })).toThrow(/ballot\/san-mateo\.yml: smc-a is a San Francisco contest, not San Mateo/);
  });
  it("rejects a county contest in the shared ballot", () => {
    const shared = "election: 2026-11\ntitle: T\ndate: 2026-11-03\ncontests:\n" + contest("smc-z", "Local measures", smc);
    expect(() => load({ "2026-11/ballot.yml": shared })).toThrow(/2026-11\/ballot\.yml: smc-z is a San Mateo contest; move it to ballot\/san-mateo\.yml/);
  });
  it("rejects a file that names no county in the areas", () => {
    expect(() => load({ "2026-11/ballot/marin.yml": "contests:\n" + contest("m", "Local measures", "{ level: county, name: Marin }") })).toThrow(
      /ballot\/marin\.yml: no area is in a county with this slug \(known: san-francisco, san-mateo\)/,
    );
    expect(() => load({ "2026-11/ballot/notes.txt": "x" })).toThrow(/notes\.txt/);
  });
  it("rejects a placement after a section the shared ballot lacks", () => {
    const bad = "placement:\n  Local candidates: Judicial\ncontests:\n" + contest("sup-1", "Local candidates", sf);
    expect(() => load({ "2026-11/ballot/san-francisco.yml": bad })).toThrow(/san-francisco\.yml: placement section 'Judicial' is not in ballot\.yml/);
  });
  it("rejects an area file whose id differs from its filename, or a missing areas directory", () => {
    expect(() => load({ "areas/sf.yml": area("san-fran", 10, "San Francisco", "San Francisco") })).toThrow(/areas\/sf\.yml: filename does not match area id 'san-fran'/);
    expect(() => load({ "areas/sf.yml": null, "areas/san-mateo.yml": null, "2026-11/ballot/san-francisco.yml": null, "2026-11/ballot/san-mateo.yml": null })).toThrow(/areas: no area files/);
  });
});
