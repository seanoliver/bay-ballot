import { contestPlace } from "@/lib/areas";
import { eligible } from "@/lib/fallback";
import { activeEntries, EMPTY } from "@/lib/filters";
import { formatDate } from "@/lib/display";
import { areaCounts, mostPositions, shareCard, shareLabel } from "@/lib/share";
import type { Contest } from "@/lib/schema";
import { ballotViewProps, election, latestElection } from "@/lib/site-data";

export function contestShare(electionId: string, contestId: string) {
  const d = election(electionId);
  const contest = d?.ballot.contests.find((c) => c.id === contestId);
  if (!d || !contest) return null;
  const { guides, files } = ballotViewProps(d);
  return {
    card: shareCard(contest, activeEntries(contest.id, guides, files, EMPTY)),
    right: shareLabel(d.ballot.date, contestPlace(contest, d.areas).place.name),
  };
}

const COUNTY_OFFICES = ["Supervisor", "County Board of Education"];
const isCountywide = ({ jurisdiction: j }: Contest) => j.level === "county" || (j.level === "district" && COUNTY_OFFICES.includes(j.name));

export function areaShare(electionId: string, areaId: string) {
  const d = election(electionId);
  const area = d?.areas.find((a) => a.id === areaId);
  if (!d || !area) return null;
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const rowsFor = (cid: string) => activeEntries(cid, guides, files, EMPTY);
  const taken = ballot.contests.filter((c) => rowsFor(c.id).length > 0);
  const local = taken.filter((c) => !eligible(c));
  const countywide = area.kind === "county" ? local.filter(isCountywide) : [];
  const contest = mostPositions([countywide, local, ballot.contests].find((cs) => cs.length > 0) ?? [], rowsFor);
  if (!contest) return null;
  return {
    card: shareCard(contest, rowsFor(contest.id)),
    right: shareLabel(d.ballot.date, area.name),
    area: { headline: `${area.name} endorsements`, counts: areaCounts(guides.length, ballot.contests.length) },
  };
}

export function exampleShare() {
  const id = latestElection();
  const d = election(id);
  if (!d) return null;
  const { guides, files } = ballotViewProps(d);
  const rowsFor = (cid: string) => activeEntries(cid, guides, files, EMPTY);
  const contest = mostPositions(d.ballot.contests, rowsFor);
  return contest ? { card: shareCard(contest, rowsFor(contest.id)), date: formatDate(d.ballot.date) } : null;
}
