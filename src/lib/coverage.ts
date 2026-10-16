import { areaCounties, type BallotLink } from "./areas";
import type { ElectionData } from "./data";
import { publishedGuides } from "./filters";

export type Coverage = { areas: number; counties: number; guides: number; contests: number };

export function coverage(d: ElectionData): Coverage {
  return {
    areas: d.areas.length,
    counties: areaCounties(d.areas).length,
    guides: publishedGuides(d.guides, d.endorsements).length,
    contests: d.ballot.contests.length,
  };
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function coverageSentence(c: Coverage): string {
  return `${count(c.areas, "area")} across ${count(c.counties, "county", "counties")}, ${count(c.guides, "guide")} and ${count(c.contests, "contest")}.`;
}

/** Every area's ballot page, in data order. */
export function areaBallotLinks(d: ElectionData): BallotLink[] {
  return d.areas.map((a) => ({ href: `/${d.ballot.election}/${a.id}`, label: a.name }));
}
