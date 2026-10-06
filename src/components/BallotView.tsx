"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AreaLink, PlaceGroup } from "@/lib/areas";
import { COUNTIES_KEY, COUNTIES_PARAM, countyOptions, hiddenCountyOf, parseCounties, toggleCounty, viewCounties, showCountyFilter, toCountiesParam, visibleGroups } from "@/lib/counties";
import { cardDescription } from "@/lib/display";
import { activeEntries, EMPTY, type Filters, type GuideInfo, type PickFile, type Row } from "@/lib/filters";
import { candidateSlots, type Slots } from "@/lib/bar";
import { stepSelection, trailing, type KeyAction } from "@/lib/keyboard";
import { isPlainClick, pickSelected, toggleSelection } from "@/lib/links";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { AreaPicker } from "./AreaPicker";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { FRAME } from "./frame";
import { SectionHeading } from "./SectionHeading";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useBallotFilters, useQueryParam, useStoredParam } from "./useBallotFilters";
import { useBallotKeys } from "./useBallotKeys";
import { markHomeVisit, useHomeRedirect } from "./useHomeRedirect";
import { useSingleKeys } from "./useSingleKeys";
import { useHistorySheet } from "./useHistorySheet";
import { VerdictBar } from "./VerdictBar";

const DESKTOP = "(min-width: 1024px)";
// self-start: a grid item stretches to the row (the whole list), which made the sticky box a full
// viewport tall even around a short card, so it left the screen before the card's bottom met the footer.
const PANE = "scrollbar-thin hidden lg:sticky lg:top-0 lg:block lg:self-start lg:max-h-dvh lg:overflow-y-auto lg:overscroll-contain lg:py-6";
// The pane's exit duration, from the shared motion tokens (0 under prefers-reduced-motion).
const subscribeDesktop = (onChange: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;
const STEP_URL_MS = 250;
const motionOutMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-out")) || 0;

type Props = {
  election: string;
  area: string | null;
  links: AreaLink[];
  intro: { title: string; line: string };
  groups: PlaceGroup[];
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

export function BallotView({ election, area, links, intro, groups, guides, files, pending }: Props) {
  const { filters, setFilters: applyFilters } = useBallotFilters({ guides, keep: ["c", COUNTIES_PARAM] });
  const options = useMemo(() => (area === null ? countyOptions(groups) : []), [area, groups]);
  const [offParam, setOffParam] = useStoredParam(COUNTIES_PARAM, COUNTIES_KEY);
  const offCounties = useMemo(() => parseCounties(offParam, options), [offParam, options]);
  const [requested, setRequested] = useQueryParam("c");
  const view = useMemo(() => viewCounties(groups, offCounties, requested), [groups, offCounties, requested]);
  const listed = useMemo(() => visibleGroups(groups, view.off), [groups, view.off]);
  useHomeRedirect({ election, area });
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [sheetOpen, setSheetOpen] = useHistorySheet();
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const [announce, setAnnounce] = useState("");
  const [announcedFor, setAnnouncedFor] = useState<string | null>(null);
  if (view.revealed && requested !== announcedFor) {
    setAnnouncedFor(requested);
    setAnnounce(`Showing ${view.revealed.name} contests for this link`);
  }
  const paneRef = useRef<HTMLDivElement>(null);
  // Pane motion only follows a click or key: a pane opened by ?c= on load appears without animating.
  const [animate, setAnimate] = useState(false);
  // The contest still drawn while its pane fades out; it's inert, then unmounted after --motion-out.
  const [exiting, setExiting] = useState<Contest | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const all = useMemo(() => listed.flatMap((g) => g.sections.flatMap((s) => s.contests)), [listed]);
  const [stepped, setStepped] = useState<string | null>(null);
  const [stepWrite] = useState(() =>
    trailing(STEP_URL_MS, ({ id, path }: { id: string; path: string }) => {
      if (window.location.pathname !== path || !window.matchMedia(DESKTOP).matches) return;
      setRequested(id);
      setStepped(null);
    }),
  );
  useEffect(() => {
    const flush = () => stepWrite.flush();
    const flushIfDue = () => stepWrite.flushIfDue();
    const leaving = (el: EventTarget | null) => el instanceof Element && el.closest("a[href]") !== null && el.closest("[data-keys=list]") === null;
    // Capture phase, so the write lands before a Link starts a client-side navigation.
    const onClick = (e: globalThis.MouseEvent) => {
      if (leaving(e.target)) flush();
    };
    const onEnter = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Enter" && leaving(document.activeElement)) flush();
    };
    window.addEventListener("keyup", flushIfDue);
    window.addEventListener("pagehide", flush);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onEnter, true);
    return () => {
      window.removeEventListener("keyup", flushIfDue);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onEnter, true);
      stepWrite.cancel();
    };
  }, [stepWrite]);
  const [wasDesktop, setWasDesktop] = useState(desktop);
  if (wasDesktop !== desktop) {
    setWasDesktop(desktop);
    if (!desktop) setStepped(null);
  }
  useEffect(() => {
    if (!desktop) stepWrite.cancel();
  }, [desktop, stepWrite]);
  const selectedId = pickSelected(all.map((c) => c.id), stepped ?? requested);
  const current = selectedId === null ? undefined : all.find((c) => c.id === selectedId);
  const shown = current ?? exiting ?? undefined;
  const rowsById = useMemo(() => new Map(all.map((c) => [c.id, activeEntries(c.id, guides, files, filters)])), [all, guides, files, filters]);
  const rowsFor = (id: string) => rowsById.get(id) ?? activeEntries(id, guides, files, filters);
  // EMPTY, not `filters`: a filter must never repaint a candidate.
  const slotsById = useMemo(
    () => new Map(all.map((c) => [c.id, candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry))])),
    [all, guides, files],
  );
  const slotsFor = (c: Contest) => slotsById.get(c.id) ?? candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry));
  const setOffCounties = (off: string[]) => {
    markHomeVisit(area);
    setOffParam(toCountiesParam(off));
    const sel = stepped ?? requested;
    if (sel !== null && hiddenCountyOf(groups, off, sel)) {
      stepWrite.cancel();
      setStepped(null);
      setRequested(null);
    }
  };
  const onToggleCounty = (id: string) => setOffCounties(view.revealed?.id === id ? offCounties : toggleCounty(offCounties, id));
  const counties = showCountyFilter(options)
    ? { options, off: view.off, saved: offCounties, onToggle: onToggleCounty, onShowAll: () => setOffCounties([]) }
    : undefined;
  const setFilters = (f: Filters) => {
    markHomeVisit(area);
    applyFilters(f);
  };
  const filterProps = { filters, onChange: setFilters, guides, files, counties };

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
    stepWrite.cancel();
    setStepped(null);
    setRequested(next);
  };

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [singleKeys, setSingleKeys] = useSingleKeys();
  const onRowClick = (e: MouseEvent<HTMLAnchorElement>, c: Contest) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (window.matchMedia(DESKTOP).matches) {
      // detail 0: Enter on the link, not a mouse click.
      if (e.detail === 0 && selectedId === c.id) {
        document.getElementById("detail-title")?.focus();
        return;
      }
      const next = toggleSelection(selectedId, c.id);
      select(next);
      setAnnounce(next ? `Showing ${c.title}` : "Details closed");
    } else {
      stepWrite.cancel();
      setStepped(null);
      setRequested(c.id);
      setSheetOpen(true);
    }
  };
  const rowClick = useRef(onRowClick);
  useLayoutEffect(() => {
    rowClick.current = onRowClick;
  });
  const onRowClickStable = useCallback((e: MouseEvent<HTMLAnchorElement>, c: Contest) => rowClick.current(e, c), []);

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

  useBallotKeys((action: KeyAction) => {
    // false, not a bare return: it leaves the key to the browser, so arrows still scroll on mobile.
    if (!window.matchMedia(DESKTOP).matches) return false;
    if (action === "help") {
      setShortcutsOpen(true);
      return;
    }
    if (action === "close") {
      if (selectedId === null) return false;
      closePane();
      return;
    }
    if (action === "search") {
      document.querySelector<HTMLInputElement>("aside[aria-label=Filters] input[type=search]")?.focus();
      return;
    }
    const id = stepSelection(all.map((c) => c.id), selectedId, action);
    if (id === null) return false;
    setAnimate(true);
    clearTimeout(exitTimer.current);
    setExiting(null);
    setStepped(id);
    stepWrite.push({ id, path: window.location.pathname });
    const row = document.getElementById(`row-d-${id}`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  }, { singleKeys });

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
        role={desktop ? "region" : undefined}
        aria-label={desktop ? "Contests" : undefined}
        aria-keyshortcuts={desktop ? (singleKeys ? "ArrowDown ArrowUp j k / Shift+?" : "ArrowDown ArrowUp") : undefined}
        data-keys="list"
        onKeyDown={onEscape}
      >
        <div className="pt-4 pb-1 lg:pt-6">
          <h1 className="text-xl font-semibold">{intro.title}</h1>
          <p className="text-sm text-muted-foreground">{intro.line}</p>
          <div className="js-only hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <p aria-hidden="true">{singleKeys ? "↑↓ to browse · ? for shortcuts" : "↑↓ to browse"}</p>
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setShortcutsOpen(true)}>
              Keyboard shortcuts
            </button>
          </div>
          <AreaPicker links={links} />
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
        {listed.map((g) => (
          <section key={g.key} aria-label={g.heading}>
            <SectionHeading>{g.heading}</SectionHeading>
            {g.sections.map((s) => (
              <section key={s.name} aria-label={`${g.heading}: ${s.name}`}>
                <SectionHeading as="h3">{s.name}</SectionHeading>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  {s.contests.map((c) => (
                    <li key={c.id}>
                      <ContestRow
                        href={`/${election}/${c.id}`}
                        contest={c}
                        rows={rowsFor(c.id)}
                        slots={slotsFor(c)}
                        selected={c.id === selectedId}
                        onClick={onRowClickStable}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))}
      </div>

      {shown ? (
        <div
          ref={paneRef}
          data-keys="pane"
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

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} singleKeys={singleKeys} onSingleKeysChange={setSingleKeys} />

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

const ContestRow = memo(function ContestRow({
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
  onClick: (e: MouseEvent<HTMLAnchorElement>, c: Contest) => void;
}) {
  const description = cardDescription(contest);
  return (
    <>
      <div className={cn("relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-3 active:bg-muted/60 lg:hidden", ROW_FOCUS)}>
        <h4 className="min-w-0 flex-1 text-base font-medium">
          <a id={`row-m-${contest.id}`} href={href} onClick={(e) => onClick(e, contest)} className={ROW_LINK}>
            {keepNumber(contest.title)}
          </a>
        </h4>
        <VerdictBar contest={contest} rows={rows} slots={slots} variant="inline" />
      </div>
      <div
        className={cn(
          "relative hidden px-4 py-3 transition-colors hover:bg-muted/60 lg:block",
          ROW_FOCUS,
          selected && "bg-muted shadow-[inset_3px_0_0_var(--foreground)]",
        )}
      >
        <h4 className="text-base font-semibold">
          <a
            id={`row-d-${contest.id}`}
            href={href}
            onClick={(e) => onClick(e, contest)}
            aria-current={selected ? "true" : undefined}
            className={ROW_LINK}
          >
            {contest.title}
          </a>
        </h4>
        {description ? <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
        <VerdictBar contest={contest} rows={rows} slots={slots} />
      </div>
    </>
  );
});
