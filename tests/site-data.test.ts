import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ballotViewProps, election, elections, latestElection } from "@/lib/site-data";
import type { ElectionData } from "@/lib/data";
import type { Contest, EndorsementFile, Entry } from "@/lib/schema";
import { activeEntries, EMPTY } from "@/lib/filters";
import { SF, SM } from "./fixtures/areas";

const file = (archived?: EndorsementFile["archived"]): EndorsementFile => ({
  guide: "g",
  election: "2026-11",
  status: "published",
  fetchedAt: "2026-10-05",
  hasReasoning: true,
  picks: {},
  ...(archived ? { archived } : {}),
});

describe("ballotViewProps", () => {
  it("passes only published guides and files, slimmed, plus the pending note", () => {
    const d = {
      ballot: { election: "2026-11", title: "T", date: "2026-11-03", contests: [] },
      guides: [
        { id: "g", name: "G", type: "civic", description: "long", homepage: "https://g.org", areas: ["sf"] },
        { id: "p", name: "P", type: "club", description: "", homepage: "https://p.org", areas: ["sf"] },
      ],
      endorsements: { g: { ...file(), source: "https://g.org/a" }, p: { ...file(), guide: "p", status: "pending" } },
      areas: [],
    } as ElectionData;
    expect(ballotViewProps(d)).toEqual({
      ballot: d.ballot,
      groups: [],
      guides: [{ id: "g", name: "G", type: "civic" }],
      files: { g: { hasReasoning: true, picks: {} } },
      pending: "1 guide hasn't published yet.",
    });
  });
});

describe("ballotViewProps with an area", () => {
  const juris = (level: "state" | "city", name: string) => ({ level, name });
  const contest = (id: string, j: Contest["jurisdiction"]) =>
    ({ id, section: "S", title: id, kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: j }) as Contest;
  const y = { pick: "Y", ranked: false, quotes: [] } as Entry;
  const guide = (id: string, areas: string[]) => ({ id, name: id.toUpperCase(), type: "club", description: "", homepage: `https://${id}.org`, areas });
  const d = {
    ballot: {
      election: "2026-11", title: "T", date: "2026-11-03",
      contests: [contest("prop-1", juris("state", "California")), contest("prop-b", juris("city", "San Francisco")), contest("mp-p", juris("city", "Menlo Park"))],
    },
    areas: [SF, SM],
    guides: [guide("s", ["sf"]), guide("m", ["san-mateo"]), guide("p", ["sf"])],
    endorsements: {
      s: { ...file(), guide: "s", picks: { "prop-1": y, "prop-b": y } },
      m: { ...file(), guide: "m", picks: { "prop-1": y, "mp-p": y } },
      p: { ...file(), guide: "p", status: "pending" },
    },
  } as ElectionData;

  it("keeps the area's contests and only its guides", () => {
    const v = ballotViewProps(d, { area: SF });
    expect(v.ballot.contests.map((c) => c.id)).toEqual(["prop-1", "prop-b"]);
    expect(v.guides.map((g) => g.id)).toEqual(["s"]);
    expect(Object.keys(v.files)).toEqual(["s"]);
    expect(v.pending).toBe("1 guide hasn't published yet.");
    expect(v.groups.map((g) => g.heading)).toEqual(["California", "San Francisco"]);
  });
  it("counts a statewide contest with every guide on the Bay Area list and only the area's guides on an area page", () => {
    const counted = (v: ReturnType<typeof ballotViewProps>) => activeEntries("prop-1", v.guides, v.files, EMPTY).length;
    expect(counted(ballotViewProps(d))).toBe(2);
    expect(counted(ballotViewProps(d, { area: SM }))).toBe(1);
    expect(counted(ballotViewProps(d, { area: SF }))).toBe(1);
  });
});

describe("elections", () => {
  let tmp: string | null = null;
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  });
  function root(dirs: string[]): string {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-site-"));
    for (const d of dirs) fs.mkdirSync(path.join(tmp, d));
    return tmp;
  }

  it("lists election directories in order, ignoring guides/", () => {
    expect(elections(root(["2026-11", "guides", "2024-03"]))).toEqual(["2024-03", "2026-11"]);
  });
  it("latestElection picks the newest election", () => {
    expect(latestElection(root(["2024-11", "2026-11", "2026-06", "guides"]))).toBe("2026-11");
  });
  it("latestElection throws when there are no elections", () => {
    expect(() => latestElection(root(["guides"]))).toThrow(/no elections/);
  });
  it("defaults to the repo data/ directory", () => {
    expect(latestElection()).toBe("2026-11");
  });
});

describe("election", () => {
  it("loads a known election", () => {
    const d = election("2026-11");
    expect(d?.ballot.election).toBe("2026-11");
    expect(d?.guides.length).toBeGreaterThan(0);
  });
  it("returns undefined for unknown and path-like ids", () => {
    expect(election("2099-01")).toBeUndefined();
    expect(election("../x")).toBeUndefined();
    expect(election("guides")).toBeUndefined();
    expect(election("2026-11/../2026-11")).toBeUndefined();
  });
});
