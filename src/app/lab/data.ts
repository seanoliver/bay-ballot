import { electionSubtitle } from "@/lib/display";
import { ballotViewProps, election, latestElection } from "@/lib/site-data";
import type { LabProps } from "@/components/lab/shared";

// The layout lab always shows the latest election.
export function labProps(): LabProps {
  const id = latestElection();
  const d = election(id);
  if (!d) throw new Error(`no data for ${id}`);
  return { election: id, subtitle: electionSubtitle(d.ballot), ...ballotViewProps(d) };
}
