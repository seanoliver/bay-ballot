import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceQuery } from "@/components/useBallotFilters";

afterEach(() => vi.unstubAllGlobals());

const stubWindow = (replaceState: () => void) => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { history: { replaceState }, location: { pathname: "/2026-11" }, dispatchEvent });
  return dispatchEvent;
};

describe("replaceQuery", () => {
  it("reports success and announces the change", () => {
    const dispatch = stubWindow(() => {});
    expect(replaceQuery("c=us-rep-11")).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it("reports failure when replaceState throws, and announces nothing", () => {
    const dispatch = stubWindow(() => {
      throw new DOMException("too many calls", "SecurityError");
    });
    expect(replaceQuery("c=us-rep-11")).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
