import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { PageColumn } from "@/components/PageColumn";
import { ROW_FOCUS, ROW_LINK } from "@/components/row";
import { SectionHeading } from "@/components/SectionHeading";
import { Badge } from "@/components/ui/badge";
import { formatDate, guidePicks, monthYear, sourceLink } from "@/lib/display";
import { isPublished } from "@/lib/filters";
import { cn } from "@/lib/utils";
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
  return d ? { title: `${d.guide.name} · Bay Ballot`, alternates: { canonical: `/guides/${d.guide.id}` } } : {};
}

export default async function GuidePage({ params }: PageProps<"/guides/[guide]">) {
  const d = await load(params);
  if (!d) notFound();
  const { guide, file, ballot, id } = d;
  return (
    <PageColumn>
      <header>
        <h1 className="text-xl font-semibold">{guide.name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-foreground/20 capitalize">
            {guide.type}
          </Badge>
          {isPublished(file) && !file.hasReasoning ? <Badge variant="outline" className="border-foreground/20">List only</Badge> : null}
        </div>
        {guide.description ? <p className="measure mt-2 text-base">{guide.description}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">
          <ExternalLink href={guide.homepage} className="inline-block py-2.5 -my-2.5 text-foreground underline underline-offset-2">
            Homepage
          </ExternalLink>
          {file?.source ? (
            <>
              {" · "}
              <ExternalLink href={sourceLink(file, file.source)} className="inline-block py-2.5 -my-2.5 text-foreground underline underline-offset-2">
                Source
              </ExternalLink>
            </>
          ) : null}
          {isPublished(file) ? <span> · as of {formatDate(file.fetchedAt)}</span> : null}
        </p>
      </header>

      {isPublished(file) ? (
        <section>
          <SectionHeading>{ballot.title} endorsements</SectionHeading>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {guidePicks(ballot.contests, file).map((p) => (
              <li key={p.contest.id} className={cn("relative flex min-h-12 items-baseline justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/60", ROW_FOCUS)}>
                <Link href={`/${id}/${p.contest.id}`} className={cn("min-w-0 font-medium", ROW_LINK)}>
                  {p.contest.title}
                </Link>
                <span className="max-w-1/2 text-right text-sm">
                  {p.label} <span aria-hidden="true" className="text-muted-foreground">›</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-8 text-muted-foreground">Hasn&apos;t published {monthYear(ballot.date)} endorsements yet</p>
      )}
    </PageColumn>
  );
}
