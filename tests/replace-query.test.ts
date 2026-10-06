import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

function stubWindow() {
  const location = { pathname: "/2026-11", search: "" };
  const replaceState = vi.fn((_d: unknown, _u: string, url: string) => {
    const [path, search = ""] = url.split("?");
    location.pathname = path;
    location.search = search ? `?${search}` : "";
  });
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { history: { replaceState }, location, dispatchEvent });
  return { location, replaceState, dispatchEvent };
}

describe("replaceQuery", () => {
  it("writes the query and announces the change", async () => {
    const w = stubWindow();
    const { replaceQuery, currentSearch } = await import("@/components/useBallotFilters");
    replaceQuery("c=us-rep-11");
    expect(w.replaceState).toHaveBeenCalledTimes(1);
    expect(w.location.search).toBe("?c=us-rep-11");
    expect(currentSearch()).toBe("?c=us-rep-11");
    expect(w.dispatchEvent).toHaveBeenCalledTimes(1);
  });
  it("past 35 writes in 10 seconds, defers the latest and reports it as current until it is written", async () => {
    vi.useFakeTimers();
    const w = stubWindow();
    const { replaceQuery, currentSearch } = await import("@/components/useBallotFilters");
    for (let i = 0; i < 35; i++) replaceQuery(`c=x${i}`);
    replaceQuery("c=late");
    replaceQuery("c=later&why=1");
    expect(w.replaceState).toHaveBeenCalledTimes(35);
    expect(w.location.search).toBe("?c=x34");
    expect(currentSearch()).toBe("?c=later&why=1");
    vi.advanceTimersByTime(10_000);
    expect(w.replaceState).toHaveBeenCalledTimes(36);
    expect(w.location.search).toBe("?c=later&why=1");
  });
  it("drops a deferred write once the page has changed", async () => {
    vi.useFakeTimers();
    const w = stubWindow();
    const { replaceQuery } = await import("@/components/useBallotFilters");
    for (let i = 0; i < 36; i++) replaceQuery(`c=x${i}`);
    w.location.pathname = "/guides/growsf";
    w.location.search = "";
    vi.advanceTimersByTime(10_000);
    expect(w.replaceState).toHaveBeenCalledTimes(35);
    expect(w.location.search).toBe("");
  });
  it("a throwing replaceState doesn't throw out of replaceQuery", async () => {
    const w = stubWindow();
    w.replaceState.mockImplementation(() => {
      throw new DOMException("too many calls", "SecurityError");
    });
    const { replaceQuery } = await import("@/components/useBallotFilters");
    expect(() => replaceQuery("c=us-rep-11")).not.toThrow();
  });
});
