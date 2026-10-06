"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
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
  toggleGuide,
  toggleTypeGroup,
  typeState,
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
          <span className="text-muted-foreground"> · {countedLabel(filterSummary(props.filters, props.guides, props.files))}</span>
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

function FilterControls({ filters: f, onChange, guides, files }: Props) {
  return (
    <>
      <Section title="Show">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox checked={f.whyOnly} onCheckedChange={(on) => onChange({ ...f, whyOnly: on === true })} />
          Only guides that explain their picks
        </label>
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
      <p className="mt-6 mb-2 text-sm text-muted-foreground">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function GuideChecklist({ filters: f, onChange, guides, files }: Props) {
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
            <li key={g.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 py-1 pr-3 pl-10 text-sm">
                <Checkbox checked={isGuideOn(f, g.id)} onCheckedChange={() => onChange(toggleGuide(f, g.id))} />
                <span title={g.name}>
                  {displayName(g, { short: true })}
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
