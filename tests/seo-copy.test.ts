import { describe, expect, it } from "vitest";
import { answerSentence, contestDescription, contestTitle, familyName, officeName } from "@/lib/seo-copy";
import type { Row } from "@/lib/filters";
import type { Contest, Entry } from "@/lib/schema";

const contest = (over: Partial<Contest>) =>
  ({ id: "x", section: "Local", title: "Proposition B", kind: "measure", seats: 1, candidates: [], rankedChoice: false, jurisdiction: { level: "city", name: "San Francisco" }, ...over }) as Contest;
const propB = contest({ id: "prop-b", title: "Proposition B" });
const prop1 = contest({ id: "prop-1", title: "Proposition 1", jurisdiction: { level: "state", name: "California" } });
const rtm = contest({ id: "rtm", title: "Regional Measure RTM", jurisdiction: { level: "county", name: "Bay Area region" } });
const groban = contest({ id: "supreme-court-groban", title: "Supreme Court Associate Justice Joshua Groban", kind: "retention", jurisdiction: { level: "state", name: "California" } });
const usRep = contest({ id: "us-rep-11", title: "United States Representative, District 11", kind: "candidate", candidates: ["Connie Chan", "Scott Wiener"], jurisdiction: { level: "district", name: "Congress", district: "11" } });
const sup8 = contest({ id: "supervisor-8", title: "Board of Supervisors, District 8", kind: "candidate", rankedChoice: true, jurisdiction: { level: "district", name: "Supervisor", district: "8" } });
const governor = contest({ id: "governor", title: "Governor", kind: "candidate", jurisdiction: { level: "state", name: "California" } });
const boe = contest({ id: "board-of-education", title: "Board of Education", kind: "candidate", seats: 3 });

let n = 0;
const row = (pick: Entry["pick"], ranked = false): Row => {
  n += 1;
  return { guide: { id: `g${n}`, name: `Guide ${n}`, type: "club" }, entry: { pick, ranked, quotes: [] }, file: { hasReasoning: true, picks: {} } };
};
const many = (k: number, pick: Entry["pick"], ranked = false) => Array.from({ length: k }, () => row(pick, ranked));
const AS_OF = "October 5, 2026";

describe("officeName", () => {
  it.each([
    [propB, "SF Prop B"],
    [prop1, "CA Prop 1"],
    [rtm, "Regional Transit Measure"],
    [groban, "Justice Joshua Groban"],
    [usRep, "U.S. Rep. District 11"],
    [sup8, "District 8 Supervisor"],
    [governor, "Governor"],
    [boe, "Board of Education"],
    [contest({ title: "State Assembly, District 17", kind: "candidate" }), "Assembly District 17"],
    [contest({ title: "BART Board, District 8", kind: "candidate" }), "BART Board District 8"],
    [contest({ title: "1st District Court of Appeal (11 justices)", kind: "retention", jurisdiction: { level: "state", name: "California" } }), "1st District Court of Appeal"],
  ])("%#", (c, want) => {
    expect(officeName(c)).toBe(want);
  });
});

describe("familyName", () => {
  it.each([
    ["Phil Kim", "Kim"],
    ["Autumn Brown Garibay", "Brown Garibay"],
    ["Michael T. Nguyen", "Nguyen"],
    ["Dionjay (DJ) Brookter", "Brookter"],
    ['Emanuel "Manny" Yekutiel', "Yekutiel"],
    ["J.R. Eppler", "Eppler"],
    ["Martin Luther King Jr.", "Luther King"],
  ])("%s -> %s", (name, want) => {
    expect(familyName(name)).toBe(want);
  });
});

describe("contestTitle", () => {
  it("measures: Yes or No count, split, or no positions", () => {
    expect(contestTitle(propB, [...many(16, "Y"), ...many(12, "N")])).toBe("SF Prop B endorsements (Nov 2026): 16 of 28 guides say Yes");
    expect(contestTitle(prop1, [...many(2, "Y"), ...many(5, "N")])).toBe("CA Prop 1 endorsements (Nov 2026): 5 of 7 guides say No");
    expect(contestTitle(propB, [...many(14, "Y"), ...many(14, "N")])).toBe("SF Prop B endorsements (Nov 2026): guides split 14–14");
    expect(contestTitle(propB, [])).toBe("SF Prop B endorsements (Nov 2026)");
  });
  it("single seat: a strict leader leads; a tie is split; one candidate is endorsed", () => {
    expect(contestTitle(usRep, [...many(15, ["Scott Wiener"]), ...many(12, ["Connie Chan"])])).toBe(
      "U.S. Rep. District 11 endorsements (SF, Nov 2026): Scott Wiener leads 15 of 27",
    );
    expect(contestTitle(usRep, [row(["Scott Wiener"]), row(["Connie Chan"])])).toBe("U.S. Rep. District 11 endorsements (SF, Nov 2026): guides split");
    expect(contestTitle(governor, many(13, ["Xavier Becerra"]))).toBe("Governor endorsements (SF, Nov 2026): 13 guides endorse Xavier Becerra");
    expect(contestTitle(governor, [])).toBe("Governor endorsements (SF, Nov 2026)");
  });
  it("long titles fall back to shorter endings, ending as short as needed", () => {
    const supt = contest({ title: "Superintendent of Public Instruction", kind: "candidate", jurisdiction: { level: "state", name: "California" } });
    expect(contestTitle(supt, many(14, ["Richard Barrera"]))).toBe("Superintendent of Public Instruction endorsements (SF, Nov 2026): Richard Barrera");
    const boeq = contest({ title: "Board of Equalization, District 2", kind: "candidate" });
    expect(contestTitle(boeq, [...many(9, ["Sally J. Lieber"]), ...many(5, ["Other Person"])])).toBe(
      "Board of Equalization District 2 endorsements (SF, Nov 2026): Sally J. Lieber leads",
    );
  });
    it("multi-seat: the top names by family name", () => {
    const rows = [...many(17, ["Phil Kim"]), ...many(12, ["Tim Tung"]), ...many(11, ["Autumn Brown Garibay"]), row(["Other Person"])];
    expect(contestTitle(boe, rows)).toBe("SF Board of Education endorsements (Nov 2026): Kim, Tung, Brown Garibay lead");
  });
});

