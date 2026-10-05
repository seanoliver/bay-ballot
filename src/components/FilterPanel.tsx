"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  countedLabel,
  districtSelect,
  EMPTY,
  filterSummary,
  guideGroups,
  isGuideOn,
  setDistrict,
  toggleGuide,
  toggleTypeGroup,
  typeState,
  type Filters,
  type GuideGroup,
  type GuideInfo,
  type PickFile,
} from "@/lib/filters";
import type { Ballot } from "@/lib/schema";
import { cn } from "@/lib/utils";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
};

export function FilterPanel({ filters: f, onChange, ballot, guides, files }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <Button
            variant="outline"
            className="h-auto min-h-12 w-full justify-between rounded-xl px-3.5 py-2.5 text-[15px] font-normal whitespace-normal"
          />
        }
      >
        <span className="flex items-center gap-2 text-left">
          <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
          <span>
            <span className="font-semibold">Filters</span>
            <span className="text-muted-foreground"> · {countedLabel(filterSummary(f, guides, files))}</span>
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      {/* Capped and scrollable: a sticky panel taller than the screen would hide its own bottom. */}
      <CollapsibleContent className="max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain px-0.5 pb-1">
        <FilterControls filters={f} onChange={onChange} ballot={ballot} guides={guides} files={files} />
      </CollapsibleContent>
    </Collapsible>
  );
}

// The filter controls themselves, for placing outside the collapsible bar (a sidebar, sheet or popover).
// `districts={false}` leaves the district selects out for layouts that show them elsewhere.
export function FilterControls({
  filters: f,
  onChange,
  ballot,
  guides,
  files,
  query,
  onQueryChange,
  districts = true,
}: Props & { query?: string; onQueryChange?: (q: string) => void; districts?: boolean }) {
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
      <GuideChecklist filters={f} onChange={onChange} guides={guides} files={files} query={query} onQueryChange={onQueryChange} />
      {districts ? <DistrictSelects filters={f} onChange={onChange} ballot={ballot} /> : null}
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

// `query`/`onQueryChange` make the search controlled (e.g. driven by a search box elsewhere on the page).
export function GuideChecklist({
  filters: f,
  onChange,
  guides,
  files,
  query: controlled,
  onQueryChange,
}: Omit<Props, "ballot"> & { query?: string; onQueryChange?: (q: string) => void }) {
  const [own, setOwn] = useState("");
  const query = controlled ?? own;
  const setQuery = onQueryChange ?? setOwn;
  const groups = guideGroups(guides, files, query);
  const searching = query.trim() !== "";
  return (
    <div role="group" aria-label="Guides">
      <p className="mt-4 mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Guides</p>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search guides"
        aria-label="Search guides"
        className="h-10"
      />
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
}: { group: GuideGroup; searching: boolean } & Omit<Props, "ballot">) {
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

export function DistrictSelects({ filters: f, onChange, ballot }: Pick<Props, "filters" | "onChange" | "ballot">) {
  const selects = districtSelect(ballot);
  if (selects.length === 0) return null;
  return (
    <Section title="Districts">
      {selects.map(({ name, items }) => (
        <div key={name} className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{name}</span>
          <Select<string | null>
            items={items}
            value={f.districts[name] ?? null}
            onValueChange={(v) => onChange(setDistrict(f, name, v))}
          >
            <SelectTrigger aria-label={`${name} district`} className="h-10 min-w-36 data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((it) => (
                <SelectItem key={it.label} value={it.value} className="min-h-10">
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </Section>
  );
}
