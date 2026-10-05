"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cardDescription } from "@/lib/display";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { SectionHeading } from "../SectionHeading";
import { VerdictBar } from "../VerdictBar";
import { ContestDetail, FilterSidebar, FiltersSheet, LabTitle, useLab, type LabProps } from "./shared";

const DESKTOP = "(min-width: 1024px)";

// Option 1: filters | contest list | detail pane on desktop; one-line rows + sheets on mobile.
export function SplitView({ election, subtitle, ballot, guides, files, pending }: LabProps) {
  const lab = useLab({ ballot, guides, files });
  const [sheetOpen, setSheetOpen] = useState(false);
  const all = lab.visible.flatMap((s) => s.contests);
  const current = all.find((c) => c.id === lab.selected) ?? all[0];
  const filterProps = { filters: lab.filters, onChange: lab.setFilters, ballot, guides, files };

  const select = (c: Contest) => {
    lab.setSelected(c.id);
    if (!window.matchMedia(DESKTOP).matches) setSheetOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
      <FilterSidebar
        {...filterProps}
        className="hidden lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-4 lg:pr-2"
      />

      <div className="min-w-0 pb-10">
        <div className="pt-1 pb-3">
          <LabTitle n={1} name="Split view" subtitle={subtitle} />
          <FiltersSheet {...filterProps} className="mt-2 w-full lg:hidden" />
        </div>
        {lab.visible.map((s) => (
          <section key={s.name}>
            <SectionHeading>{s.name}</SectionHeading>
            <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 divide-y divide-border">
              {s.contests.map((c) => (
                <li key={c.id}>
                  <Row contest={c} rows={lab.rowsFor(c.id)} selected={current?.id === c.id} onSelect={() => select(c)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="hidden lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-4">
        {current ? (
          <section aria-label="Selected contest" className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <ContestDetail election={election} contest={current} rows={lab.rowsFor(current.id)} pending={pending} />
          </section>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl lg:hidden">
          {current ? (
            <>
              <SheetHeader className="pr-12 pb-0">
                <SheetTitle className="text-lg">{current.title}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto overscroll-contain px-4 pb-6">
                {cardDescription(current) ? <p className="text-sm text-muted-foreground">{cardDescription(current)}</p> : null}
                <ContestDetail election={election} contest={current} rows={lab.rowsFor(current.id)} pending={pending} heading={false} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({
  contest,
  rows,
  selected,
  onSelect,
}: {
  contest: Contest;
  rows: ReturnType<ReturnType<typeof useLab>["rowsFor"]>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "relative transition-colors hover:bg-muted/60 has-[button:focus-visible]:outline-3 has-[button:focus-visible]:-outline-offset-3 has-[button:focus-visible]:outline-ring",
        selected && "lg:bg-muted lg:shadow-[inset_3px_0_0_var(--foreground)]",
      )}
    >
      {/* Mobile: one line, title left, mini bar right. */}
      <div className="flex min-h-14 items-center gap-3 px-3 py-2 lg:hidden">
        <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-medium">
          <button type="button" onClick={onSelect} className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:content-['']">
            {contest.title}
          </button>
        </h3>
        <VerdictBar contest={contest} rows={rows} variant="inline" />
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {/* Desktop: title over the full bar. */}
      <div className="hidden px-4 py-3 lg:block">
        <h3 className="text-[15px] leading-snug font-semibold">
          <button
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={onSelect}
            className="text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {contest.title}
          </button>
        </h3>
        {cardDescription(contest) ? <p className="truncate text-sm text-muted-foreground">{cardDescription(contest)}</p> : null}
        <VerdictBar contest={contest} rows={rows} />
      </div>
    </div>
  );
}
