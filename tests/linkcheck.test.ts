import { describe, expect, it } from "vitest";
import { checkLinks, probeLink } from "@/pipeline/linkcheck";
import type { EndorsementFile } from "@/lib/schema";

const respond = (status: number, url: string) => async () => Object.defineProperty(new Response(null, { status }), "url", { value: url });

describe("probeLink", () => {
  it("counts 404 and 410 as gone", async () => {
    expect(await probeLink("https://g.org/a", respond(404, "https://g.org/a"))).toBe("gone");
    expect(await probeLink("https://g.org/a", respond(410, "https://g.org/a"))).toBe("gone");
  });
  it("counts blocks and outages as unknown", async () => {
    for (const status of [403, 429, 500, 503]) expect(await probeLink("https://g.org/a", respond(status, "https://g.org/a"))).toBe("unknown");
    expect(await probeLink("https://g.org/a", async () => { throw new Error("timeout"); })).toBe("unknown");
  });
  it("counts a dead domain as gone", async () => {
    const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    expect(await probeLink("https://g.org/a", async () => { throw dns; })).toBe("gone");
  });
  it("counts a redirect from a page to the home page as gone", async () => {
    expect(await probeLink("https://g.org/2026", respond(200, "https://g.org/"))).toBe("gone");
    expect(await probeLink("https://g.org/", respond(200, "https://g.org/"))).toBe("live");
    expect(await probeLink("https://g.org/a", respond(200, "https://g.org/b"))).toBe("live");
  });
});

describe("checkLinks", () => {
  const file = (archived: EndorsementFile["archived"]) => ({ archived }) as EndorsementFile;
  const snap = (s: string) => `https://web.archive.org/web/1/${s}`;
  it("marks a gone source and clears one that came back", async () => {
    const f = file([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a") },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b"), gone: "2026-11-01" },
    ]);
    const r = await checkLinks(f, { today: "2026-11-03", probe: async (u) => (u.endsWith("/a") ? "gone" : "live") });
    expect(r?.file.archived).toEqual([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a"), gone: "2026-11-03" },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b") },
    ]);
    expect(r?.changes.map((c) => c.now)).toEqual(["gone", "live"]);
  });
  it("changes nothing when a probe is unknown or the state holds", async () => {
    const f = file([
      { source: "https://g.org/a", snapshot: snap("https://g.org/a"), gone: "2026-11-01" },
      { source: "https://g.org/b", snapshot: snap("https://g.org/b") },
    ]);
    expect(await checkLinks(f, { today: "2026-11-03", probe: async () => "unknown" })).toBeNull();
    expect(await checkLinks(f, { today: "2026-11-03", probe: async (u) => (u.endsWith("/a") ? "gone" : "live") })).toBeNull();
    expect(await checkLinks(file(undefined), { today: "2026-11-03" })).toBeNull();
  });
});
