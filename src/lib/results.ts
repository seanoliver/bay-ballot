import { areasOf, STATE_DISTRICTS } from "./areas";
import type { Area, Contest } from "./schema";

export type ResultsLink = { name: string; url: string };

export const STATE_RESULTS: ResultsLink = { name: "Statewide", url: "https://electionresults.sos.ca.gov/" };

const COUNTY_RESULTS: Record<string, string> = {
  Alameda: "https://alamedacountyca.gov/rovresults/260",
  "Contra Costa": "https://www.contracostavote.gov/november-3-2026-election-results/",
  Marin: "https://results.enr.clarityelections.com/CA/Marin/127071/",
  Napa: "https://www.napacounty.gov/402/Election-Results",
  "San Francisco": "https://www.sfelections.org/results/20261103w/index.html",
  "San Mateo": "https://smcacre.gov/elections/november-3-2026-election-results",
  "Santa Clara": "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/",
  Solano: "https://www.solanocounty.gov/government/registrar-voters",
  Sonoma: "https://results.enr.clarityelections.com/CA/Sonoma/127275/",
};

type AreaLike = Pick<Area, "jurisdictions">;

const countyOf = (a: AreaLike) => a.jurisdictions.find((j) => j.level === "county")?.name ?? null;

function countyLink(county: string | null): ResultsLink | null {
  const url = county ? COUNTY_RESULTS[county] : undefined;
  return url && county ? { name: county, url } : null;
}

export function areaResults(area: AreaLike | null): ResultsLink[] {
  if (!area) return [STATE_RESULTS, ...Object.entries(COUNTY_RESULTS).map(([name, url]) => ({ name, url }))];
  const county = countyLink(countyOf(area));
  return county ? [county, STATE_RESULTS] : [STATE_RESULTS];
}

export function contestResults(c: Pick<Contest, "jurisdiction">, areas: AreaLike[]): ResultsLink[] {
  const j = c.jurisdiction;
  // A state district's `within` lists only the Bay Area counties it reaches, so one county would show a partial count.
  if (j.level === "state" || (j.level === "district" && STATE_DISTRICTS.includes(j.name))) return [STATE_RESULTS];
  const links = [...new Set(areasOf(c, areas).map(countyOf))].map(countyLink).filter((l): l is ResultsLink => l !== null);
  return links.length ? links.sort((a, b) => a.name.localeCompare(b.name)) : [STATE_RESULTS];
}
