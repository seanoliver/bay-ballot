import { describe, expect, it } from "vitest";
import { guideBallot } from "@/pipeline/scope";
import type { Ballot } from "@/lib/schema";
import { mpP, prop1, propB, rep15, SF, SM } from "./fixtures/areas";

const ballot = { election: "2026-11", title: "Bay Area General Election", date: "2026-11-03", contests: [prop1, propB, mpP, rep15] } as Ballot;
const ids = (areas: string[]) => guideBallot(ballot, { areas }, [SF, SM]).contests.map((c) => c.id);

describe("guideBallot", () => {
  it("keeps statewide contests and the contests in the guide's areas", () => {
    expect(ids(["sf"])).toEqual(["prop-1", "prop-b", "us-rep-15"]);
    expect(ids(["san-mateo"])).toEqual(["prop-1", "menlo-park-measure-p", "us-rep-15"]);
    expect(ids(["sf", "san-mateo"])).toEqual(["prop-1", "prop-b", "menlo-park-measure-p", "us-rep-15"]);
  });
});
