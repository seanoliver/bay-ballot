import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CardLink } from "@/components/ExternalLink";
import { CARD } from "@/components/frame";
import { PageColumn } from "@/components/PageColumn";
import { ROW_FOCUS, ROW_LINK } from "@/components/row";
import { SectionHeading } from "@/components/SectionHeading";
import { BAR_FILL } from "@/components/tone";
import { candidateSlots } from "@/lib/bar";
import { formatDate, keepNumber, monthYear, sourceLink } from "@/lib/display";
import { activeEntries, EMPTY, isPublished, TYPE_LABEL } from "@/lib/filters";
import { guideBallot, guidePickGroups, guideStats } from "@/lib/guide-page";
import { pinParts } from "@/lib/pins";
import { ballotViewProps, election, latestElection } from "@/lib/site-data";
import { cn } from "@/lib/utils";

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
  return guide ? { d, guide, file: d.endorsements[gid] } : null;
}

export async function generateMetadata({ params }: PageProps<"/guides/[guide]">): Promise<Metadata> {
  const x = await load(params);
  return x ? { title: `${x.guide.name} · Bay Ballot`, alternates: { canonical: `/guides/${x.guide.id}` } } : {};
}

export default async function GuidePage({ params }: PageProps<"/guides/[guide]">) {
  const x = await load(params);
  if (!x) notFound();
  const { d, guide, file } = x;
  const { id, ballot, areas } = d;
  const back = guideBallot(guide, areas, id);
  const published = isPublished(file) ? file : null;
  const groups = published ? guidePickGroups(ballot.contests, published, areas) : [];
  const stats = published ? guideStats(groups.flatMap((g) => g.sections.flatMap((s) => s.picks)), published) : null;
  const { guides, files } = ballotViewProps(election(id)!);
  return (
    <PageColumn>
      <BackLink href={back.href} label={back.label} />
      <header className={CARD}>
        <p className="text-sm text-muted-foreground">{TYPE_LABEL[guide.type]}</p>
        <h1 className="mt-1 text-2xl font-semibold">{guide.name}</h1>
        {guide.description ? <p className="measure mt-1 text-sm text-muted-foreground">{guide.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-x-5">
          <CardLink href={guide.homepage} label="Homepage" />
          {file?.source ? <CardLink href={sourceLink(file, file.source)} label="Endorsements page" /> : null}
        </div>
        {published && stats ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <Stat n={stats.picks} word={stats.picks === 1 ? "pick" : "picks"} />
            {" · "}
            {stats.withReasons === null ? <span className="font-semibold text-foreground">List only</span> : <Stat n={stats.withReasons} word="with reasons" />}
            {` · as of ${formatDate(published.fetchedAt)}`}
          </p>
        ) : null}
      </header>

      {published ? (
        groups.map((g) => (
          <section key={g.key} aria-label={g.heading}>
            <SectionHeading>{g.heading}</SectionHeading>
            {g.sections.map((s) => (
              <section key={s.name} aria-label={`${g.heading}: ${s.name}`}>
                <SectionHeading as="h3">{s.name}</SectionHeading>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {s.picks.map((p) => {
                    const slots = candidateSlots(p.contest, activeEntries(p.contest.id, guides, files, EMPTY).map((r) => r.entry));
                    return (
                      <li key={p.contest.id} className={cn("relative flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-[background-color] hover:bg-muted/60", ROW_FOCUS)}>
                        <Link href={`/${id}/${p.contest.id}`} aria-label={`${p.contest.title}: ${p.label}`} className={cn("min-w-0 font-medium", ROW_LINK)}>
                          {keepNumber(p.contest.title)}
                        </Link>
                        <span aria-hidden="true" className="ml-auto flex flex-wrap justify-end gap-x-3 gap-y-1 text-sm">
                          {pinParts(p.entry, slots).map((part) => (
                            <span key={part.key} className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
                              <span className={cn("size-2.5 shrink-0 rounded-[3px]", BAR_FILL[part.tone])} />
                              {part.label}
                            </span>
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </section>
        ))
      ) : (
        <p className="mt-8 text-muted-foreground">Hasn&apos;t published {monthYear(ballot.date)} endorsements yet</p>
      )}
    </PageColumn>
  );
}

function Stat({ n, word }: { n: number; word: string }) {
  return (
    <span>
      <span className="font-semibold text-foreground">{n}</span> {word}
    </span>
  );
}
