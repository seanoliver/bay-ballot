import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestDetail } from "@/components/ContestDetail";
import { FRAME, READING } from "@/components/frame";
import { Card } from "@/components/ui/card";
import { candidateSlots } from "@/lib/bar";
import { dataAsOf } from "@/lib/display";
import { answerSentence, contestDescription, contestTitle } from "@/lib/seo-copy";
import { activeEntries, EMPTY } from "@/lib/filters";
import { ballotViewProps, election, elections } from "@/lib/site-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().flatMap((id) =>
    (election(id)?.ballot.contests ?? []).map((c) => ({ election: id, contest: c.id })),
  );
}

async function load(params: PageProps<"/[election]/[contest]">["params"]) {
  const p = await params;
  const d = election(p.election);
  const contest = d?.ballot.contests.find((c) => c.id === p.contest);
  return d && contest ? { ...d, contest, electionId: p.election } : null;
}

function allRows(d: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const { guides, files } = ballotViewProps(d);
  return activeEntries(d.contest.id, guides, files, EMPTY);
}

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const d = await load(params);
  if (!d) return {};
  const rows = allRows(d);
  return {
    // The search title already names the site's subject; the " · Bay Ballot" suffix would cut it off.
    title: { absolute: contestTitle(d.contest, rows) },
    alternates: { canonical: `/${d.electionId}/${d.contest.id}` },
    description: contestDescription(d.contest, rows),
  };
}

export default async function ContestPage({ params }: PageProps<"/[election]/[contest]">) {
  const d = await load(params);
  if (!d) notFound();
  const { contest, ballot, electionId } = d;
  const { guides, files, pending } = ballotViewProps(d);
  const rows = activeEntries(contest.id, guides, files, EMPTY);
  return (
    <div className={`${FRAME} ${READING} pt-4 pb-10`}>
      <p className="text-sm">
        <Link href={`/${electionId}`} className="inline-block py-2.5 -my-2.5 text-muted-foreground underline underline-offset-2">
          {ballot.title}
        </Link>
      </p>
      <Card className="mt-3 gap-0 p-6 shadow-xs">
        <ContestDetail
          election={electionId}
          contest={contest}
          rows={rows}
          pending={pending}
          heading="h1"
          slots={candidateSlots(contest, rows.map((r) => r.entry))}
          pageLink={false}
          shortNames={false}
          answer={answerSentence(contest, rows, dataAsOf(d.endorsements))}
        />
      </Card>
    </div>
  );
}
