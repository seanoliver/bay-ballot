import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { Ballot, Contest, EndorsementFile, Guide } from "@/lib/schema";

describe("schemas", () => {
  it("parses a guide", () => {
    const g = Guide.parse(parse(`
id: growsf
name: GrowSF
description: Moderate SF political group focused on housing and public safety
type: advocacy
homepage: https://growsf.org/
previousElectionLink: https://growsf.org/voter-guide/june-2026/
`));
    expect(g.type).toBe("advocacy");
  });

  it("parses a ballot with defaults", () => {
    const b = Ballot.parse(parse(`
election: 2026-11
title: SF General Election
date: 2026-11-03
contests:
  - id: prop-b
    section: Local measures
    title: Prop B — Public Bank
    kind: measure
    jurisdiction: { level: city, name: San Francisco }
`));
    expect(b.contests[0].seats).toBe(1);
    expect(b.contests[0].candidates).toEqual([]);
    expect(b.contests[0].rankedChoice).toBe(false);
  });

  it("marks ranked-choice contests", () => {
    const b = Ballot.parse(parse(`
election: 2026-11
title: SF General Election
date: 2026-11-03
contests:
  - id: supervisor-8
    section: Local candidates
    title: Board of Supervisors, District 8
    kind: candidate
    rankedChoice: true
    candidates: [A One]
    jurisdiction: { level: district, name: Supervisor, district: "8" }
`));
    expect(b.contests[0].rankedChoice).toBe(true);
  });

  it("keeps bare Y/N as strings (YAML 1.2)", () => {
    const e = EndorsementFile.parse(parse(`
guide: growsf
election: 2026-11
status: published
source: https://growsf.org/voter-guide/
fetchedAt: 2026-10-05
hasReasoning: true
picks:
  prop-b:
    pick: N
    quotes:
      - text: A public bank would cost the city hundreds of millions.
        source: https://growsf.org/voter-guide/prop-b/
  supervisor-d8: { pick: [Gary McCoy, Michael Nguyen], ranked: true }
`));
    expect(e.picks["prop-b"].pick).toBe("N");
    expect(e.picks["prop-b"].quotes).toEqual([
      { text: "A public bank would cost the city hundreds of millions.", source: "https://growsf.org/voter-guide/prop-b/" },
    ]);
    expect(e.picks["supervisor-d8"].ranked).toBe(true);
  });

  it("rejects more than 3 quotes", () => {
    const r = EndorsementFile.safeParse({
      guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05",
      hasReasoning: true,
      picks: { a: { pick: "Y", quotes: ["1", "2", "3", "4"].map((text) => ({ text, source: "https://x.org/" })) } },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["picks", "a", "quotes"]);
  });

  it("requires each quote to carry its source page", () => {
    const base = { guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05", hasReasoning: true };
    const withQuote = (q: unknown) => EndorsementFile.safeParse({ ...base, picks: { a: { pick: "Y", quotes: [q] } } });
    expect(withQuote("A bare string quote is no longer allowed here.").success).toBe(false);
    expect(withQuote({ text: "A quote without a source page." }).success).toBe(false);
    expect(withQuote({ text: "A quote with a non-http source.", source: "ftp://x.org/a" }).success).toBe(false);
    expect(withQuote({ text: "A quote with its page.", source: "https://x.org/a" }).success).toBe(true);
  });
});

const guide = {
  id: "growsf", name: "GrowSF", description: "d", type: "advocacy", homepage: "https://growsf.org/",
};
const file = {
  guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05",
  hasReasoning: true, picks: { a: { pick: "Y" } },
};
const ballot = {
  election: "2026-11", title: "T", date: "2026-11-03",
  contests: [{ id: "a", section: "s", title: "t", kind: "measure", jurisdiction: { level: "city", name: "SF" } }],
};

describe("tightened schemas", () => {
  it("accepts https urls", () => {
    expect(Guide.safeParse({ ...guide, homepage: "https://growsf.org/voter-guide/" }).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "not a url", "data:text/html,x", "mailto:a@b.co", "ftp://growsf.org/"])(
    "rejects url %s", (u) => {
      expect(Guide.safeParse({ ...guide, homepage: u }).success).toBe(false);
      expect(Guide.safeParse({ ...guide, previousElectionLink: u }).success).toBe(false);
      expect(EndorsementFile.safeParse({ ...file, source: u }).success).toBe(false);
      const b = structuredClone(ballot); (b.contests[0] as Record<string, unknown>).link = u;
      expect(Ballot.safeParse(b).success).toBe(false);
    });
  it("rejects missing fetchedAt and bad dates", () => {
    const { fetchedAt: _f, ...rest } = file;
    expect(EndorsementFile.safeParse(rest).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, fetchedAt: "yesterday" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, fetchedAt: "2026-10-05T12:00:00Z" }).success).toBe(true);
    expect(Ballot.safeParse({ ...ballot, date: "Nov 3" }).success).toBe(false);
    const { date: _d, ...noDate } = ballot;
    expect(Ballot.safeParse(noDate).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, election: "2026" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, election: undefined }).success).toBe(false);
  });
  it("rejects non-slug ids", () => {
    expect(Guide.safeParse({ ...guide, id: "GrowSF" }).success).toBe(false);
    expect(Guide.safeParse({ ...guide, id: "a b" }).success).toBe(false);
    expect(Guide.safeParse({ ...guide, id: "a--b" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, guide: "Bad Id" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { "Bad Key": { pick: "Y" } } }).success).toBe(false);
  });
  it("rejects empty strings and bad picks", () => {
    expect(Guide.safeParse({ ...guide, name: "  " }).success).toBe(false);
    expect(Ballot.safeParse({ ...ballot, title: "" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: [] } } }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: "Maybe" } } }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: [" "] } } }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: "Y", quotes: [{ text: " ", source: "https://x.org/" }] } } }).success).toBe(false);
  });
  it("rejects unknown guide type", () => {
    expect(Guide.safeParse({ ...guide, type: "blog" }).success).toBe(false);
  });
  it("uses a party-neutral club type", () => {
    expect(Guide.safeParse({ ...guide, type: "club" }).success).toBe(true);
    expect(Guide.safeParse({ ...guide, type: "dem-club" }).success).toBe(false);
  });
  it("accepts fetchWith and extraSources", () => {
    const r = EndorsementFile.safeParse({
      ...file, fetchWith: "browser", extraSources: ["https://example.org/vote/ballot-measures"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fetchWith).toBe("browser");
      expect(r.data.extraSources).toEqual(["https://example.org/vote/ballot-measures"]);
    }
    expect(EndorsementFile.safeParse({ ...file, fetchWith: "http" }).success).toBe(true);
  });
  it("rejects an unknown fetchWith", () => {
    expect(EndorsementFile.safeParse({ ...file, fetchWith: "curl" }).success).toBe(false);
  });
  it("rejects a non-http extraSource", () => {
    expect(EndorsementFile.safeParse({ ...file, extraSources: ["javascript:alert(1)"] }).success).toBe(false);
  });
});

