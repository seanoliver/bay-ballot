import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { TONE_CLASS } from "@/components/tone";
import { contestHeadline, groupByPick, pendingNote, rankedDetails, rankedLabel, reasons, rowPick } from "@/lib/display";
import { activeEntries, EMPTY, pendingGuides } from "@/lib/filters";
import { election, elections, sourceLink } from "@/lib/site-data";

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

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const d = await load(params);
  return d ? { title: `${d.contest.title} · Bay Ballot` } : {};
}

export default async function ContestPage({ params }: PageProps<"/[election]/[contest]">) {
  const d = await load(params);
  if (!d) notFound();
  const { contest, guides, endorsements, ballot, electionId } = d;
  const rows = activeEntries(contest.id, guides, endorsements, EMPTY);
  const { headline } = contestHeadline(contest, rows);
  const ranked = rankedDetails(rows);
  const pending = pendingNote(pendingGuides(guides, endorsements));
  return (
    <>
      <p className="text-sm">
        <Link href={`/${electionId}`} className="text-muted-foreground underline underline-offset-2">
          {ballot.title}
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">{contest.title}</h1>
      {contest.description ? <p className="text-muted-foreground">{contest.description}</p> : null}
      {contest.kind === "measure" && contest.link ? (
        <p className="mt-1 text-sm">
          <ExternalLink href={contest.link}>Official text</ExternalLink>
        </p>
      ) : null}
      <p className="mt-4 text-xl font-semibold">
        <span className={TONE_CLASS[headline.tone]}>{headline.label}</span>
        {headline.ranked ? <span className="ml-1 text-sm font-normal text-muted-foreground">(ranked #1)</span> : null}
        {headline.detail ? <span className="ml-2 text-base font-normal text-muted-foreground">{headline.detail}</span> : null}
      </p>

      {groupByPick(contest, rows).map((g) => (
        <section key={g.key} className="mt-6">
          <h2 className="border-b border-border pb-1 font-semibold">
            {g.label} <span className="font-normal text-muted-foreground">({g.rows.length})</span>
          </h2>
          <ul className="divide-y divide-border">
            {g.rows.map((r) => {
              const quotes = reasons(r);
              const pick = rowPick(contest, r.entry);
              return (
                <li key={r.guide.id} className="py-2">
                  <Link href={`/guides/${r.guide.id}`} className="font-medium underline underline-offset-2">
                    {r.guide.name}
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    {pick.label}
                    {pick.ranked ? <span className="ml-1 text-xs">(ranked #1)</span> : null}
                  </span>
                  {quotes.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {quotes.map((q, i) => (
                        <li key={`${i}-${q.text}`}>
                          <ExternalLink href={sourceLink(r.file, q.source)}>“{q.text}”</ExternalLink>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reasons published</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {ranked.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-semibold">Ranked-choice order</h2>
          <ul className="mt-1 text-sm">
            {ranked.map((r) => (
              <li key={r.guideName}>
                {r.guideName}: {rankedLabel(r.order)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending ? <p className="mt-8 text-sm text-muted-foreground">{pending}.</p> : null}
    </>
  );
}
