"use client";

import { ArrowUpRight } from "lucide-react";
import { areaResults } from "@/lib/results";
import { useElectionDay } from "./ElectionChip";
import { ExternalLink } from "./ExternalLink";

const VOTING = [
  { label: "Register to vote", href: "https://registertovote.ca.gov/", domain: "registertovote.ca.gov" },
  { label: "Check your registration", href: "https://voterstatus.sos.ca.gov/", domain: "voterstatus.sos.ca.gov" },
  { label: "Find where to vote", href: "https://caearlyvoting.sos.ca.gov/", domain: "caearlyvoting.sos.ca.gov" },
];

const RESULTS = areaResults(null).map((r) => ({ label: r.name === "Statewide" ? "California, statewide" : r.name, href: r.url, domain: new URL(r.url).hostname.replace(/^www\./, "") }));

export function VotingLinks({ date }: { date: string }) {
  const after = useElectionDay(date)?.kind === "after";
  const links = after ? RESULTS : VOTING;
  return (
    <>
      <h2 id="before-you-vote-heading" className="mb-1 text-[15px] font-semibold">
        {after ? "Results by county" : "Before you vote"}
      </h2>
      <ul className="divide-y divide-border">
        {links.map((v) => (
          <li key={v.href}>
            <ExternalLink href={v.href} className="flex min-h-10 items-center justify-between gap-3 hover:underline hover:underline-offset-2">
              {v.label}
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <span className="lg:hidden">{v.domain}</span>
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </span>
            </ExternalLink>
          </li>
        ))}
      </ul>
    </>
  );
}
