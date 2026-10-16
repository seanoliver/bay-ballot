"use client";

import { ArrowUpRight } from "lucide-react";
import { useSyncExternalStore } from "react";
import { daysLeft, electionDayState, pacificDate, RESULTS_URL, shortDate } from "@/lib/election-day";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";

const CHIP = "inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold lg:px-3 lg:text-[13px] ring-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
const SUB = "font-medium text-muted-foreground";

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const today = () => pacificDate(new Date());

export function ElectionChip({ date }: { date: string }) {
  // Pages are static and may not rebuild daily, so the count comes from the visitor's clock after hydration.
  const now = useSyncExternalStore(subscribe, today, () => null);
  const state = now ? electionDayState(date, now) : null;

  if (state?.kind === "after") {
    return (
      <ExternalLink href={RESULTS_URL} className={cn(CHIP, "ring-foreground/15")}>
        <span className="min-[380px]:hidden">Results</span>
        <span className="hidden min-[380px]:inline">Election results</span>
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </ExternalLink>
    );
  }
  return (
    <a href="#before-you-vote" className={cn(CHIP, state?.kind === "day" ? "ring-foreground" : "ring-foreground/15")}>
      {state?.kind === "day" ? (
        <>
          {/* The full label doesn't fit beside the logo and About on a phone. */}
          <span className="sm:hidden">Polls close 8 pm</span>
          <span className="hidden sm:inline">
            Election day <span className={SUB}>· polls close 8 pm</span>
          </span>
        </>
      ) : (
        <>
          <span className="hidden lg:inline">Election day</span> {shortDate(date)}
          {state ? <span className={SUB}>· {daysLeft(state.days)}</span> : null}
        </>
      )}
    </a>
  );
}
