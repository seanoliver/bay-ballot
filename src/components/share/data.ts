import { contestPlace } from "@/lib/areas";
import { activeEntries, EMPTY } from "@/lib/filters";
import { counted, formatDate } from "@/lib/display";
import { featuredContest, mostPositions, shareCard, shareDate, shareLabel } from "@/lib/share";
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

export function areaShare(electionId: string, areaId: string) {
  const d = election(electionId);
  const area = d?.areas.find((a) => a.id === areaId);
  if (!d || !area) return null;
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const rowsFor = (cid: string) => activeEntries(cid, guides, files, EMPTY);
  const contest = featuredContest(ballot.contests, rowsFor, { county: area.kind === "county" });
  if (!contest) return null;
  return {
    card: shareCard(contest, rowsFor(contest.id)),
    right: shareDate(d.ballot.date),
    head: { headline: `${area.name} endorsements`, counts: [counted(guides.length, "guide"), counted(ballot.contests.length, "contest")].join(" · ") },
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
