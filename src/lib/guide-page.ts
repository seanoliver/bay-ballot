import { areaCounty, BAY_AREA, countyPages, placeGroups, placeName } from "./areas";
import type { BallotLink } from "./areas";
import { guidePicks, type GuidePick } from "./display";
import type { Area, Contest, EndorsementFile, Guide } from "./schema";

export type PickSection = { name: string; picks: GuidePick[] };
export type PickGroup = { key: string; heading: string; sections: PickSection[] };

/** A guide's picks under the ballot's own place and section headings, in ballot order. */
export function guidePickGroups(contests: Contest[], file: EndorsementFile, areas: Area[]): PickGroup[] {
  const picks = guidePicks(contests, file);
  const byId = new Map(picks.map((p) => [p.contest.id, p]));
  return placeGroups(picks.map((p) => p.contest), areas).map((g) => ({
    key: g.key,
    heading: g.heading,
    sections: g.sections.map((s) => ({ name: s.name, picks: s.contests.map((c) => byId.get(c.id)!) })),
  }));
}

/** The ballot a guide belongs to: its one area, its county's page when all its areas share one county, else the Bay Area. */
export function guideBallot(guide: Pick<Guide, "areas">, areas: Area[], election: string): BallotLink {
  const mine = areas.filter((a) => guide.areas.includes(a.id));
  const counties = new Set(mine.map(areaCounty));
  const [county] = counties;
  const home = mine.length === 1 ? mine[0] : counties.size === 1 ? countyPages(areas).find((a) => areaCounty(a) === county) : undefined;
  return home ? { href: `/${election}/${home.id}`, label: `${placeName(home).name} ballot` } : { href: `/${election}`, label: `${BAY_AREA.name} ballot` };
}

/** How many picks the guide made and how many give a reason; null reasons means a list-only guide. */
export function guideStats(picks: GuidePick[], file: Pick<EndorsementFile, "hasReasoning">): { picks: number; withReasons: number | null } {
  return { picks: picks.length, withReasons: file.hasReasoning ? picks.filter((p) => p.entry.quotes.length > 0).length : null };
}
