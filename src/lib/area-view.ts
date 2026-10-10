import { areaGuides, areaLinks, inArea, placeGroups, placeName, type AreaLink, type PlaceGroup } from "./areas";
import type { ElectionData } from "./data";
import { electionIntro, pendingNote } from "./display";
import { fallbackFor, scopeName, type Fallback } from "./fallback";
import { isPublished, publishedFiles, type FilterGuide, type GuideInfo, type PickFile } from "./filters";
import type { Area, Contest } from "./schema";
import { areaTitle } from "./seo-copy";

// Client-safe: no zod, fs or path. Everything an area's list needs, for every area.
export type SnapshotGuide = GuideInfo & { areas: string[]; published: boolean };
export type ElectionSnapshot = {
  election: string;
  date: string;
  contests: Contest[];
  areas: Area[];
  guides: SnapshotGuide[];
  files: Record<string, PickFile>;
};

export type AreaView = {
  area: string | null;
  title: string;
  links: AreaLink[];
  intro: { title: string; line: string };
  groups: PlaceGroup[];
  guides: GuideInfo[];
  allGuides: FilterGuide[];
  files: Record<string, PickFile>;
  pending: string | null;
  fallback?: Fallback | null;
};

const info = ({ id, name, shortName, type }: GuideInfo): GuideInfo => ({ id, name, ...(shortName ? { shortName } : {}), type });

export function snapshotOf(d: ElectionData): ElectionSnapshot {
  return {
    election: d.ballot.election,
    date: d.ballot.date,
    contests: d.ballot.contests,
    areas: d.areas,
    guides: d.guides.map((g) => ({ ...info(g), areas: g.areas, published: isPublished(d.endorsements[g.id]) })),
    files: publishedFiles(d.endorsements),
  };
}

// Per snapshot, so every area's view shares one allGuides and filters stay memoized across switches.
const derived = new WeakMap<ElectionSnapshot, { bay: GuideInfo[]; allGuides: FilterGuide[]; views: Map<string | null, AreaView> }>();
function base(s: ElectionSnapshot) {
  let b = derived.get(s);
  if (!b) {
    const published = s.guides.filter((g) => g.published);
    b = { bay: published.map(info), allGuides: published.map(({ id, type }): FilterGuide => ({ id, type })), views: new Map() };
    derived.set(s, b);
  }
  return b;
}

export const areaContests = (contests: Contest[], area: Area | null) => (area ? contests.filter((c) => inArea(c, area)) : contests);

function findArea(s: ElectionSnapshot, areaId: string | null): Area | null {
  const area = areaId === null ? null : s.areas.find((a) => a.id === areaId);
  if (area === undefined) throw new Error(`${s.election}: no area '${areaId}'`);
  return area;
}

/** The parts that follow a switch at once: the page title and the area chips. */
export function areaHead(s: ElectionSnapshot, areaId: string | null): Pick<AreaView, "title" | "links"> {
  return { title: areaTitle(placeName(findArea(s, areaId)), s.date), links: areaLinks(s.election, s.areas, areaId) };
}

export function hasContest(s: ElectionSnapshot, areaId: string | null, contestId: string): boolean {
  const area = findArea(s, areaId);
  return s.contests.some((c) => c.id === contestId && (!area || inArea(c, area)));
}

export function areaView(s: ElectionSnapshot, areaId: string | null): AreaView {
  const area = findArea(s, areaId);
  const { bay, allGuides } = base(s);
  const inScope = area ? areaGuides(s.guides, area) : s.guides;
  const published = inScope.filter((g) => g.published);
  const ids = new Set(published.map((g) => g.id));
  const contests = areaContests(s.contests, area);
  const groups = placeGroups(contests, s.areas);
  const guides = published.map(info);
  const files = Object.fromEntries(Object.entries(s.files).filter(([id]) => ids.has(id)));
  const place = placeName(area);
  return {
    area: areaId,
    ...areaHead(s, areaId),
    intro: electionIntro({ date: s.date, contests }, files, { place: place.name }),
    groups,
    guides,
    allGuides,
    files,
    pending: pendingNote(inScope.filter((g) => !g.published)),
    ...(area ? { fallback: fallbackFor({ groups, place: scopeName(area), local: { guides, files }, bay: { guides: bay, files: s.files } }) } : {}),
  };
}

export function viewFor(s: ElectionSnapshot, areaId: string | null): AreaView {
  const { views } = base(s);
  let v = views.get(areaId);
  if (!v) {
    v = areaView(s, areaId);
    views.set(areaId, v);
  }
  return v;
}

/** The area a list page's path shows: null for the Bay Area, undefined when the path is not a list page. */
export function areaFromPath(s: Pick<ElectionSnapshot, "election" | "areas">, pathname: string): string | null | undefined {
  const [election, slug, ...rest] = pathname.split("/").filter(Boolean);
  if (election !== s.election || rest.length) return undefined;
  if (slug === undefined) return null;
  return s.areas.some((a) => a.id === slug) ? slug : undefined;
}
