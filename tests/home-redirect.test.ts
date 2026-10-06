import { describe, expect, it } from "vitest";
import { createHomeVisit, homeRedirect, type KeyValueStore } from "@/lib/home-redirect";

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

const store = (init: Record<string, string>, { failWrites = false }: { failWrites?: boolean } = {}): KeyValueStore => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      if (failWrites) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
  };
};

describe("createHomeVisit", () => {
  it("redirects once even when the marker can't be saved", () => {
    const visit = createHomeVisit();
    const s = store({ "bb-filters": "why=1" }, { failWrites: true });
    expect(visit(s, { area: null, query: "" })).toBe("sf");
    expect(visit(s, { area: "sf", query: "" })).toBeNull();
    expect(visit(s, { area: null, query: "" })).toBeNull();
  });
  it("never redirects a visitor whose first list page was /sf", () => {
    const s = store({ "bb-filters": "why=1" });
    expect(createHomeVisit()(s, { area: "sf", query: "" })).toBeNull();
    expect(createHomeVisit()(s, { area: null, query: "" })).toBeNull();
  });
  it("treats storage that throws on read as empty", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(createHomeVisit()(broken, { area: null, query: "" })).toBeNull();
  });
});
