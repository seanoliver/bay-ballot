"use client";

import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cardDescription } from "@/lib/display";
import { countedLabel, type Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { DistrictSelects, FilterControls } from "../FilterPanel";
import { SectionHeading } from "../SectionHeading";
import { VerdictBar } from "../VerdictBar";
import { ContestDetail, LabTitle, useLab, type LabProps } from "./shared";

// Option 3: a toolbar (filters panel, district selects, guide search) over a grid of compact cards.
export function CardGrid({ election, subtitle, ballot, guides, files, pending }: LabProps) {
  const lab = useLab({ ballot, guides, files });
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filterProps = { filters: lab.filters, onChange: lab.setFilters, ballot, guides, files };
  // Typing a guide name opens the panel so the matches are right there.
  const open = panelOpen || query.trim() !== "";

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto max-w-[1440px] px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="outline"
              aria-expanded={open}
              aria-controls="lab3-filters"
              onClick={() => (open ? (setPanelOpen(false), setQuery("")) : setPanelOpen(true))}
              className="h-10 gap-2 rounded-xl px-3.5 text-[15px] font-normal"
            >
              <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
              <span className="font-semibold">Filters</span>
              <span className="hidden text-muted-foreground sm:inline">· {countedLabel(lab.summary)}</span>
              <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
            </Button>
            <label className="relative min-w-0 flex-1 sm:max-w-64">
              <span className="sr-only">Search guides</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a guide" className="h-10 pl-9" />
            </label>
            {/* District selects live in the toolbar on desktop, in the panel on mobile. */}
            <div className="hidden lg:block [&>[role=group]>p]:sr-only [&>[role=group]>p]:m-0">
              <DistrictSelects {...filterProps} />
            </div>
          </div>
          {open ? (
            <div id="lab3-filters" className="mt-1 max-h-[min(70dvh,36rem)] overflow-y-auto overscroll-contain border-t border-border pb-2 lg:max-w-2xl">
              <div className="lg:hidden">
                <FilterControls {...filterProps} query={query} onQueryChange={setQuery} />
              </div>
              <div className="hidden lg:block">
                <FilterControls {...filterProps} query={query} onQueryChange={setQuery} districts={false} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 pb-10">
        <div className="pt-3">
          <LabTitle n={3} name="Card grid" subtitle={subtitle} />
        </div>
        {lab.visible.map((s) => (
          <section key={s.name}>
            <SectionHeading>{s.name}</SectionHeading>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.contests.map((c) => (
                <ContestTile
                  key={c.id}
                  election={election}
                  contest={c}
                  rows={lab.rowsFor(c.id)}
                  pending={pending}
                  open={lab.selected === c.id}
                  onToggle={() => lab.setSelected(lab.selected === c.id ? null : c.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function ContestTile({
  election,
  contest,
  rows,
  pending,
  open,
  onToggle,
}: {
  election: string;
  contest: Contest;
  rows: Row[];
  pending: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const description = cardDescription(contest);
  const detailId = `card-${contest.id}`;
  return (
    <Card
      className={cn(
        "gap-0 py-0 shadow-xs outline-offset-2 has-[button:focus-visible]:outline-3 has-[button:focus-visible]:outline-ring",
        open && "col-span-full ring-2 ring-foreground/70",
      )}
    >
      <div className="relative flex flex-1 flex-col p-4 active:bg-muted/60">
        <h3 className="text-base leading-snug font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={onToggle}
            className="text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {contest.title}
          </button>
        </h3>
        {description ? <p className={cn("text-sm text-muted-foreground", !open && "line-clamp-1")}>{description}</p> : null}
        <VerdictBar contest={contest} rows={rows} />
        <div className="mt-auto -mb-1.5 flex items-center justify-between pt-1 text-sm text-muted-foreground">
          <span>
            {rows.length} {rows.length === 1 ? "guide" : "guides"}
          </span>
          <span aria-hidden="true" className={cn("grid size-8 place-items-center rounded-full border border-border transition-transform", open && "rotate-180 border-foreground text-foreground")}>
            <ChevronDown className="size-4" />
          </span>
        </div>
      </div>
      {open ? (
        <div id={detailId} className="border-t border-border px-4 pb-4">
          <div className="max-w-3xl">
            <ContestDetail election={election} contest={contest} rows={rows} pending={pending} heading={false} bar={false} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
