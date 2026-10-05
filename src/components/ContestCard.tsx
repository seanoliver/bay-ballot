"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  cardDescription,
  contestHeadline,
  groupByPick,
  rankedDetails,
  rankedLabel,
  rankedLine,
  reasons,
  rowNote,
  sourceLink,
  type PickGroup,
} from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";
import { DOT_CLASS } from "./tone";
import { Verdict } from "./Verdict";

// Inline links keep their line height but get a 40px-tall tap area.
const TAP = "inline-block py-2.5 -my-2.5";

type Props = { election: string; contest: Contest; rows: Row[]; pending: string | null };

export function ContestCard({ election, contest, rows, pending }: Props) {
  const [open, setOpen] = useState(false);
  const { headline, topPicks } = contestHeadline(contest, rows);
  const description = cardDescription(contest);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<Card className={cn("gap-0 py-0 shadow-xs", open && "ring-2 ring-foreground/70")} />}
    >
      {/* The trigger's ::after covers the whole header, so a tap anywhere toggles; the ranked popover sits above it. */}
      <div className="relative grid grid-cols-[1fr_auto] items-start gap-3 p-4 active:bg-muted/60">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-semibold">
            <CollapsibleTrigger className="text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
              {contest.title}
            </CollapsibleTrigger>
          </h3>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          <Verdict headline={headline} topPicks={topPicks} ranked={<RankedPopover rows={rows} />} />
          {open ? null : <p className="mt-2 text-xs text-muted-foreground">Tap to see each guide</p>}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition-transform",
            open && "rotate-180 border-foreground text-foreground",
          )}
        >
          <ChevronDown className="size-5" />
        </span>
      </div>
      <CollapsibleContent className="border-t border-border px-4 pb-4">
        <Groups contest={contest} rows={rows} />
        {pending ? <p className="mt-3 text-sm text-muted-foreground">{pending}.</p> : null}
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
          {contest.kind === "measure" && contest.link ? (
            <ExternalLink href={contest.link} className={`${TAP} underline underline-offset-2`}>
              Official text
            </ExternalLink>
          ) : null}
          <Link href={`/${election}/${contest.id}`} className={`${TAP} underline underline-offset-2`}>
            Open contest page
          </Link>
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RankedPopover({ rows }: { rows: Row[] }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Includes ranked endorsements — show order"
        className="relative z-10 -mx-2.5 -my-2 grid size-10 place-items-center rounded-full text-lg font-bold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        *
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverTitle>Ranked-choice order</PopoverTitle>
        <ul className="space-y-1.5">
          {rankedDetails(rows).map((r) => (
            <li key={r.guideName}>
              <span className="font-medium">{r.guideName}:</span>{" "}
              <span className="text-muted-foreground">{rankedLabel(r.order)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
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
