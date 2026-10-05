"use client";

import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cardDescription, topQuote } from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { SectionHeading } from "../SectionHeading";
import { VerdictBar } from "../VerdictBar";
import { ContestDetail, FilterSidebar, FiltersSheet, LabTitle, useLab, type LabProps } from "./shared";

// Option 2: filters sidebar + a sectioned table on desktop; title-over-bar rows on mobile. Rows expand inline.
export function TableView({ election, subtitle, ballot, guides, files, pending }: LabProps) {
  const lab = useLab({ ballot, guides, files });
  const filterProps = { filters: lab.filters, onChange: lab.setFilters, ballot, guides, files };
  const toggle = (id: string) => lab.setSelected(lab.selected === id ? null : id);

  return (
    <div className="mx-auto max-w-[1440px] px-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
      <FilterSidebar
        {...filterProps}
        className="hidden lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-4 lg:pr-2"
      />
      <div className="min-w-0 pb-10">
        <div className="pt-1 pb-3">
          <LabTitle n={2} name="Table" subtitle={subtitle} />
          <FiltersSheet {...filterProps} className="mt-2 w-full lg:hidden" />
        </div>

        {/* ≥768px: the table. */}
        <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[30%]" />
              <col className="w-24" />
              <col />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Contest</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Guides</TableHead>
                <TableHead className="pr-4">Top quote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lab.visible.map((s) => (
                <Fragment key={s.name}>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={4} className="pl-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      <h2>{s.name}</h2>
                    </TableCell>
                  </TableRow>
                  {s.contests.map((c) => (
                    <DesktopRow
                      key={c.id}
                      election={election}
                      contest={c}
                      rows={lab.rowsFor(c.id)}
                      counted={lab.summary.counted}
                      pending={pending}
                      open={lab.selected === c.id}
                      onToggle={() => toggle(c.id)}
                    />
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* <768px: stacked rows. */}
        <div className="md:hidden">
          {lab.visible.map((s) => (
            <section key={s.name}>
              <SectionHeading>{s.name}</SectionHeading>
              <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                {s.contests.map((c) => (
                  <MobileRow
                    key={c.id}
                    election={election}
                    contest={c}
                    rows={lab.rowsFor(c.id)}
                    pending={pending}
                    open={lab.selected === c.id}
                    onToggle={() => toggle(c.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

type RowProps = { election: string; contest: Contest; rows: Row[]; pending: string | null; open: boolean; onToggle: () => void };

function DesktopRow({ election, contest, rows, counted, pending, open, onToggle }: RowProps & { counted: number }) {
  const quote = topQuote(contest, rows);
  const detailId = `detail-${contest.id}`;
  return (
    <>
      {/* The whole row toggles; the button inside is the keyboard/AT handle (its click bubbles here). */}
      <TableRow onClick={onToggle} className={cn("cursor-pointer align-top", open && "bg-muted/50")}>
        <TableCell className="py-3 pl-4 whitespace-normal">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            className="flex min-h-10 items-start gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDown aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            <span>
              <span className="block text-[15px] leading-snug font-semibold">{contest.title}</span>
              {cardDescription(contest) ? (
                <span className="line-clamp-1 text-sm text-muted-foreground">{cardDescription(contest)}</span>
              ) : null}
            </span>
          </button>
        </TableCell>
        <TableCell className="py-3 whitespace-normal">
          <VerdictBar contest={contest} rows={rows} className="mt-1" />
        </TableCell>
        <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
          <span className="mt-1 inline-block">
            {rows.length} of {counted}
          </span>
        </TableCell>
        <TableCell className="py-3 pr-4 whitespace-normal">
          {quote ? (
            <p className="mt-1 text-sm">
              <span className="line-clamp-2">“{quote.text}”</span>
              <span className="text-xs text-muted-foreground">
                {quote.guideName} · {quote.pick}
              </span>
            </p>
          ) : (
            <span className="mt-1 inline-block text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={4} className="px-4 pb-5 whitespace-normal">
            <div className="max-w-3xl pl-6">
              <ContestDetail election={election} contest={contest} rows={rows} pending={pending} heading={false} bar={false} />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function MobileRow({ election, contest, rows, pending, open, onToggle }: RowProps) {
  const detailId = `m-detail-${contest.id}`;
  return (
    <li className={cn(open && "bg-muted/40")}>
      <div className="relative px-3 py-2.5 has-[button:focus-visible]:outline-3 has-[button:focus-visible]:-outline-offset-3 has-[button:focus-visible]:outline-ring">
        <h3 className="flex items-start gap-2 text-[15px] leading-snug font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={onToggle}
            className="min-h-6 flex-1 text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {contest.title}
          </button>
          <ChevronDown aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </h3>
        <VerdictBar contest={contest} rows={rows} className="mt-1.5" />
      </div>
      {open ? (
        <div id={detailId} className="border-t border-border px-3 pb-4">
          <ContestDetail election={election} contest={contest} rows={rows} pending={pending} heading={false} bar={false} />
        </div>
      ) : null}
    </li>
  );
}
