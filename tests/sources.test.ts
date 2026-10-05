import { describe, expect, it } from "vitest";
import type { EndorsementFile, Guide } from "@/lib/schema";
import { checkHosts, fetchMode, sourcesFor } from "@/pipeline/sources";

const guide = {
  id: "spur", name: "SPUR", description: "d", type: "civic", homepage: "https://www.spur.org/",
} as Guide;
const base: EndorsementFile = {
  guide: "spur", election: "2026-11", status: "pending", fetchedAt: "2026-10-05", hasReasoning: false, picks: {},
};

describe("checkHosts", () => {
  it("accepts sources on the homepage host", () => {
    expect(checkHosts(guide, {
      ...base, source: "https://www.spur.org/voter-guide/2026-11",
      extraSources: ["https://www.spur.org/voter-guide/2026-11/sf-prop-b"],
    })).toEqual([]);
  });

  it("ignores a leading www. on either side", () => {
    expect(checkHosts(guide, { ...base, source: "https://spur.org/voter-guide/2026-11" })).toEqual([]);
    const bare = { ...guide, homepage: "https://sftu.org/" };
    expect(checkHosts(bare, { ...base, source: "https://www.sftu.org/endorsements/" })).toEqual([]);
  });

  it("flags a foreign source and each foreign extra source", () => {
    const problems = checkHosts(guide, {
      ...base, source: "https://news.example.com/spur-picks",
      extraSources: ["https://www.spur.org/ok", "https://cdn.example.net/guide.pdf"],
    });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("news.example.com");
    expect(problems[0]).toContain("spur.org");
    expect(problems[1]).toContain("cdn.example.net");
  });

  it("does not treat a subdomain or lookalike as the same host", () => {
    expect(checkHosts(guide, { ...base, source: "https://evil-spur.org/x" })).toHaveLength(1);
    expect(checkHosts(guide, { ...base, source: "https://spur.org.evil.com/x" })).toHaveLength(1);
    expect(checkHosts(guide, { ...base, source: "https://blog.spur.org/x" })).toHaveLength(1);
  });

  it("is skipped when allowForeignSources is set", () => {
    expect(checkHosts(guide, {
      ...base, allowForeignSources: true, source: "https://cdn.example.net/guide.pdf",
    })).toEqual([]);
  });

  it("has nothing to check without sources", () => {
    expect(checkHosts(guide, base)).toEqual([]);
  });
});

describe("sourcesFor", () => {
  it("lists the source then extra sources", () => {
    expect(sourcesFor({ ...base, source: "https://a.org/1", extraSources: ["https://a.org/2", "https://a.org/3"] }))
      .toEqual(["https://a.org/1", "https://a.org/2", "https://a.org/3"]);
    expect(sourcesFor({ ...base, source: "https://a.org/1" })).toEqual(["https://a.org/1"]);
  });
  it("is empty without a source", () => {
    expect(sourcesFor(base)).toEqual([]);
  });
});

describe("fetchMode", () => {
  it("uses the browser when the file or the flag asks for it", () => {
    expect(fetchMode(base, false)).toBe("http");
    expect(fetchMode({ ...base, fetchWith: "http" }, false)).toBe("http");
    expect(fetchMode(base, true)).toBe("browser");
    expect(fetchMode({ ...base, fetchWith: "browser" }, false)).toBe("browser");
  });
});
