"use client";

import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { ResultsLink } from "@/lib/results";
import { cn } from "@/lib/utils";
import { toVotingLinks, useElectionDay } from "./ElectionChip";
import { ExternalLink } from "./ExternalLink";

const PRIMARY = "bg-primary text-primary-foreground ring-primary hover:bg-primary/90";
const OUTLINE = "ring-foreground/15 hover:bg-muted";
const BUTTON = "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function ElectionOver({ date, links }: { date: string; links: ResultsLink[] }) {
  const day = useElectionDay(date);
  if (day?.kind !== "after") return null;
  const bay = links.length > 2;
  const shown = bay ? links.filter((l) => l.name === "Statewide") : links;
  return (
    <div className="mt-2 mb-2">
      <p className="text-sm font-medium">The election is over. Results:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map((l, i) => (
          <li key={l.url}>
            <ExternalLink href={l.url} className={cn(BUTTON, i === 0 ? PRIMARY : OUTLINE)}>
              {`${l.name} results`}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </ExternalLink>
          </li>
        ))}
        {bay ? (
          <li>
            <a href="#before-you-vote" onClick={toVotingLinks} className={cn(BUTTON, OUTLINE)}>
              Results by county
              <ArrowDown aria-hidden="true" className="size-3.5" />
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function ContestResults({ date, links }: { date: string; links: ResultsLink[] }) {
  const day = useElectionDay(date);
  if (day?.kind !== "after") return null;
  const label = (l: ResultsLink) => (l.name === "Statewide" ? "statewide" : l.name);
  return (
    <p className="mt-4 text-sm">
      <span className="text-muted-foreground">The election is over. See the results: </span>
      {links.map((l, i) => (
        <span key={l.url}>
          {i > 0 ? ", " : null}
          <ExternalLink href={l.url} className="font-semibold underline underline-offset-2 hover:text-foreground">
            {label(l)}
            <ArrowUpRight aria-hidden="true" className="ml-0.5 inline size-3.5 align-[-2px]" />
          </ExternalLink>
        </span>
      ))}
    </p>
  );
}
