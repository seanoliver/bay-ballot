import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { election, elections, latestElection, sourceLink } from "@/lib/site-data";
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

describe("sourceLink", () => {
  it("returns the archived snapshot for a matching source", () => {
    const f = file([
      { source: "https://g.org/a", snapshot: "https://web.archive.org/web/1/https://g.org/a" },
      { source: "https://g.org/b", snapshot: "https://web.archive.org/web/2/https://g.org/b" },
    ]);
    expect(sourceLink(f, "https://g.org/b")).toBe("https://web.archive.org/web/2/https://g.org/b");
  });
  it("falls back to the live url when no snapshot matches", () => {
    const f = file([{ source: "https://g.org/a", snapshot: "https://web.archive.org/web/1/https://g.org/a" }]);
    expect(sourceLink(f, "https://g.org/c")).toBe("https://g.org/c");
  });
  it("falls back to the live url when nothing is archived", () => {
    expect(sourceLink(file(), "https://g.org/a")).toBe("https://g.org/a");
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
