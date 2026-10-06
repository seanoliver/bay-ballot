import { activeEntries, EMPTY } from "@/lib/filters";
import { formatDate } from "@/lib/display";
import { mostPositions, shareCard } from "@/lib/share";
import { ballotViewProps, election, latestElection } from "@/lib/site-data";

export function contestShare(electionId: string, contestId: string) {
  const d = election(electionId);
  const contest = d?.ballot.contests.find((c) => c.id === contestId);
  if (!d || !contest) return null;
  const { guides, files } = ballotViewProps(d);
  return { card: shareCard(contest, activeEntries(contest.id, guides, files, EMPTY)), right: electionLabel(d.ballot.date) };
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

function electionLabel(iso: string) {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} · San Francisco`;
}
