import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { FRAME, READING } from "@/components/frame";
import { DOT_CLASS } from "@/components/tone";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Verdict } from "@/components/Verdict";
import {
  contestHeadline,
  groupByPick,
  officialLink,
  rankedDetails,
  reasons,
  rowNote,
  rowPick,
  sourceLink,
} from "@/lib/display";
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

export async function generateMetadata({ params }: PageProps<"/[election]/[contest]">): Promise<Metadata> {
  const d = await load(params);
  return d ? { title: `${d.contest.title} · Bay Ballot` } : {};
}

export default async function ContestPage({ params }: PageProps<"/[election]/[contest]">) {
  const d = await load(params);
  if (!d) notFound();
  const { contest, ballot, electionId } = d;
  const { guides, files, pending } = ballotViewProps(d);
  const rows = activeEntries(contest.id, guides, files, EMPTY);
  const { headline, topPicks } = contestHeadline(contest, rows);
  const ranked = rankedDetails(rows);
  const official = officialLink(contest);
  return (
    <div className={`${FRAME} ${READING} pt-4 pb-10`}>
      <p className="text-sm">
        <Link href={`/${electionId}`} className="inline-block py-2.5 -my-2.5 text-muted-foreground underline underline-offset-2">
          {ballot.title}
        </Link>
      </p>
      <Card className="mt-3 gap-0 p-4 shadow-xs">
        <h1 className="text-2xl leading-tight font-bold">{contest.title}</h1>
        {contest.description ? <p className="mt-1 text-muted-foreground">{contest.description}</p> : null}
        {official ? (
          <p className="mt-1 text-sm">
            <ExternalLink href={official} className="inline-block py-2.5 -my-2.5 underline underline-offset-2">
              Official text
            </ExternalLink>
          </p>
        ) : null}
        <Verdict headline={headline} topPicks={topPicks} ranked={<span className="text-sm text-muted-foreground">(ranked #1)</span>} />
      </Card>

      {groupByPick(contest, rows).map((g) => (
        <Card key={g.key} className="mt-3 gap-0 px-4 py-2 shadow-xs">
          <h2 className="flex items-center gap-2 py-2 font-semibold">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT_CLASS[g.tone]}`} />
            <span>
              {g.label} <span className="font-normal text-muted-foreground">· {g.rows.length}</span>
            </span>
          </h2>
          <ul className="divide-y divide-border">
            {g.rows.map((r) => {
              const quotes = reasons(r);
              const pick = rowPick(contest, r.entry);
              const note = rowNote(r);
              return (
                <li key={r.guide.id} className="py-2.5">
                  <Link href={`/guides/${r.guide.id}`} className="inline-block py-2.5 -my-2.5 font-semibold underline underline-offset-2">
                    {r.guide.name}
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    {pick.label}
                    {pick.ranked ? <span className="ml-1 text-xs">(ranked #1)</span> : null}
                  </span>
                  {quotes.map((q, i) => (
                    <blockquote key={`${i}-${q.text}`} className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
                      “{q.text}”{" "}
                      <ExternalLink
                        href={sourceLink(r.file, q.source)}
                        className="inline-block py-2.5 -my-2.5 text-xs text-muted-foreground underline underline-offset-2"
                      >
                        Source
                      </ExternalLink>
                    </blockquote>
                  ))}
                  {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {ranked.length > 0 ? (
        <Card className="mt-3 gap-0 p-4 shadow-xs">
          <h2 className="font-semibold">Ranked-choice order</h2>
          <Separator className="my-2" />
          <ul className="space-y-2 text-sm">
            {ranked.map((r) => (
              <li key={r.guideName}>
                <p className="font-medium">{r.guideName}</p>
                <ol className="list-decimal pl-5 text-muted-foreground">
                  {r.order.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pending ? <p className="mt-6 text-sm text-muted-foreground">{pending}</p> : null}
    </div>
  );
}
