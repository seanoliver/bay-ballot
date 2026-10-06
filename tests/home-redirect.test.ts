import { describe, expect, it } from "vitest";
import { homeRedirect } from "@/lib/home-redirect";

const base = { query: "", storedFilters: null, storedDistricts: null, seen: null };

describe("homeRedirect", () => {
  it("sends a returning visitor with saved filters to the SF page", () => {
    expect(homeRedirect({ ...base, storedFilters: "off=sf-gop" })).toBe("sf");
    expect(homeRedirect({ ...base, storedFilters: "why=1" })).toBe("sf");
  });
  it("sends a visitor with saved SF districts to the SF page", () => {
    expect(homeRedirect({ ...base, storedDistricts: "sf.s8.a17.c11.b8.e2" })).toBe("sf");
  });
  it("leaves a new visitor, a reset filter and a shared link on the Bay Area list", () => {
    expect(homeRedirect(base)).toBeNull();
    expect(homeRedirect({ ...base, storedFilters: "" })).toBeNull();
    expect(homeRedirect({ ...base, storedFilters: "why=1", query: "?c=prop-b" })).toBeNull();
  });
  it("redirects at most once", () => {
    expect(homeRedirect({ ...base, storedFilters: "why=1", seen: "bay-area" })).toBeNull();
    expect(homeRedirect({ ...base, storedDistricts: "sf.s8", seen: "sf" })).toBeNull();
  });
});
