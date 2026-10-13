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

/** An area list's guides that made no pick on a contest; they all cover the area. */
export function areaNoPick(contestId: string, guides: { id: string }[], files: Record<string, PickFile>): NoPickGuide[] {
  return guides.filter((g) => files[g.id] && !files[g.id].picks[contestId]).map((g) => ({ id: g.id, hasReasoning: files[g.id].hasReasoning }));
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

/** Turns off every guide but `keep`, across the whole ballot. */
export function countOnly(f: Filters, keep: string[], all: string[]): Filters {
  return { ...f, off: [...new Set(all.filter((id) => !keep.includes(id)))].sort() };
}

export function isCountingOnly(f: Filters, keep: string[], all: string[]): boolean {
  return keep.every((id) => isGuideOn(f, id)) && all.every((id) => keep.includes(id) || !isGuideOn(f, id));
}

/** What a pin toggle says, from the filters before it. Nothing changes at the limit. */
export function pinMessage(f: Filters, guide: GuideInfo): string {
  const name = displayName(guide, { short: true });
  if (isPinned(f, guide.id)) return `Unpinned ${name} · ${f.pins.length - 1} of ${MAX_PINS} pinned`;
  if (f.pins.length >= MAX_PINS) return `You can pin up to ${MAX_PINS} guides. Unpin one first.`;
  return `Pinned ${name} · ${f.pins.length + 1} of ${MAX_PINS} pinned`;
}
