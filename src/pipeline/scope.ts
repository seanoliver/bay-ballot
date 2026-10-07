import { inArea } from "@/lib/areas";
import type { Area, Ballot, Guide } from "@/lib/schema";

export function guideBallot(ballot: Ballot, guide: Pick<Guide, "areas">, areas: Area[]): Ballot {
  const mine = areas.filter((a) => guide.areas.includes(a.id));
  return { ...ballot, contests: ballot.contests.filter((c) => mine.some((a) => inArea(c, a))) };
}

export function unknownAreaError(areas: Pick<Area, "id">[], only: string[]): string | null {
  const unknown = only.find((a) => !areas.some((x) => x.id === a));
  return unknown ? `--only-areas: unknown area '${unknown}' (areas: ${areas.map((a) => a.id).join(", ")})` : null;
}

/** Contests of the `only` areas that none of the guide's other areas already put on its ballot. */
export function newAreaBallot(ballot: Ballot, guide: Pick<Guide, "id" | "areas">, areas: Area[], only: string[]): Ballot {
  const missing = only.find((a) => !guide.areas.includes(a));
  if (missing) throw new Error(`--only-areas: ${guide.id} doesn't list area '${missing}' in its areas (${guide.areas.join(", ")}); add it to data/guides/${guide.id}.yml first`);
  const mine = areas.filter((a) => guide.areas.includes(a.id));
  const fresh = mine.filter((a) => only.includes(a.id));
  const old = mine.filter((a) => !only.includes(a.id));
  if (old.length === 0) throw new Error(`--only-areas: ${guide.id} has no areas besides ${only.join(", ")}; use a normal extract`);
  return { ...ballot, contests: ballot.contests.filter((c) => fresh.some((a) => inArea(c, a)) && !old.some((a) => inArea(c, a))) };
}

/** `prev` with each in-scope item replaced in place by `next`'s or dropped, then `next`'s new items appended. */
export function mergeInScope<T>(prev: T[], next: T[], key: (t: T) => string, inScope: (id: string) => boolean): T[] {
  const byKey = new Map(next.map((t) => [key(t), t]));
  const out = prev.flatMap((t) => (!inScope(key(t)) ? [t] : byKey.has(key(t)) ? [byKey.get(key(t))!] : []));
  const seen = new Set(out.map(key));
  return [...out, ...next.filter((t) => !seen.has(key(t)))];
}
