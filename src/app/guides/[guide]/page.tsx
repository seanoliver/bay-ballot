import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/ExternalLink";
import { formatDate, guidePicks, monthYear } from "@/lib/display";
import { isPublished } from "@/lib/filters";
import { election, latestElection, sourceLink } from "@/lib/site-data";

export const dynamicParams = false;

// Guide pages describe the guide's picks for the latest election.
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
    <>
      <h1 className="text-2xl font-bold">{guide.name}</h1>
      <p className="text-sm capitalize text-muted">{guide.type}</p>
      {guide.description ? <p className="mt-2">{guide.description}</p> : null}
      <p className="mt-2 text-sm">
        <ExternalLink href={guide.homepage}>Homepage</ExternalLink>
        {file?.source ? (
          <>
            {" · "}
            <ExternalLink href={sourceLink(file, file.source)}>Source</ExternalLink>
          </>
        ) : null}
        {file ? <span className="text-muted"> · as of {formatDate(file.fetchedAt)}</span> : null}
      </p>

      {isPublished(file) ? (
        <section className="mt-6">
          <h2 className="border-b border-line pb-1 font-semibold">{ballot.title} picks</h2>
          <ul className="divide-y divide-line-soft">
            {guidePicks(ballot.contests, file).map((p) => (
              <li key={p.contest.id}>
                <Link href={`/${id}/${p.contest.id}`} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="underline underline-offset-2">{p.contest.title}</span>
                  <span className="text-right font-medium">
                    {p.label} <span aria-hidden="true" className="text-muted">›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-muted">Hasn&apos;t published {monthYear(ballot.date)} picks yet</p>
      )}
    </>
  );
}
