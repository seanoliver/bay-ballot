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
  vi.stubGlobal("window", { history: { replaceState }, location, dispatchEvent, addEventListener: vi.fn() });
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
  it("past 45 writes (90 browser calls) in 10 seconds, defers the latest and reports it as current until it is written", async () => {
    vi.useFakeTimers();
    const w = stubWindow();
    const { replaceQuery, currentSearch } = await import("@/components/useBallotFilters");
    for (let i = 0; i < 45; i++) replaceQuery(`c=x${i}`);
    replaceQuery("c=late");
    replaceQuery("c=later&why=1");
    expect(w.replaceState).toHaveBeenCalledTimes(45);
    expect(w.location.search).toBe("?c=x44");
    expect(currentSearch()).toBe("?c=later&why=1");
    vi.advanceTimersByTime(10_000);
    expect(w.replaceState).toHaveBeenCalledTimes(46);
    expect(w.location.search).toBe("?c=later&why=1");
  });
  it("drops a deferred write once the page has changed", async () => {
    vi.useFakeTimers();
    const w = stubWindow();
    const { replaceQuery } = await import("@/components/useBallotFilters");
    for (let i = 0; i < 46; i++) replaceQuery(`c=x${i}`);
    w.location.pathname = "/guides/growsf";
    w.location.search = "";
    vi.advanceTimersByTime(10_000);
    expect(w.replaceState).toHaveBeenCalledTimes(45);
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
  it("counts each popstate as one browser call", async () => {
    vi.useFakeTimers();
    const w = stubWindow();
    const { replaceQuery } = await import("@/components/useBallotFilters");
    const onPop = (window as unknown as { addEventListener: ReturnType<typeof vi.fn> }).addEventListener.mock.calls.find(([t]) => t === "popstate")![1] as () => void;
    for (let i = 0; i < 2; i++) onPop();
    for (let i = 0; i < 44; i++) replaceQuery(`c=x${i}`);
    expect(w.replaceState).toHaveBeenCalledTimes(44);
    replaceQuery("c=over");
    expect(w.replaceState).toHaveBeenCalledTimes(44);
  });
});

describe("pushPath", () => {
  function stubHistory() {
    const w = stubWindow();
    const pushState = vi.fn((_d: unknown, _u: string, url: string) => w.replaceState(_d, _u, url));
    (window as unknown as { history: { pushState: typeof pushState } }).history.pushState = pushState;
    return { ...w, pushState };
  }

  it("pushes the path and announces the change", async () => {
    const w = stubHistory();
    const { pushPath, currentSearch } = await import("@/components/useBallotFilters");
    expect(pushPath("/2026-11/sonoma?why=1")).toBe(true);
    expect(w.pushState).toHaveBeenCalledWith(null, "", "/2026-11/sonoma?why=1");
    expect(w.location.pathname).toBe("/2026-11/sonoma");
    expect(currentSearch()).toBe("?why=1");
    expect(w.dispatchEvent).toHaveBeenCalledTimes(1);
  });
  it("replaces instead when asked", async () => {
    const w = stubHistory();
    const { pushPath } = await import("@/components/useBallotFilters");
    expect(pushPath("/2026-11/sf", { replace: true })).toBe(true);
    expect(w.pushState).not.toHaveBeenCalled();
    expect(w.replaceState).toHaveBeenCalledWith(null, "", "/2026-11/sf");
  });
  it("refuses once the history budget is spent, so the caller can navigate normally", async () => {
    const w = stubHistory();
    const { pushPath, replaceQuery } = await import("@/components/useBallotFilters");
    for (let i = 0; i < 45; i++) replaceQuery(`c=x${i}`);
    expect(pushPath("/2026-11/sonoma")).toBe(false);
    expect(w.pushState).not.toHaveBeenCalled();
  });
  it("refuses when the browser throws", async () => {
    const w = stubHistory();
    w.pushState.mockImplementation(() => {
      throw new DOMException("too many calls", "SecurityError");
    });
    const { pushPath } = await import("@/components/useBallotFilters");
    expect(pushPath("/2026-11/sonoma")).toBe(false);
  });
});
