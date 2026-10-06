import { describe, expect, it } from "vitest";
import { buildReviewModel } from "../src/pipeline/review";
import type { Ballot, EndorsementFile, Guide } from "../src/lib/schema";

const ballot = {
  election: "2026-11",
  title: "Test",
  date: "2026-11-03",
  contests: [
    { id: "prop-b", section: "Local", title: "Prop B", kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: { level: "city", name: "SF" } },
    { id: "sup-8", section: "Local", title: "Supervisor 8", kind: "candidate", candidates: ["A", "B"], seats: 1, rankedChoice: true, jurisdiction: { level: "district", name: "Supervisor", district: "8" } },
  ],
} as unknown as Ballot;

const guide = (id: string): Guide => ({ id, name: id.toUpperCase(), description: "d", type: "advocacy", homepage: "https://example.org/", areas: ["sf"] });
const file = (id: string, over: Partial<EndorsementFile> = {}): EndorsementFile => ({
  guide: id, election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: true, picks: {}, ...over,
});
const q = (text: string) => ({ text, source: "https://example.org/p" });

describe("buildReviewModel", () => {
  it("orders picks by ballot order and labels them", () => {
    const m = buildReviewModel(ballot, [guide("g")], { g: file("g", { picks: { "sup-8": { pick: ["A"], ranked: false, quotes: [] }, "prop-b": { pick: "N", ranked: false, quotes: [] } } }) }, {});
    expect(m.guides[0].picks.map((p) => [p.contestTitle, p.label])).toEqual([["Prop B", "No"], ["Supervisor 8", "A"]]);
  });

  it("numbers only the ranked names of a partially ranked pick", () => {
    const m = buildReviewModel(ballot, [guide("g")], { g: file("g", { picks: { "sup-8": { pick: ["A", "B"], ranked: true, rankedCount: 1, quotes: [] } } }) }, {});
    expect(m.guides[0].picks[0].label).toBe("1. A, B (unranked)");
  });

  it("flags a guide that is new since the last commit", () => {
    const m = buildReviewModel(ballot, [guide("g")], { g: file("g", { picks: { "prop-b": { pick: "Y", ranked: false, quotes: [] } } }) }, {});
    expect(m.guides[0].flags).toContain("new");
  });

  it("marks changed, added and removed picks against the previous file", () => {
    const prev = { g: file("g", { picks: { "prop-b": { pick: "Y", ranked: false, quotes: [] }, "sup-8": { pick: ["A"], ranked: false, quotes: [] } } }) };
    const cur = { g: file("g", { picks: { "prop-b": { pick: "N", ranked: false, quotes: [] } } }) };
    const m = buildReviewModel(ballot, [guide("g")], cur, prev);
    expect(m.guides[0].picks[0]).toMatchObject({ contestId: "prop-b", change: "changed", previous: "Yes" });
    expect(m.guides[0].removed).toEqual([{ contestTitle: "Supervisor 8", label: "A" }]);
    expect(m.guides[0].flags).toContain("picks changed");
  });

  it("does not flag picks changed when only quotes were added", () => {
    const prev = { g: file("g", { picks: { "prop-b": { pick: "Y", ranked: false, quotes: [] } } }) };
    const cur = { g: file("g", { picks: { "prop-b": { pick: "Y", ranked: false, quotes: [q("Because it is good.")] } } }) };
    const m = buildReviewModel(ballot, [guide("g")], cur, prev);
    expect(m.guides[0].flags).not.toContain("picks changed");
    expect(m.guides[0].picks[0]).toMatchObject({ change: "same" });
    expect(m.guides[0].quoteCount).toBe(1);
  });

  it("flags manual guides, ranked picks, reasoning changes and explained-but-no-quotes", () => {
    const prev = { g: file("g", { hasReasoning: false }) };
    const cur = { g: file("g", { manual: true, hasReasoning: true, picks: { "sup-8": { pick: ["A", "B"], ranked: true, quotes: [] } } }) };
    const m = buildReviewModel(ballot, [guide("g")], cur, prev);
    expect(m.guides[0].flags).toEqual(expect.arrayContaining(["manual", "ranked pick", "explains picks changed", "explains picks but no quotes"]));
    expect(m.guides[0].picks[0].label).toBe("1. A, 2. B");
  });

  it("sorts flagged guides first, then by name, and leaves pending guides last", () => {
    const guides = [guide("b"), guide("a"), guide("p")];
    const cur = {
      a: file("a", { picks: { "prop-b": { pick: "Y", ranked: false, quotes: [q("Reason one here.")] } } }),
      b: file("b", { picks: { "prop-b": { pick: "N", ranked: false, quotes: [] } } }),
      p: file("p", { status: "pending" }),
    };
    const prev = { a: cur.a, p: cur.p };
    const m = buildReviewModel(ballot, guides, cur, prev);
    expect(m.guides.map((g) => g.id)).toEqual(["b", "a", "p"]);
    expect(m.totals).toMatchObject({ published: 2, pending: 1, picks: 2, quotes: 1, flagged: 1 });
  });
});
