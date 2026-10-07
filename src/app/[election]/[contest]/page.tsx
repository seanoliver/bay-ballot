import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestDetail } from "@/components/ContestDetail";
import { PageColumn } from "@/components/PageColumn";
import { contestArea, placeName } from "@/lib/areas";
import { candidateSlots } from "@/lib/bar";
import type { ElectionData } from "@/lib/data";
import { dataAsOf } from "@/lib/display";
import { activeEntries, EMPTY } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { answerSentence, contestDescription, contestTitle } from "@/lib/seo-copy";
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
  const area = contestArea(contest, d.areas);
  return { rows: activeEntries(contest.id, guides, files, EMPTY), pending, area, place: placeName(area) };
}

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const x = await load(params);
  if (!x) return {};
  if (x.kind === "area") return listMetadata(x.d, x.electionId, x.area);
  const { rows, place } = contestView(x.d, x.contest);
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
  const { rows, pending, area, place } = contestView(d, contest);
  return (
    <PageColumn>
      <p className="text-sm">
        <Link href={area ? `/${electionId}/${area.id}` : `/${electionId}`} className="inline-block py-2.5 -my-2.5 text-muted-foreground underline underline-offset-2">
          {place.name} ballot
        </Link>
      </p>
      <section className="mt-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <ContestDetail
          election={electionId}
          contest={contest}
          rows={rows}
          pending={pending}
          heading="h1"
          slots={candidateSlots(contest, rows.map((r) => r.entry))}
          pageLink={false}
          shortNames={false}
          answer={answerSentence(contest, rows, dataAsOf(d.endorsements), place)}
        />
      </section>
    </PageColumn>
  );
}
