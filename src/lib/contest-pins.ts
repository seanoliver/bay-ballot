import { areasOf, contestPlace } from "./areas";
import { displayName } from "./display";
import { isGuideOn, isPinned, MAX_PINS, type Filters, type GuideInfo, type PickFile } from "./filters";
import type { Area, Contest } from "./schema";

export type NoPickGuide = { id: string; hasReasoning: boolean };

/**
 * Published guides that made no pick on a contest, among those covering its own place: the one area its page belongs to
 * (San Francisco for an SF measure, not every area that overlaps it), else every area it's on, as for a statewide measure.
 */
export function noPickGuides(
  contest: Pick<Contest, "id" | "jurisdiction">,
  guides: { id: string; areas: string[] }[],
  areas: Area[],
  files: Record<string, PickFile>,
): NoPickGuide[] {
  const home = contestPlace(contest, areas).area;
  const covering = new Set((home ? [home] : areasOf(contest, areas)).map((a) => a.id));
  return guides
    .filter((g) => files[g.id] && !files[g.id].picks[contest.id] && g.areas.some((a) => covering.has(a)))
    .map((g) => ({ id: g.id, hasReasoning: files[g.id].hasReasoning }));
}

/**
 * What an area list needs to apply noPickGuides' rule in the browser: each contest's home area where it isn't the list's
 * own (Oakland for Oakland's mayor on the Alameda County list), and the areas of the list's guides.
 */
export type NoPickScope = { homes: Record<string, string>; guideAreas: Record<string, string[]> };

export function noPickScope(area: Pick<Area, "id">, contests: Contest[], areas: Area[], guides: { id: string; areas: string[] }[]): NoPickScope {
  const homes: Record<string, string> = {};
  for (const c of contests) {
    const home = contestPlace(c, areas).area;
    if (home && home.id !== area.id) homes[c.id] = home.id;
  }
  return { homes, guideAreas: Object.fromEntries(guides.map((g) => [g.id, g.areas])) };
}

/** An area list's guides that made no pick on a contest, among those covering its home area (else the list's own). */
export function areaNoPick(contestId: string, area: string, scope: NoPickScope, guides: { id: string }[], files: Record<string, PickFile>): NoPickGuide[] {
  const home = scope.homes[contestId] ?? area;
  return guides
    .filter((g) => files[g.id] && !files[g.id].picks[contestId] && scope.guideAreas[g.id]?.includes(home))
    .map((g) => ({ id: g.id, hasReasoning: files[g.id].hasReasoning }));
}

/** An area list's local guides for a contest: the list's own, plus those tagged for its home area, as on the contest's page. */
export function contestLocal(contestId: string, local: ReadonlySet<string>, scope: NoPickScope): ReadonlySet<string> {
  const home = scope.homes[contestId];
  if (!home) return local;
  return new Set([...local, ...Object.keys(scope.guideAreas).filter((id) => scope.guideAreas[id].includes(home))]);
}

/** The no-pick guides the filters still count, by name. */
export function countedNoPick(f: Filters, noPick: NoPickGuide[], guides: GuideInfo[]): GuideInfo[] {
  const byId = new Map(guides.map((g) => [g.id, g]));
  return noPick
    .filter((g) => isGuideOn(f, g.id) && !(f.whyOnly && !g.hasReasoning))
    .map((g) => byId.get(g.id))
    .filter((g) => g !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** What a pin toggle says, from the filters before it. Nothing changes at the limit. */
export function pinMessage(f: Filters, guide: GuideInfo): string {
  const name = displayName(guide, { short: true });
  if (isPinned(f, guide.id)) return `Unpinned ${name} · ${f.pins.length - 1} of ${MAX_PINS} pinned`;
  if (f.pins.length >= MAX_PINS) return `You can pin up to ${MAX_PINS} guides. Unpin one first.`;
  return `Pinned ${name} · ${f.pins.length + 1} of ${MAX_PINS} pinned`;
}
