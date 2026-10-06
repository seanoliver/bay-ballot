import { inArea } from "@/lib/areas";
import type { Area, Ballot, Guide } from "@/lib/schema";

export function guideBallot(ballot: Ballot, guide: Pick<Guide, "areas">, areas: Area[]): Ballot {
  const mine = areas.filter((a) => guide.areas.includes(a.id));
  return { ...ballot, contests: ballot.contests.filter((c) => mine.some((a) => inArea(c, a))) };
}
