"use client";

import Link from "next/link";
import {
  cardDescription,
  groupByPick,
  officialLink,
  rankedLine,
  reasons,
  rowNote,
  sourceLink,
  type PickGroup,
} from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { ExternalLink } from "./ExternalLink";
import { DOT_CLASS } from "./tone";
import { VerdictBar } from "./VerdictBar";

// Inline links keep their line height but get a 40px-tall tap area.
const TAP = "inline-block py-2.5 -my-2.5";

// One contest in full: result bar, who picked what with their quotes and sources, official text.
// `titleId` labels the surrounding region; `heading={false}` when a sheet title already names it.
export function ContestDetail({
  election,
  contest,
  rows,
  pending,
  heading = true,
  titleId,
}: {
  election: string;
  contest: Contest;
  rows: Row[];
  pending: string | null;
  heading?: boolean;
  titleId?: string;
}) {
  const description = cardDescription(contest);
  const official = officialLink(contest);
  return (
    <div>
      {heading ? (
        <>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{contest.section}</p>
          <h2 id={titleId} className="mt-1 text-xl font-semibold">
            {contest.title}
          </h2>
        </>
      ) : null}
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <VerdictBar contest={contest} rows={rows} className="mt-3" />
      <Groups contest={contest} rows={rows} />
      {pending ? <p className="mt-3 text-sm text-muted-foreground">{pending}</p> : null}
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
        {official ? (
          <ExternalLink href={official} className={`${TAP} underline underline-offset-2`}>
            Official text
          </ExternalLink>
        ) : null}
        <Link href={`/${election}/${contest.id}`} className={`${TAP} underline underline-offset-2`}>
          Open contest page
        </Link>
      </p>
    </div>
  );
}

function Groups({ contest, rows }: { contest: Contest; rows: Row[] }) {
  const groups = groupByPick(contest, rows);
  if (groups.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No guide you&apos;re counting took a position.</p>;
  }
  return groups.map((g) => <Group key={g.key} group={g} />);
}

function Group({ group }: { group: PickGroup }) {
  return (
    <section>
      <h4 className="mt-4 mb-1 flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT_CLASS[group.tone]}`} />
        <span>
          {group.label} <span className="font-normal text-muted-foreground">· {group.rows.length}</span>
        </span>
      </h4>
      <ul className="divide-y divide-border">
        {group.rows.map((r) => (
          <GuideRow key={r.guide.id} row={r} />
        ))}
      </ul>
    </section>
  );
}

function GuideRow({ row }: { row: Row }) {
  const quotes = reasons(row);
  const note = rowNote(row);
  const ranked = rankedLine(row.entry);
  return (
    <li className="py-2.5">
      <Link href={`/guides/${row.guide.id}`} className={`${TAP} text-[15px] font-semibold underline-offset-2 hover:underline`}>
        {row.guide.name}
      </Link>
      {ranked ? <p className="text-sm text-muted-foreground">{ranked}</p> : null}
      {quotes.map((q, i) => (
        <blockquote key={`${i}-${q.text}`} className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
          “{q.text}”{" "}
          <ExternalLink href={sourceLink(row.file, q.source)} className={`${TAP} text-xs text-muted-foreground underline underline-offset-2`}>
            Source
          </ExternalLink>
        </blockquote>
      ))}
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </li>
  );
}
