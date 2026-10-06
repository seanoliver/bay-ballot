"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import {
  countedLabel,
  EMPTY,
  filterSummary,
  guideGroups,
  isGuideOn,
  toggleGuide,
  toggleTypeGroup,
  typeState,
  type Filters,
  type GuideGroup,
  type GuideInfo,
  type PickFile,
} from "@/lib/filters";
import { cn } from "@/lib/utils";
import { useHistorySheet } from "./useHistorySheet";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
};

// Desktop: always open in the left column, scrolling on its own.
export function FilterSidebar({ className, ...props }: Props & { className?: string }) {
  return (
    <aside aria-label="Filters" className={className}>
      <p className="text-sm font-semibold">
        Filters <span className="font-normal text-muted-foreground">· {countedLabel(filterSummary(props.filters, props.guides, props.files))}</span>
      </p>
      <FilterControls {...props} />
    </aside>
  );
}

// Phone: a Filters button that opens the controls in a bottom sheet.
export function FiltersSheet({ className, ...props }: Props & { className?: string }) {
  const [open, setOpen] = useHistorySheet();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-auto min-h-12 justify-start gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-normal whitespace-normal", className)}
          />
        }
      >
        <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
        <span className="text-left">
          <span className="font-semibold">Filters</span>
          <span className="text-muted-foreground"> · {countedLabel(filterSummary(props.filters, props.guides, props.files))}</span>
        </span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl">
        <SheetHeader className="pr-12 pb-0">
          <SheetTitle className="text-lg">Filters</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          <FilterControls {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterControls({ filters: f, onChange, guides, files }: Props) {
  return (
    <>
      <Section title="Show">
        <Toggle
          variant="outline"
          pressed={f.whyOnly}
          onPressedChange={(on) => onChange({ ...f, whyOnly: on })}
          className="h-auto min-h-10 rounded-full px-3.5 py-1.5 text-left text-sm font-normal whitespace-normal aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background hover:aria-pressed:bg-foreground/85 hover:aria-pressed:text-background"
        >
          {f.whyOnly ? <Check aria-hidden="true" className="size-3.5" /> : null}
          Only guides that explain their picks
        </Toggle>
      </Section>
      <GuideChecklist filters={f} onChange={onChange} guides={guides} files={files} />
      <Button variant="link" className="mt-3 h-10 px-0 text-sm underline" onClick={() => onChange(EMPTY)}>
        Reset filters
      </Button>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <p className="mt-4 mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function GuideChecklist({ filters: f, onChange, guides, files }: Props) {
  const [query, setQuery] = useState("");
  const groups = guideGroups(guides, files, query);
  const searching = query.trim() !== "";
  return (
    <div role="group" aria-label="Guides">
      <p className="mt-4 mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Guides</p>
      {/* Our own clear button: the native one is hidden (it ignores the theme in dark mode). */}
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
            <TypeGroup key={g.type} group={g} searching={searching} filters={f} onChange={onChange} guides={guides} files={files} />
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
  files,
}: { group: GuideGroup; searching: boolean } & Props) {
  const [expanded, setExpanded] = useState(false);
  const state = typeState(group.type, f, guides);
  // Searching expands every group that has a match; the chevron then has nothing to collapse.
  const open = searching || expanded;
  return (
    <Collapsible open={open} onOpenChange={setExpanded}>
      <div className="flex items-center gap-1 pr-1 pl-3">
        <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={state === "on"}
            indeterminate={state === "mixed"}
            onCheckedChange={() => onChange(toggleTypeGroup(f, group.type, guides))}
          />
          {group.heading}
        </label>
        <CollapsibleTrigger
          aria-label={`Show ${group.heading}`}
          disabled={searching}
          className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
        >
          <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ul className="pb-1">
          {group.guides.map((g) => (
            <li key={g.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 py-1 pr-3 pl-10 text-sm">
                <Checkbox checked={isGuideOn(f, g.id)} onCheckedChange={() => onChange(toggleGuide(f, g.id))} />
                <span>
                  {g.name}
                  {files[g.id].hasReasoning ? null : <span className="text-xs text-muted-foreground"> · list only</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
