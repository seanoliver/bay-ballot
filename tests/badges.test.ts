import path from "node:path";
import { describe, expect, it } from "vitest";
import { countyPages } from "@/lib/areas";
import { badge } from "@/lib/badges";
import { loadElection } from "@/lib/data";
import { publishedFiles } from "@/lib/filters";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

describe("badge", () => {
  it("counts guides with published picks", () => {
    const b = badge(d, "guides");
    expect(b).toMatchObject({ schemaVersion: 1, label: "voter guides" });
    expect(Number(b.message)).toBe(Object.keys(publishedFiles(d.endorsements)).length);
    expect(Number(b.message)).toBeGreaterThan(0);
  });

  it("counts one county per county page, with SF as its own", () => {
    const b = badge(d, "counties");
    expect(b.label).toBe("counties");
    expect(Number(b.message)).toBe(countyPages(d.areas).length);
  });
});