describe("extraction bookkeeping fields", () => {
  it("accepts manual, archived and allowForeignSources", () => {
    const r = EndorsementFile.safeParse({
      ...file, manual: true, allowForeignSources: true,
      archived: [{ source: "https://growsf.org/", snapshot: "https://web.archive.org/web/20261005000000/https://growsf.org/" }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.manual).toBe(true);
      expect(r.data.allowForeignSources).toBe(true);
      expect(r.data.archived).toEqual([{ source: "https://growsf.org/", snapshot: "https://web.archive.org/web/20261005000000/https://growsf.org/" }]);
    }
  });
  it("leaves them undefined when absent", () => {
    const r = EndorsementFile.parse(file);
    expect(r.manual).toBeUndefined();
    expect(r.archived).toBeUndefined();
    expect(r.allowForeignSources).toBeUndefined();
  });
  it("rejects bad values", () => {
    expect(EndorsementFile.safeParse({ ...file, manual: "yes" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, allowForeignSources: "yes" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, archived: "https://web.archive.org/web/1/x" }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, archived: ["https://web.archive.org/web/1/https://growsf.org/"] }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, archived: [{ source: "https://growsf.org/" }] }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, archived: [{ source: "https://growsf.org/", snapshot: "javascript:alert(1)" }] }).success).toBe(false);
  });
});

describe("contest aliases", () => {
  const base = {
    id: "supervisor-8", section: "Local", title: "D8", kind: "candidate",
    candidates: ["Michael T. Nguyen"], jurisdiction: { level: "district", name: "Supervisor", district: "8" },
  };
  it("accepts aliases keyed by an official candidate", () => {
    const c = Contest.parse({ ...base, aliases: { "Michael T. Nguyen": ["Michael Trung Nguyen"] } });
    expect(c.aliases).toEqual({ "Michael T. Nguyen": ["Michael Trung Nguyen"] });
  });
  it("rejects an alias keyed by a name that is not a candidate", () => {
    expect(() => Contest.parse({ ...base, aliases: { "Mike Nguyen": ["Michael Trung Nguyen"] } })).toThrow();
  });
});


describe("Guide shortName", () => {
  const base = { id: "league", name: "San Francisco League of Pissed Off Voters", description: "d", type: "advocacy", homepage: "https://example.org/" };
  it("accepts an optional short name", () => {
    expect(Guide.parse({ ...base, shortName: "Pissed Off Voters" }).shortName).toBe("Pissed Off Voters");
    expect(Guide.parse(base).shortName).toBeUndefined();
  });
  it("rejects a blank short name", () => {
    expect(Guide.safeParse({ ...base, shortName: "  " }).success).toBe(false);
  });
});

describe("partial ranking", () => {
  it("accepts a positive integer rankedCount", () => {
    const r = EndorsementFile.safeParse({ ...file, picks: { a: { pick: ["X", "Y", "Z"], ranked: true, rankedCount: 1 } } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.picks.a.rankedCount).toBe(1);
  });
  it("rejects zero or fractional rankedCount", () => {
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: ["X", "Y"], ranked: true, rankedCount: 0 } } }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: ["X", "Y"], ranked: true, rankedCount: 1.5 } } }).success).toBe(false);
  });
});

describe("held picks", () => {
  const held = { contestId: "prop-b", pick: "Y", reason: "wrong-pick", evidence: "The page says No on Prop B." };
  it("accepts held picks with a reason and evidence", () => {
    const r = EndorsementFile.safeParse({
      ...file,
      held: [held, { ...held, contestId: "sup-8", pick: ["A One"], reason: "old-election" }, { ...held, contestId: "prop-c", reason: "unverified" }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown reasons, bad ids and empty picks", () => {
    expect(EndorsementFile.safeParse({ ...file, held: [{ ...held, reason: "meh" }] }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, held: [{ ...held, contestId: "Prop B" }] }).success).toBe(false);
    expect(EndorsementFile.safeParse({ ...file, held: [{ ...held, pick: [] }] }).success).toBe(false);
  });
});
