import { describe, expect, it } from "vitest";
import { unpublishedLine } from "@/lib/election-day";
import { areaResults, contestResults, STATE_RESULTS } from "@/lib/results";
import type { Area, Contest } from "@/lib/schema";

const area = (county: string, city?: string) =>
  ({ jurisdictions: [{ level: "state", name: "California" }, { level: "county", name: county }, ...(city ? [{ level: "city", name: city }] : [])] }) as Pick<Area, "jurisdictions">;
const sf = area("San Francisco", "San Francisco");
const oakland = area("Alameda", "Oakland");
const marin = area("Marin");

const contest = (jurisdiction: unknown) => ({ jurisdiction }) as Pick<Contest, "jurisdiction">;

describe("areaResults", () => {
  it("lists statewide and all nine counties on the Bay Area page", () => {
    expect(areaResults(null).map((l) => [l.name, l.url])).toEqual([
      ["Statewide", "https://electionresults.sos.ca.gov/"],
      ["Alameda", "https://alamedacountyca.gov/rovresults/260"],
      ["Contra Costa", "https://www.contracostavote.gov/november-3-2026-election-results/"],
      ["Marin", "https://results.enr.clarityelections.com/CA/Marin/127071/"],
      ["Napa", "https://www.napacounty.gov/402/Election-Results"],
      ["San Francisco", "https://www.sfelections.org/results/20261103w/index.html"],
      ["San Mateo", "https://smcacre.gov/elections/november-3-2026-election-results"],
      ["Santa Clara", "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/"],
      ["Solano", "https://www.solanocounty.gov/government/registrar-voters"],
      ["Sonoma", "https://results.enr.clarityelections.com/CA/Sonoma/127275/"],
    ]);
  });

  it("gives an area in a county with no results page only the statewide page", () => {
    expect(areaResults(area("Fresno"))).toEqual([STATE_RESULTS]);
  });

  it("puts an area's county first, then statewide", () => {
    expect(areaResults(oakland).map((l) => l.name)).toEqual(["Alameda", "Statewide"]);
  });
});

describe("contestResults", () => {
  const areas = [sf, oakland, marin];

  it("sends a state contest to the statewide page", () => {
    expect(contestResults(contest({ level: "state", name: "California" }), [sf])).toEqual([STATE_RESULTS]);
  });

  it("sends a state district inside one Bay Area county to the statewide page, since it counts outside the Bay Area too", () => {
    const j = { level: "district", name: "Congress", district: "1", within: [{ level: "county", name: "Marin" }] };
    expect(contestResults(contest(j), areas)).toEqual([STATE_RESULTS]);
  });

  it("sends a local contest in a county with no results page to the statewide page", () => {
    expect(contestResults(contest({ level: "county", name: "Fresno" }), [area("Fresno")])).toEqual([STATE_RESULTS]);
  });

  it("sends a city contest to its county", () => {
    expect(contestResults(contest({ level: "city", name: "Oakland" }), areas).map((l) => l.name)).toEqual(["Alameda"]);
  });

  it("sends a district inside one county to that county", () => {
    expect(contestResults(contest({ level: "district", name: "Supervisor", district: "4", within: [{ level: "county", name: "San Francisco" }] }), areas).map((l) => l.name)).toEqual(["San Francisco"]);
  });

  it("links a county once when several of its areas hold the contest", () => {
    const alamedaCounty = area("Alameda");
    expect(contestResults(contest({ level: "county", name: "Alameda" }), [alamedaCounty, oakland]).map((l) => l.name)).toEqual(["Alameda"]);
  });

  it("sends a regional measure to each county that counts it", () => {
    const j = { level: "region", name: "Bay Area", within: [{ level: "county", name: "San Francisco" }, { level: "county", name: "Alameda" }] };
    expect(contestResults(contest(j), areas).map((l) => l.name)).toEqual(["Alameda", "San Francisco"]);
  });

  it("sends a local district spanning counties to each county's page", () => {
    const j = { level: "district", name: "Utility District", district: "3", within: [{ level: "county", name: "Marin" }, { level: "county", name: "Alameda" }] };
    expect(contestResults(contest(j), areas).map((l) => l.name)).toEqual(["Alameda", "Marin"]);
  });
});

describe("unpublishedLine", () => {
  it("is past tense from the day after the election", () => {
    expect(unpublishedLine("2026-11-03", "2026-11-04", "November 2026")).toBe("Didn't publish November 2026 endorsements");
  });

  it("is present tense through election day", () => {
    expect(unpublishedLine("2026-11-03", "2026-11-03", "November 2026")).toBe("Hasn't published November 2026 endorsements yet");
  });
});
