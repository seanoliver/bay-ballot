"use client";

import { useState, type ReactNode } from "react";
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

function FilterControls({ filters: f, onChange, guides, files, typeGuides }: Props) {
  return (
    <>
      <PinnedGuides filters={f} onChange={onChange} guides={typeGuides ?? guides} />
      <Section title="Show">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={f.whyOnly} onCheckedChange={(on) => onChange({ ...f, whyOnly: on === true })} />
          Only guides that explain their endorsements
        </label>
      </Section>
      <GuideChecklist filters={f} onChange={onChange} guides={guides} files={files} typeGuides={typeGuides} />
      {/* Pins aren't a filter: resetting what's counted keeps them. */}
      <Button variant="link" className="mt-3 h-10 px-0 text-sm underline" onClick={() => onChange({ ...EMPTY, pins: f.pins })}>
        Reset filters
      </Button>
    </>
  );
}

function PinnedGuides({ filters: f, onChange, guides }: { filters: Filters; onChange: (f: Filters) => void; guides: GuideInfo[] }) {
  const pinned = f.pins.map((id) => guides.find((g) => g.id === id)).filter((g) => g !== undefined);
  return (
    <Section title="Your guides">
      {pinned.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pin up to {MAX_PINS} guides below to see their picks on every contest.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pinned.map((g) => (
            <li key={g.id} className="flex min-h-11 items-center gap-3 pr-1 pl-3 text-sm">
              <Pin aria-hidden="true" className="size-4 shrink-0 fill-current" />
              <span className="min-w-0 flex-1 truncate" title={g.name}>
                {displayName(g, { short: true })}
              </span>
              <button
                type="button"
                aria-label={`Unpin ${displayName(g, { short: true })}`}
                onClick={() => onChange(togglePin(f, g.id))}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PinButton({ filters: f, onChange, guide }: { filters: Filters; onChange: (f: Filters) => void; guide: GuideInfo }) {
  const pinned = isPinned(f, guide.id);
  const full = !pinned && f.pins.length >= MAX_PINS;
  const name = displayName(guide, { short: true });
  return (
    <button
      type="button"
      aria-label={`Pin ${name}`}
      aria-pressed={pinned}
      aria-disabled={full || undefined}
      title={full ? `Unpin a guide first: up to ${MAX_PINS} can be pinned` : undefined}
      onClick={() => (full ? undefined : onChange(togglePin(f, guide.id)))}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        pinned ? "text-foreground" : "text-muted-foreground",
        full && "cursor-not-allowed opacity-40 hover:bg-transparent",
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

function GuideChecklist({ filters: f, onChange, guides, files, typeGuides }: Props) {
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
            <TypeGroup key={g.type} group={g} searching={searching} filters={f} onChange={onChange} guides={guides} typeGuides={typeGuides ?? guides} files={files} />
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
}: { group: GuideGroup; searching: boolean } & Props & { typeGuides: FilterGuide[] }) {
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
              <PinButton filters={f} onChange={onChange} guide={g} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
