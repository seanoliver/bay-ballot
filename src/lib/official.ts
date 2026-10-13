import type { Contest } from "./schema";
import { shortTitle } from "./share";

type Level = "state" | "county" | "city";
type Government = { name: string; level: Level; site?: string };

// The governments behind the measure links in the ballot data. A host not listed here still gets a link, named by its host alone.
const GOVERNMENTS: Record<string, Government> = {
  "voterguide.sos.ca.gov": { name: "the California Secretary of State", level: "state" },
  "www.sf.gov": { name: "the City and County of San Francisco", level: "city" },
  "smcacre.gov": { name: "the County of San Mateo", level: "county" },
  "alamedacountyca.gov": { name: "the County of Alameda", level: "county" },
  "www.marincounty.gov": { name: "the County of Marin", level: "county" },
  "vote.santaclaracounty.gov": { name: "the County of Santa Clara", level: "county" },
  "sonomacounty.gov": { name: "the County of Sonoma", level: "county" },
  "www.contracostavote.gov": { name: "the County of Contra Costa", level: "county" },
  "content.solanocounty.gov": { name: "the County of Solano", level: "county", site: "solanocounty.gov" },
  "www.napacounty.gov": { name: "the County of Napa", level: "county" },
};

export type OfficialSource = { href: string; label: string; note: string };

// "Proposition D" and "City of Alameda Measure L" become "Prop D" and "Measure L"; the page around the link already names the place.
function measureName(title: string): string {
  const m = title.match(/\b(Proposition|Measure)\s+(\S+)$/);
  return m ? `${m[1] === "Proposition" ? "Prop" : "Measure"} ${m[2]}` : shortTitle(title);
}

function linkLabel(name: string, level: Level | null, shared: boolean): string {
  if (shared) return `Find ${name} on the ${level ? `${level}'s ` : ""}official measures page`;
  if (level === "state") return `Read ${name} in the official state voter guide`;
  return `Read ${name} on the ${level ? `${level}'s ` : ""}official page`;
}

export function officialSource(contest: Contest): OfficialSource | null {
  if (contest.kind !== "measure" || !contest.link) return null;
  const { hostname } = new URL(contest.link);
  const gov = GOVERNMENTS[hostname];
  const site = gov?.site ?? hostname.replace(/^www\./, "");
  const own = contest.jurisdiction.level;
  const level = gov?.level ?? (own === "state" || own === "county" || own === "city" ? own : null);
  return {
    href: contest.link,
    label: linkLabel(measureName(contest.title), level, contest.linkShared === true),
    note: `From ${gov ? `${gov.name}, ${site}` : site}. Bay Ballot does not write or edit it.`,
  };
}

// A link more than one contest uses is a list page, so its label says to find the measure there rather than read it.
export function markSharedLinks(contests: Contest[]): Contest[] {
  const uses = new Map<string, number>();
  for (const c of contests) if (c.link) uses.set(c.link, (uses.get(c.link) ?? 0) + 1);
  return contests.map((c) => (c.link && (uses.get(c.link) ?? 0) > 1 ? { ...c, linkShared: true } : c));
}
