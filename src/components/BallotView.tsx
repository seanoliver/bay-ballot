"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AreaLink, PlaceGroup } from "@/lib/areas";
import { cardDescription, counted } from "@/lib/display";
import { fallbackRows, parseScopes, SCOPE_KEY, sectionScope, skippedLabel, withScope, type Fallback, type FallbackSection, type Scope } from "@/lib/fallback";
import { activeEntries, EMPTY, positionGuides, revealGuides, toQuery, type FilterGuide, type Filters, type GuideInfo, type PickFile, type Row } from "@/lib/filters";
import { candidateSlots, type Slots } from "@/lib/bar";
import { stepSelection, trailing, type KeyAction } from "@/lib/keyboard";
import { navModel, sectionOf, spySection, stepFrom } from "@/lib/section-nav";
import { isPlainClick, pickSelected, toggleSelection } from "@/lib/links";
import type { Contest } from "@/lib/schema";
import { isZip, ZIP_KEY, zipGroups, type ZipPlaces, type ZipTable, type ZipView } from "@/lib/zip";
import { cn } from "@/lib/utils";
import { AreaPicker } from "./AreaPicker";
import { ContestDetail } from "./ContestDetail";
import { FilterSidebar, FiltersSheet } from "./FilterPanel";
import { BayBlock, ScopeSwitch } from "./ScopeSwitch";
import { keepNumber } from "@/lib/display";
import { DESKTOP, FILTER_SEARCH, FRAME, PANE } from "./frame";
import { ROW_FOCUS, ROW_LINK } from "./row";
import { SectionHeading } from "./SectionHeading";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useBallotFilters, useCarriedQuery, useQueryParam, useStoredKey } from "./useBallotFilters";
import { useBallotKeys } from "./useBallotKeys";
import { SectionNav } from "./SectionNav";
import { markHomeVisit, useHomeRedirect } from "./useHomeRedirect";
import { useSingleKeys } from "./useSingleKeys";
import { useHistorySheet } from "./useHistorySheet";
import { VerdictBar } from "./VerdictBar";
import { ZipChip, ZipStatus, type ZipSummary } from "./ZipChip";

