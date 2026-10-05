"use client";

import { useCallback, useState } from "react";
import { sections, showHint } from "@/lib/display";
import { activeEntries, visibleContest, type GuideInfo, type PickFile } from "@/lib/filters";
import type { Ballot } from "@/lib/schema";
import { ContestCard } from "./ContestCard";
import { FilterPanel } from "./FilterPanel";
import { SectionHeading } from "./SectionHeading";
import { useBallotFilters } from "./useBallotFilters";

type Props = {
  election: string;
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

// Filters live in the URL, falling back to the last filters saved on this device. The server (and
// hydration) render with no filters; the client applies URL/stored filters right after, so the
// prerendered page is the full ballot and nothing above the cards moves.
export function BallotView({ election, ballot, guides, files, pending }: Props) {
  const { filters, setFilters } = useBallotFilters({ ballot, guides });
  const [opened, setOpened] = useState(false);
  const markOpened = useCallback(() => setOpened(true), []);

  const visible = sections(ballot.contests.filter((c) => visibleContest(c, filters)));
  let index = 0;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <FilterPanel filters={filters} onChange={setFilters} ballot={ballot} guides={guides} files={files} />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-3 pb-10 sm:px-4">
        {visible.map((s) => (
          <section key={s.name}>
            <SectionHeading>{s.name}</SectionHeading>
            <div className="flex flex-col gap-3">
              {s.contests.map((c) => (
                <ContestCard
                  key={c.id}
                  election={election}
                  contest={c}
                  rows={activeEntries(c.id, guides, files, filters)}
                  pending={pending}
                  hint={showHint({ index: index++, opened })}
                  onOpen={markOpened}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
