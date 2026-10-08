import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import { relevantChange } from "@/pipeline/pagestore";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");

// Own file so the gate runs cold, as on the first page of a refresh.
describe("relevantChange speed", () => {
  // About 0.5s on a dev machine and 1.7s before the fix; GitHub runners are roughly 3.5x slower.
  it("gates a 200-line new page against the real ballot fast from a cold start", () => {
    const candidate = ballot.contests.flatMap((c) => c.candidates).at(-1)!;
    const prose = Array.from({ length: 199 }, (_, i) => `the club met after work on day ${i} to plan the potluck and the cleanup`);
    // CPU time of this file's worker, so the parallel suite's load doesn't count.
    const t = process.cpuUsage();
    expect(relevantChange("", prose.join("\n"), ballot)).toBe(false);
    expect(relevantChange("", [...prose, `${candidate} spoke to the members`].join("\n"), ballot)).toBe(true);
    const { user, system } = process.cpuUsage(t);
    expect((user + system) / 1000).toBeLessThan(process.env.CI ? 4000 : 1500);
  });
});
