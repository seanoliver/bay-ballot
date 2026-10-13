"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Pin, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  countedLabel,
  EMPTY,
  filterSummary,
  guideGroups,
  isGuideOn,
  isPinned,
  MAX_PINS,
  toggleGuide,
  togglePin,
  setTypeGroup,
  typeState,
  type FilterGuide,
  type Filters,
  type GuideGroup,
  type GuideInfo,
  type PickFile,
} from "@/lib/filters";
import { displayName } from "@/lib/display";
import { cn } from "@/lib/utils";
import { useHistorySheet } from "./useHistorySheet";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  /** Every published guide, for the type checkboxes and for naming pins from other areas. */
  typeGuides?: GuideInfo[];
  /** The guides on this area's ballot; a pin outside them is marked. Unset on a contest page, where a guide may just have skipped the contest. */
  onBallot?: GuideInfo[];
};

export function FilterSidebar({ className, ...props }: Props & { className?: string }) {
  return (
    <aside aria-label="Filters" className={className}>
      <p className="text-sm font-semibold">Filters</p>
      <p className="text-sm text-muted-foreground">{countedLabel(filterSummary(props.filters, props.guides, props.files))}</p>
      <FilterControls {...props} />
    </aside>
  );
}

export function FiltersSheet({ className, ...props }: Props & { className?: string }) {
  const [open, setOpen] = useHistorySheet();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-auto min-h-12 justify-start gap-2 rounded-xl px-3.5 py-2.5 text-base font-normal whitespace-normal", className)}
          />
        }
      >
        <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
        <span className="text-left">
          <span className="font-semibold">Filters</span>
          <span className="text-muted-foreground">
            {" · "}
            {countedLabel(filterSummary(props.filters, props.guides, props.files))}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl">
        <SheetHeader className="pr-12 pb-0">
          <SheetTitle className="text-xl font-semibold">Filters</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          <FilterControls {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterControls({ filters: f, onChange, guides, files, typeGuides, onBallot }: Props) {
  const pinCountId = useId();
  return (
    <>
      <PinnedGuides filters={f} onChange={onChange} all={typeGuides ?? guides} onBallot={onBallot} countId={pinCountId} />
      <Section title="Show">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={f.whyOnly} onCheckedChange={(on) => onChange({ ...f, whyOnly: on === true })} />
          Only guides that explain their endorsements
        </label>
      </Section>
      <GuideChecklist filters={f} onChange={onChange} guides={guides} files={files} typeGuides={typeGuides} pinCountId={pinCountId} />
      {/* Pins aren't a filter: resetting what's counted keeps them. */}
      <Button variant="link" className="mt-3 h-10 px-0 text-sm underline" onClick={() => onChange({ ...EMPTY, pins: f.pins })}>
        Reset filters
      </Button>
    </>
  );
}

function PinnedGuides({
  filters: f,
  onChange,
  all,
  onBallot,
  countId,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  all: GuideInfo[];
  onBallot?: GuideInfo[];
  countId: string;
}) {
  const pinned = f.pins.map((id) => all.find((g) => g.id === id)).filter((g) => g !== undefined);
  const listRef = useRef<HTMLDivElement>(null);
  // Unpinning removes the focused button, so focus moves to the next one, or to the hint once none are left.
  const refocus = useRef<number | null>(null);
  const [said, setSaid] = useState("");
  useEffect(() => {
    const i = refocus.current;
    if (i === null) return;
    refocus.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>("[data-unpin]") ?? [];
    (buttons[Math.min(i, buttons.length - 1)] ?? listRef.current?.querySelector<HTMLElement>("[data-pin-hint]"))?.focus();
  }, [f.pins]);
  return (
    <Section title="Your guides">
      <div ref={listRef}>
        {pinned.length === 0 ? (
          <p data-pin-hint tabIndex={-1} className="rounded-md text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Tap <Pin aria-hidden="true" className="inline size-3.5 align-[-2px]" />
            <span className="sr-only">the pin button</span> next to a guide below to see its picks on every contest. You can pin up to {MAX_PINS}.
          </p>
        ) : (
          <>
            <p id={countId} className="mb-2 text-sm text-muted-foreground">
              {pinned.length} of {MAX_PINS} pinned
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {pinned.map((g, i) => {
                const name = displayName(g, { short: true });
                return (
                  <li key={g.id} className="flex min-h-11 items-center gap-3 pr-1 pl-3 text-sm">
                    <Pin aria-hidden="true" className="size-4 shrink-0 fill-current" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/guides/${g.id}`} className="inline-block py-2.5 -my-2.5 underline decoration-foreground/30 underline-offset-[3px] hover:decoration-foreground">
                        {name}
                      </Link>
                      {!onBallot || onBallot.some((h) => h.id === g.id) ? null : <span className="text-muted-foreground"> · not on this ballot</span>}
                    </span>
                    <button
                      type="button"
                      data-unpin
                      aria-label={`Unpin ${name}`}
                      title="Unpin"
                      onClick={() => {
                        refocus.current = i;
                        // Cleared first, so unpinning the same guide twice is announced twice.
                        setSaid("");
                        requestAnimationFrame(() => setSaid(`Unpinned ${name}`));
                        onChange(togglePin(f, g.id));
                      }}
                      className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      </div>
    </Section>
  );
}

function PinButton({ filters: f, onChange, guide, countId }: { filters: Filters; onChange: (f: Filters) => void; guide: GuideInfo; countId?: string }) {
  const pinned = isPinned(f, guide.id);
  const full = !pinned && f.pins.length >= MAX_PINS;
  const name = displayName(guide, { short: true });
  return (
    <button
      type="button"
      aria-label={`Pin ${name}`}
      aria-pressed={pinned}
      aria-disabled={full || undefined}
      aria-describedby={full ? countId : undefined}
      title={pinned ? "Unpin" : full ? `You can pin up to ${MAX_PINS} guides` : "Pin to see its picks on every contest"}
      onClick={() => (full ? undefined : onChange(togglePin(f, guide.id)))}
      className={cn(
        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        pinned ? "text-foreground" : "text-muted-foreground",
        full && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
      )}
    >
      <Pin aria-hidden="true" className={cn("size-4", pinned && "fill-current")} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <p className="mt-6 mb-2 text-sm text-muted-foreground">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function GuideChecklist({ filters: f, onChange, guides, files, typeGuides, pinCountId }: Props & { pinCountId: string }) {
  const [query, setQuery] = useState("");
  const groups = guideGroups(guides, files, query);
  const searching = query.trim() !== "";
  return (
    <div role="group" aria-label="Guides">
      <p className="mt-6 mb-2 text-sm text-muted-foreground">Guides</p>
      <div className="relative">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides"
          aria-label="Search guides"
          className="h-10 pr-10"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute top-0 right-0 grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No guides match “{query.trim()}”.</p>
      ) : (
        <div className="mt-2 divide-y divide-border rounded-xl border border-border">
          {groups.map((g) => (
            <TypeGroup key={g.type} group={g} searching={searching} filters={f} onChange={onChange} guides={guides} typeGuides={typeGuides ?? guides} files={files} pinCountId={pinCountId} />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeGroup({
  group,
  searching,
  filters: f,
  onChange,
  guides,
  typeGuides,
  files,
  pinCountId,
}: { group: GuideGroup; searching: boolean; pinCountId: string } & Props & { typeGuides: FilterGuide[] }) {
  const [expanded, setExpanded] = useState(false);
  const state = typeState(group.type, f, guides);
  const open = searching || expanded;
  return (
    <Collapsible open={open} onOpenChange={setExpanded}>
      <div className="flex items-center gap-1 pr-1 pl-3">
        <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={state === "on"}
            indeterminate={state === "mixed"}
            onCheckedChange={() => onChange(setTypeGroup(f, group.type, typeGuides, state !== "on"))}
          />
          <span>{group.label}</span>
          <span className="ml-auto text-sm font-normal text-muted-foreground tabular-nums">{group.count}</span>
        </label>
        <CollapsibleTrigger
          aria-label={`Show ${group.heading}`}
          disabled={searching}
          className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
        >
          <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform duration-(--motion-in) ease-(--ease-out)", open && "rotate-180")} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="reveal">
        <ul className="pb-1">
          {group.guides.map((g) => (
            <li key={g.id} className="flex items-center pr-1">
              <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1 pr-2 pl-10 text-sm">
                <Checkbox checked={isGuideOn(f, g.id)} onCheckedChange={() => onChange(toggleGuide(f, g.id))} />
                <span title={g.name}>
                  {displayName(g, { short: true })}
                  {files[g.id].hasReasoning ? null : <span className="text-xs text-muted-foreground"> · list only</span>}
                </span>
              </label>
              <PinButton filters={f} onChange={onChange} guide={g} countId={pinCountId} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
