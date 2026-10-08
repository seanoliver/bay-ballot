import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reservedSegments, shortLinkCollisions, shortLinkRedirects, siteShortLinks } from "@/lib/short-links";

function site({ app, areas, elections = ["2026-11"] }: { app: string[]; areas: string[]; elections?: string[] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bb-sl-"));
  for (const e of app) {
    const p = path.join(root, "src/app", e);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (path.extname(e)) fs.writeFileSync(p, "");
    else fs.mkdirSync(p, { recursive: true });
  }
  fs.mkdirSync(path.join(root, "data/areas"), { recursive: true });
  for (const a of areas) fs.writeFileSync(path.join(root, "data/areas", `${a}.yml`), `id: ${a}\n`);
  for (const e of elections) fs.mkdirSync(path.join(root, "data", e));
  return root;
}

describe("shortLinkRedirects", () => {
  it("sends each area's short link to its page for the election, temporarily", () => {
    expect(shortLinkRedirects({ areaIds: ["sf", "marin"], election: "2026-11", reserved: ["about"] })).toEqual([
      { source: "/sf", destination: "/2026-11/sf", permanent: false },
      { source: "/marin", destination: "/2026-11/marin", permanent: false },
    ]);
  });
  it("refuses an area id that would shadow a top-level route", () => {
    expect(() => shortLinkRedirects({ areaIds: ["sf", "about"], election: "2026-11", reserved: ["about"] })).toThrow(/about/);
  });
});

describe("shortLinkCollisions", () => {
  it("flags reserved names and ids shaped like an election", () => {
    expect(shortLinkCollisions(["sf", "guides", "2028-03", "favicon"], ["guides", "favicon"])).toEqual([
      "area 'guides' collides with the top-level route /guides",
      "area '2028-03' looks like an election id",
      "area 'favicon' collides with the top-level route /favicon",
    ]);
  });
  it("always reserves api and _next", () => {
    expect(shortLinkCollisions(["api"], [])).toEqual(["area 'api' collides with the top-level route /api"]);
  });
});

describe("reservedSegments", () => {
  it("lists every top-level route, file and file stem in the app and public dirs", () => {
    const root = site({ app: ["about/page.tsx", "[election]/page.tsx", "sitemap.ts", "favicon.ico", "(group)/x/page.tsx"], areas: [] });
    fs.mkdirSync(path.join(root, "public"));
    fs.writeFileSync(path.join(root, "public/og.png"), "");
    const r = reservedSegments(root);
    for (const name of ["about", "sitemap", "sitemap.xml", "favicon", "favicon.ico", "og", "og.png", "x", "api", "_next"]) expect(r).toContain(name);
    expect(r).not.toContain("[election]");
  });
});

describe("siteShortLinks", () => {
  it("points every area file at the latest election", () => {
    const root = site({ app: ["about/page.tsx"], areas: ["sf", "oakland"], elections: ["2026-06", "2026-11"] });
    expect(siteShortLinks(root).map((r) => [r.source, r.destination])).toEqual([
      ["/oakland", "/2026-11/oakland"],
      ["/sf", "/2026-11/sf"],
    ]);
  });
  it("fails the build when an area file collides with a route", () => {
    const root = site({ app: ["changelog/page.tsx"], areas: ["changelog"] });
    expect(() => siteShortLinks(root)).toThrow(/area 'changelog' collides with the top-level route \/changelog/);
  });
  it("has a short link for every real area and no collisions", () => {
    const ids = siteShortLinks().map((r) => r.source.slice(1));
    expect(ids).toEqual(expect.arrayContaining(["sf", "marin", "san-mateo", "santa-clara-county"]));
  });
});
