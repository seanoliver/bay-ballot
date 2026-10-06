import type { Metadata } from "next";
import { BallotView } from "@/components/BallotView";
import { areaLinks, placeName } from "@/lib/areas";
import type { ElectionData } from "@/lib/data";
import { electionIntro } from "@/lib/display";
import { activeEntries, EMPTY } from "@/lib/filters";
import type { Area } from "@/lib/schema";
import { areaDescription, areaTitle } from "@/lib/seo-copy";
import { ballotViewProps } from "@/lib/site-data";

export function listMetadata(d: ElectionData, electionId: string, area: Area | null): Metadata {
  const { ballot, guides, files } = ballotViewProps(d, { area });
  const place = placeName(area);
  return {
    title: { absolute: areaTitle(place, ballot.date) },
    alternates: { canonical: area ? `/${electionId}/${area.id}` : `/${electionId}` },
    description: areaDescription(place, ballot.contests, (id) => activeEntries(id, guides, files, EMPTY)),
  };
}

export function ListPage({ d, electionId, area }: { d: ElectionData; electionId: string; area: Area | null }) {
  const { ballot, ...view } = ballotViewProps(d, { area });
  return (
    <BallotView
      election={electionId}
      area={area?.id ?? null}
      links={areaLinks(electionId, d.areas, area?.id ?? null)}
      intro={electionIntro(ballot, view.files, { place: placeName(area).name })}
      {...view}
    />
  );
}
