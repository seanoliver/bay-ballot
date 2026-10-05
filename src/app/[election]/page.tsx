import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContestSummary } from "@/components/ContestSummary";
import { formatDate, guidesPublished, sections } from "@/lib/display";
import { activeEntries, EMPTY, publishedGuides } from "@/lib/filters";
import { election, elections } from "@/lib/site-data";

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
      <h1 className="text-2xl font-bold">{ballot.title}</h1>
      <p className="text-muted-foreground">
        {formatDate(ballot.date)} · {guidesPublished(publishedGuides(guides, endorsements).length)}
      </p>
      {sections(ballot.contests).map((s) => (
        <section key={s.name} className="mt-8">
          <h2 className="border-b border-border pb-1 text-lg font-semibold">{s.name}</h2>
          <ul className="divide-y divide-border">
            {s.contests.map((c) => (
              <li key={c.id}>
                <ContestSummary election={id} contest={c} rows={activeEntries(c.id, guides, endorsements, EMPTY)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
