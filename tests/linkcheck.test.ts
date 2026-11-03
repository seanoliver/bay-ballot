import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { checkAllLinks, checkLinks, flagLine, probeLink, withArchived, type LinkState } from "@/pipeline/linkcheck";
import type { EndorsementFile } from "@/lib/schema";

const respond = (status: number, url: string) => async () => Object.defineProperty(new Response(null, { status }), "url", { value: url });

describe("probeLink", () => {
  it("counts 404 and 410 as gone", async () => {
    expect(await probeLink("https://g.org/a", respond(404, "https://g.org/a"))).toBe("gone");
    expect(await probeLink("https://g.org/a", respond(410, "https://g.org/a"))).toBe("gone");
  });
  it("counts blocks, outages and other network errors as unknown", async () => {
    for (const status of [403, 429, 500, 503]) expect(await probeLink("https://g.org/a", respond(status, "https://g.org/a"))).toBe("unknown");
    expect(await probeLink("https://g.org/a", async () => { throw new Error("timeout"); })).toBe("unknown");
    const retry = Object.assign(new TypeError("fetch failed"), { cause: { code: "EAI_AGAIN" } });
    expect(await probeLink("https://g.org/a", async () => { throw retry; })).toBe("unknown");
  });
  it("counts a dead domain as gone", async () => {
    const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    expect(await probeLink("https://g.org/a", async () => { throw dns; })).toBe("gone");
  });
  it("counts any page that loads as live, wherever it redirects", async () => {
    expect(await probeLink("https://g.org/endorsements/", respond(200, "https://g.org/"))).toBe("live");
    expect(await probeLink("https://g.org/a", respond(200, "https://other.org/"))).toBe("live");
  });
});

describe("checkLinks", () => {
  const file = (archived: EndorsementFile["archived"]) => ({ archived }) as EndorsementFile;
  const snap = (s: string) => `https://web.archive.org/web/1/${s}`;
  const sequence = (states: Record<string, LinkState[]>) => async (u: string) => states[u].shift()!;

  it("marks a source gone only when a second probe agrees, and clears one that came back", async () => {
    const f = file([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a") },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b"), gone: "2026-11-01" },
      { source: "https://g.org/c", snapshot: snap("https://g.org/c") },
    ]);
    const probe = sequence({ "https://g.org/a": ["gone", "gone"], "https://g.org/b": ["live"], "https://g.org/c": ["gone", "live"] });
    const r = await checkLinks(f, { today: "2026-11-03", probe, recheckMs: 0 });
    expect(r?.archived).toEqual([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a"), gone: "2026-11-03" },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b") },
      { source: "https://g.org/c", snapshot: snap("https://g.org/c") },
    ]);
    expect(r?.changes).toEqual([
      { source: "https://g.org/a", now: "gone" },
      { source: "https://g.org/b", now: "live" },
    ]);
  });
  it("changes nothing when a probe is unknown or the state holds", async () => {
    const f = file([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a"), gone: "2026-11-01" },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b") },
    ]);
    expect(await checkLinks(f, { today: "2026-11-03", probe: async () => "unknown", recheckMs: 0 })).toBeNull();
    expect(await checkLinks(f, { today: "2026-11-03", probe: async (u) => (u.endsWith("/a") ? "gone" : "live"), recheckMs: 0 })).toBeNull();
    expect(await checkLinks(file(undefined), { today: "2026-11-03" })).toBeNull();
  });
});

describe("withArchived", () => {
  it("rewrites only the archived list and keeps the file's layout and comments", () => {
    const before = [
      "guide: g",
      "manual: true # entered by hand",
      "archived:",
      "  - source: https://g.org/a",
      "    snapshot: https://web.archive.org/web/1/https://g.org/a",
      "picks:",
      "  prop-a: { pick: Y, quotes: [] }",
      "",
    ].join("\n");
    const after = withArchived(before, [{ source: "https://g.org/a", snapshot: "https://web.archive.org/web/1/https://g.org/a", gone: "2026-11-03" }]);
    expect(after).toBe(before.replace("https://g.org/a\npicks:", "https://g.org/a\n    gone: 2026-11-03\npicks:"));
    expect(parse(after).archived[0].gone).toBe("2026-11-03");
  });
});

describe("checkAllLinks", () => {
  it("checks every file with archived sources and returns only the ones that change, by id", async () => {
    const entry = (u: string, gone?: string) => [{ source: u, snapshot: `https://web.archive.org/web/1/${u}`, ...(gone ? { gone } : {}) }];
    const files = {
      b: { archived: entry("https://b.org/") },
      a: { archived: entry("https://a.org/", "2026-11-01") },
      c: { archived: entry("https://c.org/") },
      d: {},
    } as unknown as Record<string, EndorsementFile>;
    const seen: string[] = [];
    const probe = async (u: string): Promise<LinkState> => (seen.push(u), u === "https://c.org/" ? "live" : u === "https://a.org/" ? "live" : "gone");
    const r = await checkAllLinks(files, { today: "2026-11-03", probe, recheckMs: 0, workers: 2 });
    expect(r.map((x) => [x.id, x.changes.map((c) => c.now)])).toEqual([["a", ["live"]], ["b", ["gone"]]]);
    expect(new Set(seen)).toEqual(new Set(["https://a.org/", "https://b.org/", "https://c.org/"]));
  });
});

describe("flagLine", () => {
  it("says what to do for a missing page and for one that came back", () => {
    expect(flagLine("g", { source: "https://g.org/a", now: "gone" })).toBe(
      "g: https://g.org/a is missing. Find where the guide moved it and update the source, or run `npm run bb -- check-links` to link the Wayback copy.",
    );
    expect(flagLine("g", { source: "https://g.org/b", now: "live" })).toBe(
      "g: https://g.org/b is marked gone but loads again. Check it is still the guide's page, then run `npm run bb -- check-links` to link it again.",
    );
  });
});
