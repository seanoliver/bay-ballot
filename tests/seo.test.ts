import { describe, expect, it } from "vitest";
import { latestFetchDay, SITE, sitemapEntries } from "@/lib/seo";

describe("latestFetchDay", () => {
  it("is the newest fetch date among published guides", () => {
    const f = (fetchedAt: string, status: "published" | "pending" = "published") => ({ fetchedAt, status });
    expect(latestFetchDay({ a: f("2026-10-01"), b: f("2026-10-04T22:15:00Z"), c: f("2026-10-09", "pending") })).toBe("2026-10-04");
    expect(latestFetchDay({})).toBeNull();
  });
});

describe("sitemapEntries", () => {
  const entries = sitemapEntries({
    elections: [{ id: "2026-11", contests: ["prop-b", "us-rep-11"] }],
    guides: ["spur", "growsf"],
    lastModified: "2026-10-05",
  });
  const urls = entries.map((e) => e.url);

  it("lists the election, every contest, every guide and /about, absolute on bayballot.com", () => {
    expect(urls).toEqual([
      "https://bayballot.com/2026-11",
      "https://bayballot.com/2026-11/prop-b",
      "https://bayballot.com/2026-11/us-rep-11",
      "https://bayballot.com/guides/spur",
      "https://bayballot.com/guides/growsf",
      "https://bayballot.com/about",
    ]);
  });
  it("never lists a preview host or the redirecting root", () => {
    expect(urls.every((u) => u.startsWith(`${SITE}/`))).toBe(true);
    expect(urls).not.toContain(`${SITE}/`);
    expect(SITE).toBe("https://bayballot.com");
  });
  it("dates every entry from the data", () => {
    expect(new Set(entries.map((e) => e.lastModified))).toEqual(new Set(["2026-10-05"]));
  });
});
