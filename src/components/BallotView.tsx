"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cardDescription, sections } from "@/lib/display";
import { activeEntries, EMPTY, type GuideInfo, type PickFile, type Row } from "@/lib/filters";
import { candidateSlots, type Slots } from "@/lib/bar";
import { isPlainClick, pickSelected, toggleSelection } from "@/lib/links";
import type { Ballot, Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { FRAME } from "./frame";
import { SectionHeading } from "./SectionHeading";
import { useBallotFilters, useQueryParam } from "./useBallotFilters";
import { useHistorySheet } from "./useHistorySheet";
import { VerdictBar } from "./VerdictBar";

const DESKTOP = "(min-width: 1024px)";
const PANE = "hidden lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-6";

type Props = {
  election: string;
  intro: { title: string; line: string };
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

// The ballot as a split view. Desktop: filters | contest list | the selected contest. Phone: one-line
// rows; a row opens its details in a bottom sheet, and filters open in another.
// Filters and the selected contest (?c=) live in the URL. The server (and hydration) render with no
// filters and the first contest selected; the client applies URL/stored state right after.
export function BallotView({ election, intro, ballot, guides, files, pending }: Props) {
  const { filters, setFilters } = useBallotFilters({ guides, keep: ["c"] });
  const [requested, setRequested] = useQueryParam("c");
  const [sheetOpen, setSheetOpen] = useHistorySheet();
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const [announce, setAnnounce] = useState("");
  const paneRef = useRef<HTMLDivElement>(null);

  const visible = sections(ballot.contests);
  const all = visible.flatMap((s) => s.contests);
  const selectedId = pickSelected(all.map((c) => c.id), requested);
  const current = selectedId === null ? undefined : all.find((c) => c.id === selectedId);
  const rowsFor = (id: string) => activeEntries(id, guides, files, filters);
  // Candidate colors come from every published guide, so a filter never repaints a candidate.
  const slotsFor = (c: Contest) => candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry));
  const filterProps = { filters, onChange: setFilters, guides, files };

  // A new selection starts the detail pane at its top.
  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // Rows are real links to the contest page; a plain click selects instead (modified clicks open the link).
  // Desktop: clicking the selected row again closes the pane. Phone: a tap always opens the sheet.
  const onRowClick = (e: MouseEvent<HTMLAnchorElement>, c: Contest) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (window.matchMedia(DESKTOP).matches) {
      const next = toggleSelection(selectedId, c.id);
      setRequested(next);
      setAnnounce(next ? `Showing ${c.title}` : "Details closed");
    } else {
      setRequested(c.id);
      setSheetOpen(true);
    }
  };

  // Closing the pane drops ?c and puts focus back on the row that was selected.
  const closePane = () => {
    if (selectedId === null) return;
    const row = document.getElementById(`row-d-${selectedId}`);
    setRequested(null);
    setAnnounce("Details closed");
    row?.focus();
  };

  // Escape closes the pane from the list or the pane, but not while a popover inside them handles it.
  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || selectedId === null || !window.matchMedia(DESKTOP).matches) return;
    const t = e.target as Element;
    if (t.closest("[data-slot=popover-content]") || t.getAttribute("aria-expanded") === "true") return;
    closePane();
  };

  return (
    // Two columns until a contest is selected, then three.
    <div
      className={cn(
        FRAME,
        "lg:grid lg:gap-6",
        current ? "lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]",
      )}
    >
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {/* Filters need JS; without it the page is the full ballot and rows link to contest pages. */}
      <noscript>
        <style>{".js-only{display:none!important}"}</style>
      </noscript>
      <FilterSidebar {...filterProps} className={cn(PANE, "js-only lg:pr-2")} />

      {/* Without the pane the list keeps a reading width instead of stretching bars across the screen. */}
      <div className={cn("min-w-0 pb-10", !current && "lg:max-w-3xl")} onKeyDown={onEscape}>
        <div className="pt-4 pb-1 lg:pt-6">
          <h1 className="text-xl font-semibold">{intro.title}</h1>
          <p className="text-sm text-muted-foreground">{intro.line}</p>
          <FiltersSheet {...filterProps} className="js-only mt-3 w-full lg:hidden" />
          <noscript>
            <p className="mt-2 text-sm text-muted-foreground">Filters need JavaScript.</p>
          </noscript>
          {current ? (
            <a
              href="#detail-title"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("detail-title")?.focus();
              }}
              className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium underline max-lg:hidden focus:not-sr-only focus:mt-2 focus:inline-block focus:outline-3 focus:outline-ring"
            >
              Skip to details
            </a>
          ) : null}
        </div>
        {visible.map((s) => (
          <section key={s.name} aria-label={s.name}>
            <SectionHeading>{s.name}</SectionHeading>
            <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {s.contests.map((c) => (
                <li key={c.id}>
                  <ContestRow
                    href={`/${election}/${c.id}`}
                    contest={c}
                    rows={rowsFor(c.id)}
                    slots={slotsFor(c)}
                    selected={c.id === selectedId}
                    onClick={(e) => onRowClick(e, c)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {current ? (
        <div ref={paneRef} className={PANE} onKeyDown={onEscape}>
          <section aria-labelledby="detail-title" className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <ContestDetail
              election={election}
              contest={current}
              rows={rowsFor(current.id)}
              pending={pending}
              titleId="detail-title"
              slots={slotsFor(current)}
              action={
                <Button variant="ghost" size="icon" aria-label="Close details" onClick={closePane} className="-mt-1.5 -mr-2 size-10 shrink-0">
                  <X aria-hidden="true" className="size-5" />
                </Button>
              }
            />
          </section>
        </div>
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl lg:hidden"
          // Back to the row that opened it (Safari doesn't focus links on tap, so name it).
          initialFocus={sheetTitleRef}
          finalFocus={() => (current ? document.getElementById(`row-m-${current.id}`) : true)}
        >
          {current ? (
            <>
              <SheetHeader className="pr-12 pb-0">
                <p className="text-sm text-muted-foreground">{current.section}</p>
                <SheetTitle ref={sheetTitleRef} tabIndex={-1} className="text-lg outline-none">
                  {current.title}
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto overscroll-contain px-4 pb-6">
                <ContestDetail election={election} contest={current} rows={rowsFor(current.id)} pending={pending} heading={false} slots={slotsFor(current)} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// "District 15" never breaks before its number.
const keepNumber = (title: string) => title.replace(/ (\d+)$/, "\u00a0$1");

// The link's ::after covers the whole row, so a tap anywhere selects; the ranked "*" sits above it.
const ROW_LINK = "outline-none after:absolute after:inset-0 after:content-['']";
const ROW_FOCUS = "has-[a:focus-visible]:outline-3 has-[a:focus-visible]:-outline-offset-3 has-[a:focus-visible]:outline-ring";

function ContestRow({
  href,
  contest,
  rows,
  slots,
  selected,
  onClick,
}: {
  href: string;
  contest: Contest;
  rows: Row[];
  slots: Slots;
  selected: boolean;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const description = cardDescription(contest);
  return (
    <>
      {/* Phone: title left (wraps, never cut; two lines fit the longest titles), mini bar and short result right. */}
      <div className={cn("relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-3 active:bg-muted/60 lg:hidden", ROW_FOCUS)}>
        <h3 className="min-w-0 flex-1 text-base font-medium">
          <a id={`row-m-${contest.id}`} href={href} onClick={onClick} className={ROW_LINK}>
            {keepNumber(contest.title)}
          </a>
        </h3>
        <VerdictBar contest={contest} rows={rows} slots={slots} variant="inline" />
      </div>
      {/* Desktop: title over the full bar; the selected row is marked for sight and for AT. */}
      <div
        className={cn(
          "relative hidden px-4 py-3 transition-colors hover:bg-muted/60 lg:block",
          ROW_FOCUS,
          selected && "bg-muted shadow-[inset_3px_0_0_var(--foreground)]",
        )}
      >
        <h3 className="text-base font-semibold">
          <a id={`row-d-${contest.id}`} href={href} onClick={onClick} aria-current={selected ? "true" : undefined} className={ROW_LINK}>
            {contest.title}
          </a>
        </h3>
        {description ? <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
        <VerdictBar contest={contest} rows={rows} slots={slots} />
      </div>
    </>
  );
}
