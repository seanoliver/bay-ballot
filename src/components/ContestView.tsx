"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PlaceName } from "@/lib/areas";
import { candidateSlots } from "@/lib/bar";
import { COUNTIES_PARAM } from "@/lib/counties";
import { activeEntries, EMPTY, hiddenLabel, positionGuides, revealGuides, type GuideInfo, type PickFile } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { answerSentence } from "@/lib/seo-copy";
import { cn } from "@/lib/utils";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { COLUMN, FRAME, PANE } from "./frame";
import { useBallotFilters, useCarriedQuery } from "./useBallotFilters";
import { useBallotKeys } from "./useBallotKeys";
import { useSingleKeys } from "./useSingleKeys";

type Props = {
  election: string;
  contest: Contest;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
  asOf: string | null;
  place: PlaceName;
  back: { href: string; label: string };
};

export function ContestView({ election, contest, guides, files, pending, asOf, place, back }: Props) {
  // All guides, not just this contest's: filters drop ids they don't know, which would forget the list's other hidden guides.
  const { filters, setFilters } = useBallotFilters({ guides, keep: [COUNTIES_PARAM] });
  const shown = useMemo(() => positionGuides(contest.id, guides, files), [contest.id, guides, files]);
  const rows = useMemo(() => activeEntries(contest.id, guides, files, filters), [contest.id, guides, files, filters]);
  // EMPTY, not `filters`: a filter must never repaint a candidate.
  const slots = useMemo(() => candidateSlots(contest, activeEntries(contest.id, guides, files, EMPTY).map((r) => r.entry)), [contest, guides, files]);
  const hidden = shown.length - rows.length;
  const carry = useCarriedQuery();
  const filterProps = { filters, onChange: setFilters, guides: shown, files };

  const [singleKeys] = useSingleKeys();
  useBallotKeys((action) => {
    if (action !== "search" || !window.matchMedia("(min-width: 1024px)").matches) return false;
    document.querySelector<HTMLInputElement>("aside[aria-label=Filters] input[type=search]")?.focus();
  }, { singleKeys });

  return (
    <div className={cn(FRAME, "lg:grid lg:grid-cols-[17rem_minmax(0,48rem)] lg:gap-x-6")}>
      <FilterSidebar {...filterProps} className={cn(PANE, "js-only lg:pr-2")} />
      <div data-page-column className={COLUMN}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <Link href={`${back.href}${carry}`} className="inline-block py-2.5 -my-2.5 text-muted-foreground underline underline-offset-2">
            {back.label}
          </Link>
          {hidden > 0 ? (
            <p className="text-muted-foreground">
              {hiddenLabel(hidden)}
              {" · "}
              <button
                type="button"
                className="inline-block py-2.5 -my-2.5 underline underline-offset-2 hover:text-foreground"
                onClick={() => setFilters(revealGuides(filters, shown.map((g) => g.id), files))}
              >
                Show all
              </button>
            </p>
          ) : null}
        </div>
        <FiltersSheet {...filterProps} className="js-only mt-3 w-full lg:hidden" />
        <section className="mt-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <ContestDetail
            election={election}
            contest={contest}
            rows={rows}
            pending={pending}
            heading="h1"
            slots={slots}
            pageLink={false}
            shortNames={false}
            answer={rows.length > 0 || hidden === 0 ? answerSentence(contest, rows, asOf, place) : undefined}
          />
        </section>
      </div>
    </div>
  );
}
