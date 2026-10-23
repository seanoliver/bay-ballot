import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CardLink } from "@/components/ExternalLink";
import { CARD } from "@/components/frame";
import { GuideHistory } from "@/components/GuideHistory";
import { GuidePickRow } from "@/components/GuidePickRow";
import { JsonLd } from "@/components/JsonLd";
import { PageColumn } from "@/components/PageColumn";
import { SectionHeading } from "@/components/SectionHeading";
import { candidateSlots } from "@/lib/bar";
import { readChangelog } from "@/lib/changelog";
import { guideHistory } from "@/lib/changelog-digest";
import { formatDate, keepNumber, monthYear, sourceLink } from "@/lib/display";
import { activeEntries, EMPTY, isPublished, TYPE_LABEL } from "@/lib/filters";
import { guideBallot, guidePickGroups, guideStats } from "@/lib/guide-page";
import { pinParts } from "@/lib/pins";
import { ballotViewProps, DATA_ROOT, election, electionIndex, latestElection } from "@/lib/site-data";
import { breadcrumbJsonLd } from "@/lib/structured-data";

export const dynamicParams = false;

function current() {
  const id = latestElection();
  const d = election(id);
  if (!d) throw new Error(`latest election '${id}' failed to load`);
  return { id, d };
}

export function generateStaticParams() {
  return current().d.guides.map((g) => ({ guide: g.id }));
}

async function load(params: PageProps<"/guides/[guide]">["params"]) {
  const { guide: gid } = await params;
  const { id, d } = current();
  const guide = d.guides.find((g) => g.id === gid);
  return guide ? { id, d, guide, file: d.endorsements[gid] } : null;
}

export async function generateMetadata({ params }: PageProps<"/guides/[guide]">): Promise<Metadata> {
  const x = await load(params);
  return x ? { title: `${x.guide.name} · Bay Ballot`, alternates: { canonical: `/guides/${x.guide.id}` } } : {};
}

export default async function GuidePage({ params }: PageProps<"/guides/[guide]">) {
  const x = await load(params);
  if (!x) notFound();
  const { id, d, guide, file } = x;
  const { ballot, areas } = d;
  const back = guideBallot(guide, areas, id, { index: electionIndex(id) });
  const published = isPublished(file) ? file : null;
  const groups = published ? guidePickGroups(ballot.contests, published, areas) : [];
  const stats = published ? guideStats(groups.flatMap((g) => g.sections.flatMap((s) => s.picks)), published) : null;
  const { guides, files } = ballotViewProps(d);
  const history = guideHistory(readChangelog(DATA_ROOT).entries, guide);
  return (
    <PageColumn>
      <JsonLd data={breadcrumbJsonLd([{ name: back.label, path: back.href }, { name: guide.name, path: `/guides/${guide.id}` }])} />
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
            {/* A guide that explains its picks but quoted none drops the count rather than show "0 with reasons". */}
            {stats.withReasons === null ? (
              <>
                {" · "}
                <span className="font-semibold text-foreground">List only</span>
              </>
            ) : stats.withReasons > 0 ? (
              <>
                {" · "}
                <Stat n={stats.withReasons} word="with reasons" />
              </>
            ) : null}
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
                      <GuidePickRow
                        key={p.contest.id}
                        href={`/${id}/${p.contest.id}`}
                        title={keepNumber(p.contest.title)}
                        label={`${p.contest.title}: ${p.label}`}
                        parts={pinParts(p.entry, slots)}
                        quotes={p.entry.quotes.map((q) => ({ text: q.text, href: sourceLink(published, q.source) }))}
                      />
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
      <GuideHistory rows={history} />
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
