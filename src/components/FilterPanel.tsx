"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  countedLabel,
  districtOptions,
  EMPTY,
  filterSummary,
  guideTypeOptions,
  isGuideOn,
  publishedGuides,
  toggleGuide,
  toggleType,
  type Filters,
} from "@/lib/filters";
import type { Ballot, EndorsementFile, Guide } from "@/lib/schema";
import { cn } from "@/lib/utils";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  ballot: Ballot;
  guides: Guide[];
  endorsements: Record<string, EndorsementFile>;
};

export function FilterPanel({ filters: f, onChange, ballot, guides, endorsements }: Props) {
  const [open, setOpen] = useState(false);
  const published = publishedGuides(guides, endorsements);
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
            <span className="text-muted-foreground"> · {countedLabel(filterSummary(f, guides, endorsements))}</span>
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      {/* Capped and scrollable: a sticky panel taller than the screen would hide its own bottom. */}
      <CollapsibleContent className="max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain pb-1">
        <Group title="Show">
          <Pill pressed={f.whyOnly} onPressedChange={(on) => onChange({ ...f, whyOnly: on })}>
            Only guides that explain their picks
          </Pill>
        </Group>
        <Group title="Guide types">
          {guideTypeOptions(guides, endorsements).map((t) => (
            <Pill key={t.type} pressed={!f.offTypes.includes(t.type)} onPressedChange={() => onChange(toggleType(f, t.type, guides))}>
              {t.label}
            </Pill>
          ))}
        </Group>
        <Group title="Guides">
          {published.map((g) => (
            <Pill key={g.id} pressed={isGuideOn(f, g)} onPressedChange={() => onChange(toggleGuide(f, g, guides))}>
              {g.name}
              {endorsements[g.id].hasReasoning ? null : <span className="text-xs opacity-70">list only</span>}
            </Pill>
          ))}
        </Group>
        <DistrictSelects filters={f} onChange={onChange} ballot={ballot} />
        <Button variant="link" className="mt-3 h-10 px-0 text-sm underline" onClick={() => onChange(EMPTY)}>
          Reset filters
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <p className="mt-4 mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Toggle
      variant="outline"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="h-auto min-h-10 rounded-full px-3.5 py-1.5 text-left text-sm font-normal whitespace-normal aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background hover:aria-pressed:bg-foreground/85 hover:aria-pressed:text-background"
    >
      {pressed ? <Check aria-hidden="true" className="size-3.5" /> : null}
      {children}
    </Toggle>
  );
}

function DistrictSelects({ filters: f, onChange, ballot }: Pick<Props, "filters" | "onChange" | "ballot">) {
  const options = Object.entries(districtOptions(ballot));
  if (options.length === 0) return null;
  return (
    <Group title="Districts">
      {options.map(([name, ds]) => {
        const items = [{ value: null, label: "All" }, ...ds.map((d) => ({ value: d, label: `District ${d}` }))];
        return (
          <div key={name} className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{name}</span>
            <Select<string | null>
              items={items}
              value={f.districts[name] ?? null}
              onValueChange={(v) => {
                const districts = { ...f.districts };
                if (v === null) delete districts[name];
                else districts[name] = v;
                onChange({ ...f, districts });
              }}
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
        );
      })}
    </Group>
  );
}
