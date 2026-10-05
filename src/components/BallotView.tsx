"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cardDescription, sections } from "@/lib/display";
import { activeEntries, visibleContest, type GuideInfo, type PickFile, type Row } from "@/lib/filters";
import { isPlainClick, pickSelected } from "@/lib/links";
import type { Ballot, Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { FRAME } from "./frame";
import { SectionHeading } from "./SectionHeading";
import { useBallotFilters, useQueryParam } from "./useBallotFilters";
import { VerdictBar } from "./VerdictBar";

const DESKTOP = "(min-width: 1024px)";
const PANE = "hidden lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-4";

type Props = {
  election: string;
  subtitle: string;
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

// The ballot as a split view. Desktop: filters | contest list | the selected contest. Phone: one-line
// rows; a row opens its details in a bottom sheet, and filters open in another.
// Filters and the selected contest (?c=) live in the URL. The server (and hydration) render with no
// filters and the first contest selected; the client applies URL/stored state right after.
export function BallotView({ election, subtitle, ballot, guides, files, pending }: Props) {
  const { filters, setFilters } = useBallotFilters({ ballot, guides, keep: ["c"] });
  const [requested, setRequested] = useQueryParam("c");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const paneRef = useRef<HTMLDivElement>(null);

  const visible = sections(ballot.contests.filter((c) => visibleContest(c, filters)));
  const all = visible.flatMap((s) => s.contests);
  const selectedId = pickSelected(all.map((c) => c.id), requested);
  const current = all.find((c) => c.id === selectedId);
  const rowsFor = (id: string) => activeEntries(id, guides, files, filters);
  const filterProps = { filters, onChange: setFilters, ballot, guides, files };

  // A new selection starts the detail pane at its top.
  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // Rows are real links to the contest page; a plain click selects instead (modified clicks open the link).
  const onRowClick = (e: MouseEvent<HTMLAnchorElement>, c: Contest) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    setRequested(c.id);
    setAnnounce(`Showing ${c.title}`);
    if (!window.matchMedia(DESKTOP).matches) setSheetOpen(true);
  };

  return (
    <div className={cn(FRAME, "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6")}>
      <FilterSidebar {...filterProps} className={cn(PANE, "lg:pr-2")} />

      <div className="min-w-0 pb-10">
        <div className="pt-0.5 pb-1 lg:pt-4">
          <h1 className="text-sm text-muted-foreground">{subtitle}</h1>
          <FiltersSheet {...filterProps} className="mt-3 w-full lg:hidden" />
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
                    selected={c.id === selectedId}
                    onClick={(e) => onRowClick(e, c)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div ref={paneRef} className={PANE}>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        {current ? (
          <section aria-labelledby="detail-title" className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <ContestDetail election={election} contest={current} rows={rowsFor(current.id)} pending={pending} titleId="detail-title" />
          </section>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl lg:hidden"
          // Back to the row that opened it (Safari doesn't focus links on tap, so name it).
          finalFocus={() => (current ? document.getElementById(`row-m-${current.id}`) : true)}
        >
          {current ? (
            <>
              <SheetHeader className="pr-12 pb-0">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{current.section}</p>
                <SheetTitle className="text-lg">{current.title}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto overscroll-contain px-4 pb-6">
                <ContestDetail election={election} contest={current} rows={rowsFor(current.id)} pending={pending} heading={false} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// The link's ::after covers the whole row, so a tap anywhere selects; the ranked "*" sits above it.
const ROW_LINK = "outline-none after:absolute after:inset-0 after:content-['']";
const ROW_FOCUS = "has-[a:focus-visible]:outline-3 has-[a:focus-visible]:-outline-offset-3 has-[a:focus-visible]:outline-ring";

function ContestRow({
  href,
  contest,
  rows,
  selected,
  onClick,
}: {
  href: string;
  contest: Contest;
  rows: Row[];
  selected: boolean;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const description = cardDescription(contest);
  return (
    <>
      {/* Phone: title left (wraps, never cut), mini bar and short result right. */}
      <div className={cn("relative flex min-h-14 items-center gap-3 py-2 pr-2 pl-3 active:bg-muted/60 lg:hidden", ROW_FOCUS)}>
        <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-medium">
          <a id={`row-m-${contest.id}`} href={href} onClick={onClick} className={ROW_LINK}>
            {contest.title}
          </a>
        </h3>
        <VerdictBar contest={contest} rows={rows} variant="inline" />
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {/* Desktop: title over the full bar; the selected row is marked for sight and for AT. */}
      <div
        className={cn(
          "relative hidden px-4 py-3 transition-colors hover:bg-muted/60 lg:block",
          ROW_FOCUS,
          selected && "bg-muted shadow-[inset_3px_0_0_var(--foreground)]",
        )}
      >
        <h3 className="text-[15px] leading-snug font-semibold">
          <a href={href} onClick={onClick} aria-current={selected ? "true" : undefined} className={ROW_LINK}>
            {contest.title}
          </a>
        </h3>
        {description ? <p className="truncate text-sm text-muted-foreground">{description}</p> : null}
        <VerdictBar contest={contest} rows={rows} />
      </div>
    </>
  );
}
