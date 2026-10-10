import type { Metadata } from "next";
import { AreaBallot } from "@/components/AreaBallot";
import { viewFor } from "@/lib/area-view";
import { placeName } from "@/lib/areas";
import type { ElectionData } from "@/lib/data";
import { activeEntries, EMPTY } from "@/lib/filters";
import type { Area } from "@/lib/schema";
import { areaDescription, areaTitle } from "@/lib/seo-copy";
import { ballotViewProps, electionSnapshot, snapshotUrl } from "@/lib/site-data";

export function listMetadata(d: ElectionData, electionId: string, area: Area | null): Metadata {
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const place = placeName(area);
  return {
    title: { absolute: areaTitle(place, ballot.date) },
    alternates: { canonical: area ? `/${electionId}/${area.id}` : `/${electionId}` },
    description: areaDescription(place, ballot.contests, (id) => activeEntries(id, guides, files, EMPTY), { statewideOnly: area === null }),
  };
}

// The Bay Area page carries every area's data; an area page carries its own and fetches the rest when idle.
export function ListPage({ d, electionId, area }: { d: ElectionData; electionId: string; area: Area | null }) {
  const snapshot = electionSnapshot(d);
  if (!area) return <AreaBallot election={electionId} snapshot={snapshot} />;
  return <AreaBallot election={electionId} initial={viewFor(snapshot, area.id)} snapshotUrl={snapshotUrl(snapshot)} />;
}
