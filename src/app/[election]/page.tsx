import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotView } from "@/components/BallotView";
import { ContestSummary } from "@/components/ContestSummary";
import { SectionHeading } from "@/components/SectionHeading";
import { electionSubtitle, sections } from "@/lib/display";
import { activeEntries, EMPTY } from "@/lib/filters";
import { election, elections } from "@/lib/site-data";
import type { ElectionData } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function generateMetadata({ params }: PageProps<"/[election]">): Promise<Metadata> {
  const d = election((await params).election);
  return d ? { title: `${d.ballot.title} · Bay Ballot` } : {};
}

export default async function ElectionPage({ params }: PageProps<"/[election]">) {
  const id = (await params).election;
  const d = election(id);
  if (!d) notFound();
  const { ballot, guides, endorsements } = d;
  return (
    <>
      <div className="bg-background">
        <h1 className="mx-auto max-w-3xl px-4 pt-0.5 pb-3 text-sm text-muted-foreground">{electionSubtitle(ballot)}</h1>
      </div>
      {/* BallotView reads the URL, so it renders on the client; the fallback is the full unfiltered list for no-JS visitors. */}
      <Suspense fallback={<StaticBallot id={id} data={d} />}>
        <BallotView election={id} ballot={ballot} guides={guides} endorsements={endorsements} />
      </Suspense>
    </>
  );
}

function StaticBallot({ id, data: { ballot, guides, endorsements } }: { id: string; data: ElectionData }) {
  return (
    <div className="mx-auto max-w-3xl border-t border-border px-3 pb-10 sm:px-4">
      {sections(ballot.contests).map((s) => (
        <section key={s.name}>
          <SectionHeading>{s.name}</SectionHeading>
          <div className="flex flex-col gap-3">
            {s.contests.map((c) => (
              <ContestSummary key={c.id} election={id} contest={c} rows={activeEntries(c.id, guides, endorsements, EMPTY)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
