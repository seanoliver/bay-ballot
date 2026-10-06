import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ballotViewProps, election, elections, latestElection } from "@/lib/site-data";
import type { ElectionData } from "@/lib/data";
import type { EndorsementFile } from "@/lib/schema";

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
        { id: "g", name: "G", type: "civic", description: "long", homepage: "https://g.org" },
        { id: "p", name: "P", type: "club", description: "", homepage: "https://p.org" },
      ],
      endorsements: { g: { ...file(), source: "https://g.org/a" }, p: { ...file(), guide: "p", status: "pending" } },
    } as ElectionData;
    expect(ballotViewProps(d)).toEqual({
      ballot: d.ballot,
      guides: [{ id: "g", name: "G", type: "civic" }],
      files: { g: { hasReasoning: true, picks: {} } },
      pending: "1 guide hasn't published yet.",
    });
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