// The pane's exit duration, from the shared motion tokens (0 under prefers-reduced-motion).
const subscribeDesktop = (onChange: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;
const STEP_URL_MS = 250;
const msFromNow = (ms: number) => performance.now() + ms;
// Focusable only while focused, so a click on the list's empty space still leaves focus on <body>.
function focusTarget(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  el.tabIndex = -1;
  el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
  return el;
}
const motionOutMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-out")) || 0;

type Props = {
  election: string;
  area: string | null;
  county: string | null;
  city: string | null;
  links: AreaLink[];
  intro: { title: string; line: string };
  groups: PlaceGroup[];
  guides: GuideInfo[];
  allGuides: FilterGuide[];
  files: Record<string, PickFile>;
  pending: string | null;
  fallback?: Fallback | null;
  /** True while the list still shows the area being left. */
  busy?: boolean;
  onSwitch?: (href: string) => boolean;
  onIntent?: () => void;
};

// Per view and ZIP, so switching back to an area keeps the same groups and so the same rows and bars below.
const zipCache = new WeakMap<PlaceGroup[], Map<string, ZipView>>();
function cachedZipView(groups: PlaceGroup[], zip: string, z: ZipPlaces, table: ZipTable): ZipView {
  let byZip = zipCache.get(groups);
  if (!byZip) zipCache.set(groups, (byZip = new Map()));
  let v = byZip.get(zip);
  if (!v) byZip.set(zip, (v = zipGroups(groups, z, table)));
  return v;
}
function zipSpoken(zip: string, s: ZipSummary, showAll: boolean): string {
  if (s.kind === "loading") return "";
  if (s.kind === "failed") return "Couldn’t load the ZIP list. Every contest is shown.";
  if (s.kind === "unknown") return `ZIP ${zip} isn’t a Bay Area ZIP, or one this site can’t map. Every contest is shown.`;
  if (s.kind === "elsewhere") return `ZIP ${zip}: ${s.where}`;
  return showAll ? `Showing all ${counted(s.on + s.maybe + s.hidden, "contest")}` : `Showing ${counted(s.on + s.maybe, "contest")} for ZIP ${zip}, ${s.hidden} hidden`;
}

// SF is a consolidated city and county, named without "County" everywhere else on the site.
const countyBallotName = (county: string) => (county === "San Francisco" ? county : `${county} County`);

// Per view, so switching back to an area reuses its rows and bars.
const slotsCache = new WeakMap<PlaceGroup[], Map<string, Slots>>();
const rowsCache = new WeakMap<PlaceGroup[], { filters: string; rows: Map<string, Row[]> }>();

export function BallotView({ election, area, county, city, links, intro, groups: allGroups, guides, allGuides, files, pending, fallback = null, busy = false, onSwitch, onIntent }: Props) {
  const { filters, setFilters: applyFilters } = useBallotFilters({ guides: allGuides, keep: ["c"] });
  const [requested, setRequested] = useQueryParam("c");
  useHomeRedirect({ election, area });
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const [sheetOpen, setSheetOpen] = useHistorySheet();
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const [announce, setAnnounce] = useState("");
  const paneRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Pane motion only follows a click or key: a pane opened by ?c= on load appears without animating.
  const [animate, setAnimate] = useState(false);
  // The contest still drawn while its pane fades out; it's inert, then unmounted after --motion-out.
  const [exiting, setExiting] = useState<Contest | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [zipRaw, setZipRaw] = useStoredKey(ZIP_KEY);
  const zip = zipRaw && isZip(zipRaw) ? zipRaw : null;
  const [table, setTable] = useState<ZipTable | null>(null);
  const [tableFailed, setTableFailed] = useState(false);
  useEffect(() => {
    if (!zip || table || tableFailed) return;
    import("@/data/zips.json").then(
      (m) => setTable(m.default as ZipTable),
      () => setTableFailed(true),
    );
  }, [zip, table, tableFailed]);
  const [showAllFor, setShowAllFor] = useState<string | null>(null);
  const [zipEditing, setZipEditing] = useState(false);
  const [zipError, setZipError] = useState(false);
  const zipErrorId = useId();
  const zipPlaces = zip && table && Object.hasOwn(table.zips, zip) ? table.zips[zip] : null;
  // A ZIP outside this page's county (or city) isn't filtered here: the page points to the ZIP's own ballot instead.
  const outsideCounty = zipPlaces && county && !zipPlaces.counties.includes(county);
  const outsideCity = zipPlaces && city && !Object.hasOwn(zipPlaces.places, city);
  const zipView = useMemo(
    () => (zip && zipPlaces && table && !outsideCounty && !outsideCity ? cachedZipView(allGroups, zip, zipPlaces, table) : null),
    [allGroups, zip, zipPlaces, table, outsideCounty, outsideCity],
  );
  // A link to a contest the ZIP hides still opens it, and turns Show all on so the list stays put when it closes.
  const requestedHidden = requested !== null && zipView?.fit.get(requested) === "off";
  if (zip && requestedHidden && showAllFor !== zip) setShowAllFor(zip);
  const showAll = zip !== null && (showAllFor === zip || requestedHidden);
  const groups = useMemo(() => (zipView && !showAll ? zipView.groups : allGroups), [zipView, showAll, allGroups]);
  const ballotLink = (name: string) => ({ label: countyBallotName(name), href: links.find((l) => l.label === name)?.href ?? null });
  const notes: { text: string; links: { label: string; href: string | null }[] }[] = [];
  if (zipPlaces && !outsideCounty && !outsideCity) {
    const others = zipPlaces.counties.filter((c) => c !== county);
    if (county && others.length) notes.push({ text: `Part of this ZIP is in ${others.map(countyBallotName).join(" and ")}.`, links: others.map(ballotLink) });
    if (city && city !== county && zipPlaces.places[city] !== "full" && county) notes.push({ text: `Part of this ZIP is outside ${city}.`, links: [ballotLink(county)] });
    if (zipPlaces.outside?.length) notes.push({ text: `Part of this ZIP is in ${zipPlaces.outside.map((c) => `${c} County`).join(" and ")}, which this site doesn’t cover.`, links: [] });
  }
  const zipSummary: ZipSummary | null = !zip
    ? null
    : tableFailed
      ? { kind: "failed" }
      : !table
        ? { kind: "loading" }
        : !zipPlaces
          ? { kind: "unknown" }
          : outsideCounty
            ? { kind: "elsewhere", where: `In ${zipPlaces.counties.map(countyBallotName).join(" and ")}.`, links: zipPlaces.counties.map(ballotLink) }
            : outsideCity
              ? { kind: "elsewhere", where: `Not in ${city}.`, links: zipPlaces.counties.map(ballotLink) }
              : { kind: "filtered", on: zipView!.on, maybe: zipView!.maybe, hidden: zipView!.hidden, notes };
  const zipNote = (id: string) => {
    const f = zipView?.fit.get(id);
    return f === "maybe" ? "May be on your ballot" : f === "off" ? `Probably not on ballots in ZIP ${zip}` : null;
  };
  // Announced only after the visitor acts on the box, and only on the page where they did.
  const [zipActedOn, setZipActedOn] = useState<string | null | undefined>(undefined);
  const announced = zipActedOn === area && zipSummary ? zipSpoken(zip!, zipSummary, showAll) : "";
  const setShowAll = (v: boolean) => {
    setZipActedOn(area);
    stepWrite.cancel();
    setStepped(null);
    setShowAllFor(v ? zip : null);
    if (!v && requestedHidden) select(null);
  };

  const all = useMemo(() => groups.flatMap((g) => g.sections.flatMap((s) => s.contests)), [groups]);
  const nav = useMemo(() => navModel(groups), [groups]);
  const [navSection, setNavSection] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [navStuck, setNavStuck] = useState(false);
  const spyPausedUntil = useRef(0);
  useEffect(() => {
    let frame = 0;
    const spy = () => {
      frame = 0;
      const bar = document.querySelector("[data-section-nav]");
      const barBox = bar?.getBoundingClientRect();
      setNavStuck(barBox !== undefined && barBox.top <= 0.5 && window.scrollY > 0);
      if (performance.now() < spyPausedUntil.current) return;
      const headings = nav.flatMap((p) => p.sections).map((x) => ({ id: x.id, top: document.getElementById(x.id)?.getBoundingClientRect().top ?? Infinity }));
      const line = (barBox?.bottom ?? 0) + window.innerHeight * 0.25;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      setNavSection(spySection(headings, { line, atBottom, viewport: window.innerHeight }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(spy);
    };
    spy();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [nav]);
  const jumpedTo = useRef<string | null>(null);
  useEffect(() => {
    const forget = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest("[data-section-menu]"))) jumpedTo.current = null;
    };
    window.addEventListener("pointerdown", forget, true);
    return () => window.removeEventListener("pointerdown", forget, true);
  }, []);
  const jumpTo = (id: string) => {
    const heading = document.getElementById(id);
    if (!heading) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spyPausedUntil.current = msFromNow(smooth ? 1000 : 100);
    jumpedTo.current = id;
    heading.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    setNavSection(nav.find((p) => p.id === id)?.sections[0]?.id ?? id);
  };
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
    const leaving = (el: EventTarget | null) => el instanceof Element && el.closest("a[href]") !== null && el.closest("[data-keys=list]") === null && el.closest("[data-section-menu]") === null;
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
  const rowsById = useMemo(() => {
    const key = toQuery(filters);
    const hit = rowsCache.get(groups);
    if (hit?.filters === key) return hit.rows;
    const rows = new Map(all.map((c) => [c.id, activeEntries(c.id, guides, files, filters)]));
    rowsCache.set(groups, { filters: key, rows });
    return rows;
  }, [groups, all, guides, files, filters]);
  const rowsFor = (id: string) => rowsById.get(id) ?? activeEntries(id, guides, files, filters);
  // EMPTY, not `filters`: a filter must never repaint a candidate.
  const slotsById = useMemo(() => {
    const hit = slotsCache.get(groups);
    if (hit) return hit;
    const slots = new Map(all.map((c) => [c.id, candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry))]));
    slotsCache.set(groups, slots);
    return slots;
  }, [groups, all, guides, files]);
  const slotsFor = (c: Contest) => slotsById.get(c.id) ?? candidateSlots(c, activeEntries(c.id, guides, files, EMPTY).map((r) => r.entry));
  const [scopeRaw, setScopeRaw] = useStoredKey(SCOPE_KEY);
  const chosen = useMemo(() => parseScopes(scopeRaw), [scopeRaw]);
  const sectionFallback = useMemo(() => new Map((fallback?.sections ?? []).map((s) => [s.id, s])), [fallback]);
  const fallbackOf = useMemo(() => new Map((fallback?.sections ?? []).flatMap((s) => s.contests.map((id) => [id, s] as const))), [fallback]);
  const bay = useMemo(() => {
    const out = new Map<string, BayResult>();
    if (!fallback) return out;
    for (const c of all) {
      if (!fallbackOf.has(c.id)) continue;
      const every = fallbackRows(c.id, fallback, EMPTY);
      out.set(c.id, { rows: fallbackRows(c.id, fallback, filters), total: every.length, slots: candidateSlots(c, every.map((r) => r.entry)) });
    }
    return out;
  }, [all, fallback, fallbackOf, filters]);
  const scopeKey = (s: FallbackSection) => `${area}:${s.id}`;
  const setScope = (s: FallbackSection, v: Scope) => setScopeRaw(withScope(scopeRaw, scopeKey(s), v));
  const detailFallback = (c: Contest) => {
    const s = fallbackOf.get(c.id);
    const b = bay.get(c.id);
    if (!s || !b || !fallback) return undefined;
    return { place: fallback.place, scope: sectionScope(chosen[scopeKey(s)], "bay"), onScope: (v: Scope) => setScope(s, v), onReveal: () => revealBay(c), ...b };
  };
  const setFilters = (f: Filters) => {
    markHomeVisit(area);
    applyFilters(f);
  };
  const revealBay = (c: Contest) => {
    if (fallback) setFilters(revealGuides(filters, positionGuides(c.id, fallback.guides, fallback.files).map((g) => g.id), fallback.files));
  };
  const revealBayRef = useRef(revealBay);
  useLayoutEffect(() => {
    revealBayRef.current = revealBay;
  });
  const onRevealBayStable = useCallback((c: Contest) => revealBayRef.current(c), []);
  const filterProps = { filters, onChange: setFilters, guides, files, typeGuides: allGuides };
  const carry = useCarriedQuery();

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [selectedId, area]);

  // The area changes in place after a chip click or Back: drop what belonged to the old list.
  const [shownArea, setShownArea] = useState(area);
  if (shownArea !== area) {
    setShownArea(area);
    setStepped(null);
    setExiting(null);
    setAnimate(false);
    setAnnounce(`Showing ${intro.title}`);
    setZipActedOn(undefined);
  }
  useEffect(() => {
    stepWrite.cancel();
    jumpedTo.current = null;
  }, [area, stepWrite]);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  // Desktop selection changes go through here so opening and closing animate.
  const select = (next: string | null) => {
    jumpedTo.current = null;
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
    jumpedTo.current = null;
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
    if (action === "jump") {
      setNavOpen(true);
      return;
    }
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
      document.querySelector<HTMLInputElement>(FILTER_SEARCH)?.focus();
      return;
    }
    const ids = all.map((c) => c.id);
    const active = document.activeElement;
    const heading = active instanceof HTMLHeadingElement && /^(place|section)-/.test(active.id) ? active.id : null;
    const anchor = heading ?? jumpedTo.current;
    jumpedTo.current = null;
    const id = anchor ? stepFrom(nav, anchor, ids, action) : stepSelection(ids, selectedId, action);
    if (id === null) return false;
    setAnimate(true);
    clearTimeout(exitTimer.current);
    setExiting(null);
    setStepped(id);
    stepWrite.push({ id, path: window.location.pathname });
    spyPausedUntil.current = msFromNow(200);
    setNavSection(sectionOf(nav, id));
    const row = document.getElementById(`row-d-${id}`);
    row?.focus({ preventScroll: true });
    row?.closest("li")?.scrollIntoView({ block: "nearest" });
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
        animate && !busy && "lg:transition-[grid-template-columns] lg:duration-(--motion-in) lg:ease-(--ease-out)",
      )}
    >
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      <FilterSidebar {...filterProps} className={cn(PANE, "js-only lg:pr-2")} />

      <div
        ref={listRef}
        // Dims the contests only if the next area takes a moment to draw.
        className={cn("min-w-0 pb-10 outline-none lg:col-start-2", busy && "[&>section]:opacity-60 [&>section]:transition-opacity [&>section]:delay-150")}
        aria-busy={busy || undefined}
        role={desktop ? "region" : undefined}
        aria-label={desktop ? "Contests" : undefined}
        aria-keyshortcuts={desktop ? (singleKeys ? "ArrowDown ArrowUp j k g / Shift+?" : "ArrowDown ArrowUp") : undefined}
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
          <AreaPicker links={links} onSwitch={onSwitch} onIntent={onIntent}>
            <ZipChip
              zip={zip}
              editing={zipEditing}
              setEditing={setZipEditing}
              error={zipError}
              setError={setZipError}
              errorId={zipErrorId}
              onZip={(v) => {
                setZipActedOn(area);
                setShowAllFor(null);
                stepWrite.cancel();
                setStepped(null);
                setZipRaw(v ?? "");
              }}
            />
          </AreaPicker>
          <ZipStatus
            zip={zip}
            summary={zipSummary}
            showAll={showAll}
            editing={zipEditing}
            error={zipError}
            errorId={zipErrorId}
            onShowAll={setShowAll}
            onRetry={() => {
              setZipActedOn(area);
              setTableFailed(false);
            }}
          />
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
        <SectionNav places={nav} current={navSection} open={navOpen} stuck={navStuck} onOpenChange={setNavOpen} onJump={jumpTo} />
        {groups.map((g, gi) => (
          <section key={g.key} aria-label={g.heading}>
            <SectionHeading id={nav[gi].id}>{g.heading}</SectionHeading>
            {g.sections.map((s, si) => {
              const sf = sectionFallback.get(nav[gi].sections[si].id);
              const scope = sf ? sectionScope(chosen[scopeKey(sf)], sf.initial) : undefined;
              return (
                <section key={s.name} aria-label={`${g.heading}: ${s.name}`}>
                  {sf && scope && fallback ? (
                    <div className="flex flex-wrap items-end justify-between gap-x-3">
                      <SectionHeading as="h3" id={nav[gi].sections[si].id}>
                        {s.name}
                      </SectionHeading>
                      <ScopeSwitch className="mb-1.5" place={fallback.place} scope={scope} onChange={(v) => setScope(sf, v)} />
                    </div>
                  ) : (
                    <SectionHeading as="h3" id={nav[gi].sections[si].id}>
                      {s.name}
                    </SectionHeading>
                  )}
                  <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                    {s.contests.map((c) => (
                      <li key={c.id}>
                        <ContestRow
                          href={`/${election}/${c.id}${carry}`}
                          contest={c}
                          rows={rowsFor(c.id)}
                          slots={slotsFor(c)}
                          selected={c.id === selectedId}
                          onClick={onRowClickStable}
                          place={fallback?.place}
                          scope={sf?.contests.includes(c.id) ? scope : undefined}
                          bay={bay.get(c.id)}
                          onRevealBay={onRevealBayStable}
                          zipNote={zipNote(c.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
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
              fallback={detailFallback(shown)}
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
          finalFocus={() => (current ? (document.getElementById(`row-m-${current.id}`) ?? focusTarget(listRef.current) ?? true) : true)}
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
                <ContestDetail election={election} contest={current} rows={rowsFor(current.id)} pending={pending} heading={false} slots={slotsFor(current)} fallback={detailFallback(current)} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

type BayResult = { rows: Row[]; slots: Slots; total: number };

const ContestRow = memo(function ContestRow({
  href,
  contest,
  rows,
  slots,
  selected,
  onClick,
  place,
  scope,
  bay,
  onRevealBay,
  zipNote,
}: {
  href: string;
  contest: Contest;
  rows: Row[];
  slots: Slots;
  selected: boolean;
  onClick: (e: MouseEvent<HTMLAnchorElement>, c: Contest) => void;
  place?: string;
  scope?: Scope;
  bay?: BayResult;
  onRevealBay?: (c: Contest) => void;
  zipNote: string | null;
}) {
  const description = cardDescription(contest);
  const skipped = scope === "area" && place ? <p className="text-sm text-muted-foreground">{skippedLabel(place)}</p> : null;
  const wide = scope === "bay" && bay ? bay : null;
  const reveal = () => onRevealBay?.(contest);
  const note = (layout: "m" | "d") =>
    zipNote ? (
      <p id={`zipnote-${layout}-${contest.id}`} className="basis-full text-sm text-muted-foreground">
        {zipNote}
      </p>
    ) : null;
  return (
    <>
      <div className={cn("relative flex min-h-16 items-center gap-3 py-3 pr-3 pl-3 active:bg-muted/60 lg:hidden", (wide || skipped || zipNote) && "flex-wrap gap-y-2", ROW_FOCUS)}>
        <h4 className="min-w-0 flex-1 text-base font-medium">
          <a
            id={`row-m-${contest.id}`}
            href={href}
            onClick={(e) => onClick(e, contest)}
            aria-describedby={zipNote ? `zipnote-m-${contest.id}` : undefined}
            className={ROW_LINK}
          >
            {keepNumber(contest.title)}
          </a>
        </h4>
        {note("m")}
        {wide ? (
          <BayBlock id={`bay-m-${contest.id}`} title={contest.title} shown={wide.rows.length} total={wide.total} onReveal={reveal} inline className="basis-full">
            <VerdictBar contest={contest} rows={wide.rows} slots={wide.slots} variant="inline" />
          </BayBlock>
        ) : skipped ? (
          <div className="basis-full">{skipped}</div>
        ) : (
          <VerdictBar contest={contest} rows={rows} slots={slots} variant="inline" />
        )}
      </div>
      <div
        className={cn(
          "relative hidden px-4 py-3 transition-[background-color] hover:bg-muted/60 lg:block",
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
            aria-describedby={zipNote ? `zipnote-d-${contest.id}` : undefined}
            className={ROW_LINK}
          >
            {contest.title}
          </a>
        </h4>
        {note("d")}
        {description ? <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
        {wide ? (
          <BayBlock id={`bay-d-${contest.id}`} title={contest.title} shown={wide.rows.length} total={wide.total} onReveal={reveal} className="mt-2">
            <VerdictBar contest={contest} rows={wide.rows} slots={wide.slots} />
          </BayBlock>
        ) : skipped ? (
          <div className="mt-1">{skipped}</div>
        ) : (
          <VerdictBar contest={contest} rows={rows} slots={slots} />
        )}
      </div>
    </>
  );
});
