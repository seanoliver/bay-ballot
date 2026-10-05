import { describe, expect, it } from "vitest";
import { cardDescription, contestHeadline, electionSubtitle, guidesPublished, rowPick, formatDate, guidePicks, monthYear, pickLabel, reasons, sections } from "@/lib/display";
import { isPublished, publishedGuides } from "@/lib/filters";
import type { Ballot, Contest, EndorsementFile, Entry, Guide } from "@/lib/schema";
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
  const rowsOf = (entries: Entry[]) => entries.map((entry) => ({ guide: {} as Guide, entry, file: file() }));
  it("computes the headline from rows; single-seat has no top picks", () => {
    const race = c("sup", "Local", "candidate");
    expect(contestHeadline(race, rowsOf([e(["A"]), e(["A"]), e(["B"])]))).toEqual({
      headline: { tone: "candidate", label: "A", detail: "67% (2 of 3)", ranked: false },
      topPicks: [],
    });
  });
  it("multi-seat: Most endorsed plus top picks for the seats", () => {
    const board = { ...c("boe", "Local", "candidate"), seats: 2 } as Contest;
    expect(contestHeadline(board, rowsOf([e(["A", "B"]), e(["A", "C"]), e(["B", "A"])]))).toEqual({
      headline: { tone: "candidate", label: "Most endorsed", detail: "", ranked: false },
      topPicks: [
        { name: "A", count: 3, total: 3 },
        { name: "B", count: 2, total: 3 },
      ],
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

describe("isPublished", () => {
  it("is true only for a published file", () => {
    expect(isPublished(file())).toBe(true);
    expect(isPublished(file({ status: "pending" }))).toBe(false);
    expect(isPublished(undefined)).toBe(false);
  });
});

describe("rowPick", () => {
  const race = { ...c("sup", "Local", "candidate"), rankedChoice: true } as Contest;
  const board = { ...c("boe", "Local", "candidate"), seats: 3 } as Contest;
  it("shows only the counted #1 name for a ranked single-seat pick, marked ranked", () => {
    expect(rowPick(race, e(["A", "B"], true))).toEqual({ label: "A", ranked: true });
  });
  it("shows all names for unranked picks", () => {
    expect(rowPick(board, e(["A", "B"]))).toEqual({ label: "A, B", ranked: false });
  });
  it("measures read Yes/No", () => {
    expect(rowPick(c("p", "S"), e("N"))).toEqual({ label: "No", ranked: false });
  });
});

describe("cardDescription", () => {
  it("shows a measure's description", () => {
    expect(cardDescription({ ...c("p", "S"), description: "Housing bond" } as Contest)).toBe("Housing bond");
  });
  it("is null for candidate races and measures without one", () => {
    expect(cardDescription({ ...c("r", "S", "candidate"), description: "x" } as Contest)).toBeNull();
    expect(cardDescription(c("p", "S"))).toBeNull();
  });
});

describe("electionSubtitle", () => {
  const withJ = (level: string, name: string) => ({ jurisdiction: { level, name } }) as Contest;
  it("names the city on the ballot and the election day", () => {
    const b = { title: "San Francisco General Election", date: "2026-11-03", contests: [withJ("state", "California"), withJ("city", "San Francisco")] } as Ballot;
    expect(electionSubtitle(b)).toBe("San Francisco · November 3, 2026");
  });
  it("falls back to the ballot title without a city contest", () => {
    const b = { title: "Special Election", date: "2026-06-02", contests: [withJ("state", "California")] } as Ballot;
    expect(electionSubtitle(b)).toBe("Special Election · June 2, 2026");
  });
});

describe("guidesPublished", () => {
  it("pluralizes", () => {
    expect(guidesPublished(1)).toBe("1 guide published");
    expect(guidesPublished(7)).toBe("7 guides published");
  });
});
