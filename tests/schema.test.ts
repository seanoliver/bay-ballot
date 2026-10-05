import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { Ballot, EndorsementFile, Guide } from "@/lib/schema";

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
  prop-b: { pick: N, quotes: ["A public bank would cost the city hundreds of millions."] }
  supervisor-d8: { pick: [Gary McCoy, Michael Nguyen], ranked: true }
`));
    expect(e.picks["prop-b"].pick).toBe("N");
    expect(e.picks["supervisor-d8"].ranked).toBe(true);
  });

  it("rejects more than 3 quotes", () => {
    const r = EndorsementFile.safeParse({
      guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05",
      hasReasoning: true, picks: { a: { pick: "Y", quotes: ["1", "2", "3", "4"] } },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["picks", "a", "quotes"]);
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
    expect(EndorsementFile.safeParse({ ...file, picks: { a: { pick: "Y", quotes: [""] } } }).success).toBe(false);
  });
  it("rejects unknown guide type", () => {
    expect(Guide.safeParse({ ...guide, type: "blog" }).success).toBe(false);
  });
});
