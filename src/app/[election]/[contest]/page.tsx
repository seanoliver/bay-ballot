import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContestView } from "@/components/ContestView";
import { BAY_AREA, contestPlace } from "@/lib/areas";
import type { ElectionData } from "@/lib/data";
import { dataAsOf } from "@/lib/display";
import { activeEntries, contestFiles, EMPTY } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { contestDescription, contestTitle } from "@/lib/seo-copy";
import { ballotViewProps, election, elections } from "@/lib/site-data";
import { ListPage, listMetadata } from "../list-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().flatMap((id) => {
    const d = election(id);
    const slugs = [...(d?.areas ?? []).map((a) => a.id), ...(d?.ballot.contests ?? []).map((c) => c.id)];
    return slugs.map((contest) => ({ election: id, contest }));
  });
}

async function load(params: PageProps<"/[election]/[contest]">["params"]) {
  const p = await params;
  const d = election(p.election);
  if (!d) return null;
  const area = d.areas.find((a) => a.id === p.contest);
  if (area) return { kind: "area" as const, d, area, electionId: p.election };
  const contest = d.ballot.contests.find((c) => c.id === p.contest);
  return contest ? { kind: "contest" as const, d, contest, electionId: p.election } : null;
}

function contestView(d: ElectionData, contest: Contest) {
  const { guides, files, pending } = ballotViewProps(d);
  const { area, place } = contestPlace(contest, d.areas);
  return { guides, files, pending, area, place };
}

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const x = await load(params);
  if (!x) return {};
  if (x.kind === "area") return listMetadata(x.d, x.electionId, x.area);
  const { guides, files, place } = contestView(x.d, x.contest);
  const rows = activeEntries(x.contest.id, guides, files, EMPTY);
  return {
    // The search title already names the site's subject; the " · Bay Ballot" suffix would cut it off.
    title: { absolute: contestTitle(x.contest, rows, x.d.ballot.date, place) },
    alternates: { canonical: `/${x.electionId}/${x.contest.id}` },
    description: contestDescription(x.contest, rows, place),
  };
}

export default async function ContestPage({ params }: PageProps<"/[election]/[contest]">) {
  const x = await load(params);
  if (!x) notFound();
  if (x.kind === "area") return <ListPage d={x.d} electionId={x.electionId} area={x.area} />;
  const { d, contest, electionId } = x;
  const { guides, files, pending, area, place } = contestView(d, contest);
  return (
    <ContestView
      election={electionId}
      contest={contest}
      guides={guides}
      files={contestFiles(contest.id, files)}
      pending={pending}
      asOf={dataAsOf(d.endorsements)}
      place={place}
      area={area?.id ?? null}
      back={{ href: area ? `/${electionId}/${area.id}` : `/${electionId}`, label: `${area ? place.name : BAY_AREA.name} ballot` }}
    />
  );
}
