"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cardDescription, sections } from "@/lib/display";
import { activeEntries, EMPTY, type GuideInfo, type PickFile, type Row } from "@/lib/filters";
import { candidateSlots, type Slots } from "@/lib/bar";
import { stepSelection, type KeyAction } from "@/lib/keyboard";
import { isPlainClick, pickSelected, toggleSelection } from "@/lib/links";
import type { Ballot, Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { FRAME } from "./frame";
import { SectionHeading } from "./SectionHeading";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useBallotFilters, useQueryParam } from "./useBallotFilters";
import { useBallotKeys } from "./useBallotKeys";
import { useHistorySheet } from "./useHistorySheet";
import { VerdictBar } from "./VerdictBar";

const DESKTOP = "(min-width: 1024px)";
// self-start: a grid item stretches to the row (the whole list), which made the sticky box a full
// viewport tall even around a short card, so it left the screen before the card's bottom met the footer.
const PANE = "scrollbar-thin hidden lg:sticky lg:top-0 lg:block lg:self-start lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-6";
// The pane's exit duration, from the shared motion tokens (0 under prefers-reduced-motion).
const motionOutMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-out")) || 0;

type Props = {
  election: string;
  intro: { title: string; line: string };
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

export function BallotView({ election, intro, ballot, guides, files, pending }: Props) {
  const { filters, setFilters } = useBallotFilters({ guides, keep: ["c"] });
  const [requested, setRequested] = useQueryParam("c");
  const [sheetOpen, setSheetOpen] = useHistorySheet();
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const [announce, setAnnounce] = useState("");
  const paneRef = useRef<HTMLDivElement>(null);
  // Pane motion only follows a click or key: a pane opened by ?c= on load appears without animating.
  const [animate, setAnimate] = useState(false);
  // The contest still drawn while its pane fades out; it's inert, then unmounted after --motion-out.
  const [exiting, setExiting] = useState<Contest | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const visible = sections(ballot.contests);
  const all = visible.flatMap((s) => s.contests);
  const selectedId = pickSelected(all.map((c) => c.id), requested);
  const current = selectedId === null ? undefined : all.find((c) => c.id === selectedId);
  const shown = current ?? exiting ?? undefined;
  const rowsFor = (id: string) => activeEntries(id, guides, files, filters);
  // EMPTY, not `filters`: a filter must never repaint a candidate.
  const slotsFor = (c: Contest) => candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry));
  const filterProps = { filters, onChange: setFilters, guides, files };

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  // Desktop selection changes go through here so opening and closing animate.
  const select = (next: string | null) => {
    setAnimate(true);
    clearTimeout(exitTimer.current);
    const out = motionOutMs();
    if (next === null && current && out > 0) {
      setExiting(current);
      exitTimer.current = setTimeout(() => setExiting(null), out);
    } else {
      setExiting(null);
    }
    setRequested(next);
  };

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Desktop only; selection goes through select(), exactly as a click on a row does.
  useBallotKeys((action: KeyAction) => {
    if (!window.matchMedia(DESKTOP).matches) return false;
    if (action === "help") {
      setShortcutsOpen(true);
      return;
    }
    if (action === "search") {
      document.querySelector<HTMLInputElement>("aside[aria-label=Filters] input[type=search]")?.focus();
      return;
    }
    const id = stepSelection(all.map((c) => c.id), selectedId, action);
    if (id === null) return;
    const c = all.find((x) => x.id === id);
    select(id);
    setAnnounce(`Showing ${c?.title ?? id}`);
    const row = document.getElementById(`row-d-${id}`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  });

  const onRowClick = (e: MouseEvent<HTMLAnchorElement>, c: Contest) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (window.matchMedia(DESKTOP).matches) {
      const next = toggleSelection(selectedId, c.id);
      select(next);
      setAnnounce(next ? `Showing ${c.title}` : "Details closed");
    } else {
      setRequested(c.id);
      setSheetOpen(true);
    }
  };

  const closePane = () => {
    if (selectedId === null) return;
    const row = document.getElementById(`row-d-${selectedId}`);
    select(null);
    setAnnounce("Details closed");
    row?.focus();
  };

  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || selectedId === null || !window.matchMedia(DESKTOP).matches) return;
    const t = e.target as Element;
    if (t.closest("[data-slot=popover-content]") || t.getAttribute("aria-expanded") === "true") return;
    closePane();
  };

  return (
    <div
      className={cn(
        FRAME,
        // Always three tracks, so the template interpolates when the pane opens or closes.
        "lg:grid lg:gap-x-6",
        // The list track is a length in both states (open: its 1 : 1.15 share of the space after the
        // sidebar and gaps; closed: that space capped at 48rem), so it interpolates and eases into its cap.
        current
          ? "lg:grid-cols-[17rem_minmax(0,calc((100%-20rem)/2.15))_minmax(0,1fr)]"
          : "lg:grid-cols-[17rem_minmax(0,min(48rem,calc(100%-20rem)))_minmax(0,1fr)]",
        animate && "lg:transition-[grid-template-columns] lg:duration-(--motion-in) lg:ease-(--ease-out)",
      )}
    >
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <noscript>
        <style>{".js-only{display:none!important}"}</style>
      </noscript>
      <FilterSidebar {...filterProps} className={cn(PANE, "js-only lg:pr-2")} />

      <div
        className="min-w-0 pb-10"
        role="region"
        aria-label="Contests"
        aria-keyshortcuts="ArrowDown ArrowUp j k / Shift+?"
        onKeyDown={onEscape}
      >
        <div className="pt-4 pb-1 lg:pt-6">
          <h1 className="text-xl font-semibold">{intro.title}</h1>
          <p className="text-sm text-muted-foreground">{intro.line}</p>
          <p className="hidden text-sm text-muted-foreground lg:block" aria-hidden="true">
            ↑↓ to browse · ? for shortcuts
          </p>
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

      {shown ? (
        <div
          ref={paneRef}
          // Slides and fades in on open (from @starting-style), out on close; inert while it leaves.
          className={cn(
            PANE,
            "min-w-0",
            animate && "lg:transition-[opacity,translate] lg:duration-(--motion-in) lg:ease-(--ease-out) lg:starting:translate-x-4 lg:starting:opacity-0",
            !current && "lg:translate-x-4 lg:opacity-0 lg:duration-(--motion-out)",
          )}
          inert={!current}
          onKeyDown={onEscape}
        >
          <section aria-labelledby="detail-title" className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <ContestDetail
              election={election}
              contest={shown}
              rows={rowsFor(shown.id)}
              pending={pending}
              titleId="detail-title"
              slots={slotsFor(shown)}
              action={
                <Button variant="ghost" size="icon" aria-label="Close details" onClick={closePane} className="-mt-1.5 -mr-2 size-10 shrink-0">
                  <X aria-hidden="true" className="size-5" />
                </Button>
              }
            />
          </section>
        </div>
      ) : null}

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl lg:hidden"
          initialFocus={sheetTitleRef}
          // Safari doesn't focus links on tap, so name the row to return focus to.
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

const keepNumber = (title: string) => title.replace(/ (\d+)$/, "\u00a0$1");

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
      <div className={cn("relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-3 active:bg-muted/60 lg:hidden", ROW_FOCUS)}>
        <h3 className="min-w-0 flex-1 text-base font-medium">
          <a id={`row-m-${contest.id}`} href={href} onClick={onClick} className={ROW_LINK}>
            {keepNumber(contest.title)}
          </a>
        </h3>
        <VerdictBar contest={contest} rows={rows} slots={slots} variant="inline" />
      </div>
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
