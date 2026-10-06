import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historyBudget } from "@/lib/history-budget";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("historyBudget", () => {
  it("writes at once while under budget", () => {
    const b = historyBudget({ max: 3, windowMs: 10_000 });
    const w = vi.fn();
    for (let i = 0; i < 3; i++) b.run(w);
    expect(w).toHaveBeenCalledTimes(3);
  });
  it("over budget, defers and keeps only the latest write, until the window frees", () => {
    const b = historyBudget({ max: 3, windowMs: 10_000 });
    const done: string[] = [];
    for (const v of ["a", "b", "c"]) b.run(() => done.push(v));
    vi.advanceTimersByTime(1000);
    b.run(() => done.push("d"));
    b.run(() => done.push("e"));
    expect(done).toEqual(["a", "b", "c"]);
    vi.advanceTimersByTime(8999);
    expect(done).toEqual(["a", "b", "c"]);
    vi.advanceTimersByTime(1);
    expect(done).toEqual(["a", "b", "c", "e"]);
  });
  it("never exceeds max writes in any window during a long burst, and ends on the last write", () => {
    const b = historyBudget({ max: 35, windowMs: 10_000 });
    const at: number[] = [];
    let last = -1;
    for (let i = 0; i < 400; i++) {
      const v = i;
      b.run(() => {
        at.push(Date.now());
        last = v;
      });
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(20_000);
    for (let i = 0; i < at.length; i++) expect(at.filter((t) => t > at[i] - 10_000 && t <= at[i]).length).toBeLessThanOrEqual(35);
    expect(last).toBe(399);
  });
  it("a deferred write is skipped once a newer one ran directly", () => {
    const b = historyBudget({ max: 1, windowMs: 1000 });
    const done: string[] = [];
    b.run(() => done.push("a"));
    b.run(() => done.push("b"));
    vi.advanceTimersByTime(1000);
    expect(done).toEqual(["a", "b"]);
    vi.advanceTimersByTime(5000);
    expect(done).toEqual(["a", "b"]);
  });
  it("note() counts a write made elsewhere", () => {
    const b = historyBudget({ max: 2, windowMs: 1000 });
    b.note();
    b.note();
    const w = vi.fn();
    b.run(w);
    expect(w).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(w).toHaveBeenCalledTimes(1);
  });
});
