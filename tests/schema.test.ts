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
    expect(() => EndorsementFile.parse({
      guide: "x", election: "2026-11", status: "published", fetchedAt: "2026-10-05",
      hasReasoning: true, picks: { a: { pick: "Y", quotes: ["1", "2", "3", "4"] } },
    })).toThrow();
  });
});
