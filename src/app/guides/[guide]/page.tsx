import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { FRAME, READING } from "@/components/frame";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, guidePicks, monthYear, sourceLink } from "@/lib/display";
import { isPublished } from "@/lib/filters";
import { election, latestElection } from "@/lib/site-data";

export const dynamicParams = false;

function current() {
  const id = latestElection();
  const d = election(id);
  if (!d) throw new Error(`latest election '${id}' failed to load`);
  return { id, ...d };
}

export function generateStaticParams() {
  return current().guides.map((g) => ({ guide: g.id }));
}

async function load(params: PageProps<"/guides/[guide]">["params"]) {
  const { guide: gid } = await params;
  const d = current();
  const guide = d.guides.find((g) => g.id === gid);
  return guide ? { ...d, guide, file: d.endorsements[gid] } : null;
}

export async function generateMetadata({ params }: PageProps<"/guides/[guide]">): Promise<Metadata> {
  const d = await load(params);
  return d ? { title: `${d.guide.name} · Bay Ballot` } : {};
}

export default async function GuidePage({ params }: PageProps<"/guides/[guide]">) {
  const d = await load(params);
  if (!d) notFound();
  const { guide, file, ballot, id } = d;
  return (
    <div className={`${FRAME} ${READING} pt-4 pb-10`}>
      <Card className="gap-0 p-4 shadow-xs">
        <h1 className="text-2xl font-semibold">{guide.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {guide.type}
          </Badge>
          {isPublished(file) && !file.hasReasoning ? <Badge variant="outline">List only</Badge> : null}
        </div>
        {guide.description ? <p className="mt-3">{guide.description}</p> : null}
        <Separator className="my-3" />
        <p className="text-sm">
          <ExternalLink href={guide.homepage} className="inline-block py-2.5 -my-2.5 underline underline-offset-2">
            Homepage
          </ExternalLink>
          {file?.source ? (
            <>
              {" · "}
              <ExternalLink href={sourceLink(file, file.source)} className="inline-block py-2.5 -my-2.5 underline underline-offset-2">
                Source
              </ExternalLink>
            </>
          ) : null}
          {isPublished(file) ? <span className="text-muted-foreground"> · as of {formatDate(file.fetchedAt)}</span> : null}
        </p>
      </Card>

      {isPublished(file) ? (
        <Card className="mt-3 gap-0 px-4 py-2 shadow-xs">
          <h2 className="py-2 font-semibold">{ballot.title} endorsements</h2>
          <ul className="divide-y divide-border">
            {guidePicks(ballot.contests, file).map((p) => (
              <li key={p.contest.id}>
                <Link href={`/${id}/${p.contest.id}`} className="flex min-h-11 items-baseline justify-between gap-4 py-2.5">
                  <span className="underline underline-offset-2">{p.contest.title}</span>
                  <span className="text-right font-medium">
                    {p.label} <span aria-hidden="true" className="text-muted-foreground">›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="mt-6 text-muted-foreground">Hasn&apos;t published {monthYear(ballot.date)} endorsements yet</p>
      )}
    </div>
  );
}
