import { describe, expect, it } from "vitest";
import { contestHeadline, guidesPublished, formatDate, guidePicks, monthYear, pickLabel, reasons, sections } from "@/lib/display";
import { publishedGuides } from "@/lib/filters";
import type { Contest, EndorsementFile, Entry, Guide } from "@/lib/schema";
import type { Row } from "@/lib/filters";

const c = (id: string, section: string, kind: Contest["kind"] = "measure") =>
  ({ id, section, title: id.toUpperCase(), kind, seats: 1, candidates: [], rankedChoice: false }) as unknown as Contest;
const e = (pick: Entry["pick"], ranked = false, quotes: Entry["quotes"] = []): Entry => ({ pick, ranked, quotes });
const file = (over: Partial<EndorsementFile> = {}): EndorsementFile =>
  ({ guide: "g", election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: true, picks: {}, ...over });
const q = { text: "Because.", source: "https://g.org/a" };

describe("sections", () => {
  it("groups contests by section in first-appearance order, keeping ballot order", () => {
    const out = sections([c("a", "State"), c("b", "Local"), c("d", "State"), c("e", "Local")]);
    expect(out.map((s) => [s.name, s.contests.map((x) => x.id)])).toEqual([
      ["State", ["a", "d"]],
      ["Local", ["b", "e"]],
    ]);
  });
});

describe("pickLabel", () => {
  it("measures read Yes/No", () => {
    expect(pickLabel(e("Y"))).toBe("Yes");
    expect(pickLabel(e("N"))).toBe("No");
  });
  it("candidates join names, numbering ranked picks", () => {
    expect(pickLabel(e(["A", "B"]))).toBe("A, B");
    expect(pickLabel(e(["A", "B"], true))).toBe("1. A, 2. B");
  });
});

describe("reasons", () => {
  const row = (f: EndorsementFile, entry: Entry): Row => ({ guide: { id: "g", name: "G" } as Guide, entry, file: f });
  it("returns quotes when the guide publishes reasoning", () => {
    expect(reasons(row(file(), e("Y", false, [q])))).toEqual([q]);
  });
  it("hides quotes when hasReasoning is false", () => {
    expect(reasons(row(file({ hasReasoning: false }), e("Y", false, [q])))).toEqual([]);
  });
});

describe("dates", () => {
  it("formats ISO dates and datetimes as long dates", () => {
    expect(formatDate("2026-11-03")).toBe("November 3, 2026");
    expect(formatDate("2026-10-05T18:30:00Z")).toBe("October 5, 2026");
  });
  it("monthYear names the election", () => {
    expect(monthYear("2026-11-03")).toBe("November 2026");
  });
});

describe("contestHeadline", () => {
  it("computes headline and runners-up from rows", () => {
    const race = c("sup", "Local", "candidate");
    const rows = [e(["A"]), e(["A"]), e(["B"])].map((entry) => ({ guide: {} as Guide, entry, file: file() }));
    expect(contestHeadline(race, rows)).toEqual({
      headline: { tone: "candidate", label: "A", detail: "67% (2 of 3)", ranked: false },
      runnersUp: "B 1",
    });
  });
});

describe("guidePicks", () => {
  it("lists a guide's picks in ballot order, skipping contests without a pick", () => {
    const ballot = [c("a", "S"), c("b", "S"), c("d", "S")];
    const out = guidePicks(ballot, file({ picks: { d: e("N"), a: e("Y") } }));
    expect(out.map((p) => [p.contest.id, p.label])).toEqual([
      ["a", "Yes"],
      ["d", "No"],
    ]);
  });
});

describe("publishedGuides", () => {
  it("keeps guides with a published file", () => {
    const gs = ["a", "b", "c"].map((id) => ({ id }) as Guide);
    const ends = { a: file({ guide: "a" }), b: file({ guide: "b", status: "pending" }) };
    expect(publishedGuides(gs, ends).map((g) => g.id)).toEqual(["a"]);
  });
});

describe("guidesPublished", () => {
  it("pluralizes", () => {
    expect(guidesPublished(1)).toBe("1 guide published");
    expect(guidesPublished(7)).toBe("7 guides published");
  });
});
