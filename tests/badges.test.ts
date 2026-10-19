import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/badges/[name]/route";
import { countyPages } from "@/lib/areas";
import { badge } from "@/lib/badges";
import { coverage } from "@/lib/coverage";
import { loadElection } from "@/lib/data";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

describe("badge", () => {
  it("counts the guides the About page counts", () => {
    expect(badge(d, "guides")).toEqual({ schemaVersion: 1, label: "voter guides", message: String(coverage(d).guides), color: "blue" });
  });

  it("counts the counties the About page counts, with SF as its own", () => {
    expect(badge(d, "counties")).toEqual({ schemaVersion: 1, label: "counties", message: String(coverage(d).counties), color: "blue" });
    expect(countyPages(d.areas).map((a) => a.id)).toContain("sf");
  });
});

describe("GET /badges/[name]", () => {
  const get = (name: string) => GET(new Request(`https://bayballot.com/badges/${name}`), { params: Promise.resolve({ name }) });

  it("serves each badge as shields.io endpoint JSON", async () => {
    for (const name of ["guides", "counties"] as const) {
      const res = await get(name);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(badge(d, name));
    }
  });

  it("404s an unknown badge", async () => {
    expect((await get("bogus")).status).toBe(404);
  });
});