describe("answerSentence", () => {
  it("measures", () => {
    expect(answerSentence(propB, [...many(16, "Y"), ...many(12, "N")], AS_OF)).toBe(
      "16 of 28 San Francisco voter guides recommend Yes on Prop B, as of October 5, 2026.",
    );
    expect(answerSentence(propB, [...many(14, "Y"), ...many(14, "N")], AS_OF)).toBe(
      "San Francisco voter guides split 14–14 on Prop B, as of October 5, 2026.",
    );
    expect(answerSentence(groban, many(3, "Y"), AS_OF)).toBe("3 of 3 San Francisco voter guides recommend Yes on retaining Justice Joshua Groban, as of October 5, 2026.");
  });
  it("single seat with the runner-up", () => {
    expect(answerSentence(usRep, [...many(15, ["Scott Wiener"]), ...many(12, ["Connie Chan"])], AS_OF)).toBe(
      "15 of 27 San Francisco voter guides endorse Scott Wiener for U.S. Representative, District 11; 12 endorse Connie Chan, as of October 5, 2026.",
    );
  });
  it("ranked-choice races count first choices", () => {
    const rows = [...many(2, ["Gary McCoy", "Michael T. Nguyen"], true), row(["Michael T. Nguyen"])];
    expect(answerSentence(sup8, rows, AS_OF)).toBe(
      "2 of 3 San Francisco voter guides endorse Gary McCoy as first choice for Board of Supervisors, District 8; 1 endorses Michael T. Nguyen, as of October 5, 2026.",
    );
  });
  it("ties and lone candidates", () => {
    expect(answerSentence(usRep, [row(["Scott Wiener"]), row(["Connie Chan"])], AS_OF)).toBe(
      "San Francisco voter guides split between Connie Chan and Scott Wiener for U.S. Representative, District 11, with 1 each, as of October 5, 2026.",
    );
    expect(answerSentence(governor, many(13, ["Xavier Becerra"]), AS_OF)).toBe(
      "13 San Francisco voter guides endorse Xavier Becerra for Governor; none endorse another candidate, as of October 5, 2026.",
    );
  });
  it("multi-seat", () => {
    const rows = [...many(17, ["Phil Kim"]), ...many(12, ["Tim Tung"]), ...many(11, ["Autumn Brown Garibay"])];
    expect(answerSentence(boe, rows, AS_OF)).toBe(
      "Most-endorsed: Phil Kim (17 of 40 guides), Tim Tung (12), Autumn Brown Garibay (11), as of October 5, 2026.",
    );
  });
  it("no positions", () => {
    expect(answerSentence(propB, [], AS_OF)).toBe("No San Francisco voter guide has taken a position yet, as of October 5, 2026.");
  });
});

describe("contestDescription", () => {
  it("is the answer, then where to read more, within 160 characters", () => {
    const d = contestDescription(usRep, [...many(15, ["Scott Wiener"]), ...many(12, ["Connie Chan"])]);
    expect(d).toBe("15 of 27 SF voter guides endorse Scott Wiener for U.S. Representative, District 11; 12 endorse Connie Chan. See every guide's endorsement and reasons.");
    expect(d.length).toBeLessThanOrEqual(160);
  });
  it("drops the runner-up when the full answer is too long", () => {
    const long = contest({ ...usRep, title: "Superintendent of Public Instruction and Other Long Office Name" });
    const d = contestDescription(long, [...many(15, ["Alexandria Long-Hyphenated Name"]), ...many(12, ["Bartholomew Another-Long Name"])]);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).not.toContain("Bartholomew");
  });
});

describe("every contest on the current ballot", () => {
  it("has a description within 160 characters and a title within 85", async () => {
    const { ballotViewProps, election, latestElection } = await import("@/lib/site-data");
    const { activeEntries, EMPTY } = await import("@/lib/filters");
    const d = election(latestElection())!;
    const { guides, files } = ballotViewProps(d);
    for (const c of d.ballot.contests) {
      const rows = activeEntries(c.id, guides, files, EMPTY);
      expect(contestDescription(c, rows).length, c.id).toBeLessThanOrEqual(160);
      expect(contestTitle(c, rows).length, c.id).toBeLessThanOrEqual(85);
    }
  });
});
