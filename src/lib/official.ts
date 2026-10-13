import type { Contest } from "./schema";
import { shortTitle } from "./share";

type Level = "state" | "county" | "city";
type Government = { name: string; place: string; level: Level };

// The governments behind the measure links in the ballot data, keyed by host without "www.".
// A host not listed here still gets a link, named by its host alone.
const GOVERNMENTS: Record<string, Government> = {
  "voterguide.sos.ca.gov": { name: "the California Secretary of State", place: "California", level: "state" },
  "sf.gov": { name: "the City and County of San Francisco", place: "San Francisco", level: "city" },
  "smcacre.gov": { name: "the County of San Mateo", place: "San Mateo County", level: "county" },
  "alamedacountyca.gov": { name: "the County of Alameda", place: "Alameda County", level: "county" },
  "marincounty.gov": { name: "the County of Marin", place: "Marin County", level: "county" },
  "vote.santaclaracounty.gov": { name: "the County of Santa Clara", place: "Santa Clara County", level: "county" },
  "sonomacounty.gov": { name: "the County of Sonoma", place: "Sonoma County", level: "county" },
  "contracostavote.gov": { name: "the County of Contra Costa", place: "Contra Costa County", level: "county" },
  "content.solanocounty.gov": { name: "the County of Solano", place: "Solano County", level: "county" },
  "napacounty.gov": { name: "the County of Napa", place: "Napa County", level: "county" },
};

// How wide a government reaches, to tell when a host is narrower than the contest it links for.
const REACH: Record<Contest["jurisdiction"]["level"], number> = { state: 4, region: 3, county: 2, city: 1, district: 0 };

export type OfficialSource = { href: string; label: string; note: string };

/** Host without "www.", lowercased. */
export const siteOf = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

/** The link as a key for spotting one page shared by several contests. */
export function linkKey(url: string): string {
  const u = new URL(url);
  return `${siteOf(url)}${u.pathname.replace(/\/+$/, "")}${u.search}`;
}

// "Proposition D" and "City of Alameda Measure L" become "Prop D" and "Measure L"; the page around the link already names the place.
export function measureName(title: string): string {
  const m = title.match(/\b(Proposition|Measure)\s+(\S+)$/);
  return m ? `${m[1] === "Proposition" ? "Prop" : "Measure"} ${m[2]}` : shortTitle(title);
}

// "the county's", or the place by name when the host's government is narrower than the contest (a regional measure on sf.gov).
function whose(gov: Government | undefined, contest: Contest): string | null {
  if (!gov) return null;
  return REACH[contest.jurisdiction.level] > REACH[gov.level] ? `${gov.place}'s` : `the ${gov.level}'s`;
}

function linkLabel(name: string, href: string, owner: string | null, shared: boolean): string {
  if (/\.pdf$/i.test(new URL(href).pathname)) {
    const file = decodeURIComponent(new URL(href).pathname.split("/").pop() ?? "");
    return /impartial[\s_.-]*analysis/i.test(file) ? `Read the impartial analysis of ${name} (PDF)` : `Read the official document on ${name} (PDF)`;
  }
  if (shared) return `Find ${name} on ${owner ?? "the"} official measures page`;
  if (owner === "the state's") return `Read ${name} in the official state voter guide`;
  return owner ? `Read ${name} on ${owner} official page` : `Read ${name} on its official page`;
}

export function officialSource(contest: Contest): OfficialSource | null {
  if (contest.kind !== "measure" || !contest.link) return null;
  const site = siteOf(contest.link);
  const gov = GOVERNMENTS[site];
  return {
    href: contest.link,
    label: linkLabel(measureName(contest.title), contest.link, whose(gov, contest), contest.linkShared === true),
    note: `From ${gov ? `${gov.name}, ${site}` : site}. Bay Ballot does not write or edit it.`,
  };
}

// A link more than one contest uses is a list page, so its label says to find the measure there rather than read it.
export function markSharedLinks(contests: Contest[]): Contest[] {
  const uses = new Map<string, number>();
  for (const c of contests) if (c.link) uses.set(linkKey(c.link), (uses.get(linkKey(c.link)) ?? 0) + 1);
  return contests.map((c) => (c.link && (uses.get(linkKey(c.link)) ?? 0) > 1 ? { ...c, linkShared: true } : c));
}
