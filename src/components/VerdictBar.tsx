"use client";

import type { ReactNode } from "react";
import { barLegend, barSegments, barShortParts, barSummary, winnerTone, type BarSegment, type BarTone, type Slots } from "@/lib/bar";
import { contestHeadline, rankedDetails, rankedText } from "@/lib/display";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { Row } from "@/lib/filters";
import { tally, type Tally } from "@/lib/score";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { BAR_FILL } from "./tone";

const FILL = BAR_FILL;

// Verdict color on text: only the measure lead wears it.
const LEAD_TEXT: Partial<Record<BarTone | "split", string>> = { yes: "text-yes", no: "text-no", split: "text-split" };

type Props = {
  contest: Contest;
  rows: Row[];
  // "full": bar plus legend/caption. "inline": a short bar and a few words, for one-line rows.
  variant?: "full" | "inline";
  // Candidate colors from unfiltered data (candidateSlots), so filters never repaint a candidate.
  slots?: Slots;
  // false where a headline above already states the guide count (the contest detail).
  count?: boolean;
  // "detail": the primary chart, a step thicker than the list bars.
  size?: "list" | "detail";
  // false: the bar alone (the contest detail draws its own legend).
  legend?: boolean;
  className?: string;
};

// A contest's result at a glance. The math lives in lib/bar; this only draws it.
export function VerdictBar({ contest, rows, variant = "full", slots, count = true, size = "list", legend: showLegend = true, className }: Props) {
  const t = tally(contest, rows.map((r) => r.entry));
  const segments = barSegments(t, contest, slots);
  const summary = barSummary(t, contest);
  const legend = barLegend(t, contest, slots);
  const short = barShortParts(t, contest);
  const multi = t.kind === "candidate" && contest.seats > 1 && segments[0]?.tone !== "empty";

  const { headline } = contestHeadline(contest, rows);
  // The ranked "*" sits above a row's full-row link overlay; its clicks must not reach the row.
  const ranked = headline.ranked ? (
    <span className="relative z-10" onClick={(e) => e.stopPropagation()}>
      <RankedPopover rows={rows} />
    </span>
  ) : null;

  if (variant === "inline") {
    return (
      <div className={cn("flex w-24 shrink-0 flex-col items-end gap-1", className)}>
        {multi ? (
          <div role="img" aria-label={summary.aria} className="flex w-full flex-col gap-0.5">
            {segments.map((s) => (
              <Track key={s.key} className="h-1">
                <span className={FILL[s.tone]} style={{ width: `${s.pct}%` }} />
              </Track>
            ))}
          </div>
        ) : (
          <Stack segments={segments} aria={summary.aria} className="h-2" />
        )}
        {/* The name may truncate; the number never does. The "*" keeps its tap area without taking width. */}
        <span className={cn("flex max-w-full items-baseline text-sm font-medium", lead(t, segments))}>
          <span className="truncate">{short.label}</span>
          {short.value ? <span className="shrink-0 tabular-nums">&nbsp;{short.value}</span> : null}
          {ranked ? <span className="-my-2.5 -mr-2.5 shrink-0">{ranked}</span> : null}
        </span>
      </div>
    );
  }

  if (multi) {
    return (
      <div className={cn("mt-2", className)}>
        <ul role="img" aria-label={summary.aria} className="space-y-1">
          {segments.map((s) => (
            <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_3.5rem] items-center gap-2 text-sm">
              <span className="truncate">{s.label}</span>
              <Track className="h-2">
                <span className={FILL[s.tone]} style={{ width: `${s.pct}%` }} />
              </Track>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {s.count} of {t.total}
              </span>
            </li>
          ))}
        </ul>
        {count ? <p className="mt-2 text-sm text-muted-foreground">Top {contest.seats} · {legend.caption}</p> : null}
      </div>
    );
  }

  if (!showLegend) {
    return (
      <div className={cn("mt-2", className)}>
        <Stack segments={segments} aria={summary.aria} className={size === "detail" ? "h-3" : "h-2"} />
      </div>
    );
  }

  return (
    <div className={cn("mt-2", className)}>
      <Stack segments={segments} aria={summary.aria} className={size === "detail" ? "h-3" : "h-2"} />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {legend.lead ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
            {t.kind === "candidate" ? <Swatch tone={legend.lead.tone} /> : null}
            <span className={cn("truncate", t.kind === "measure" && LEAD_TEXT[legend.lead.tone])}>
              {legend.lead.label}
              {legend.lead.value ? ` ${legend.lead.value}` : null}
            </span>
            {ranked}
          </span>
        ) : null}
        {legend.others.map((o) => (
          <span key={o.key} className="inline-flex min-w-0 items-center gap-1.5">
            <Swatch tone={o.tone} />
            <span className="truncate">{o.label}</span>
            <span className="text-muted-foreground">{o.value}</span>
          </span>
        ))}
        {count || !legend.lead ? <span className="text-muted-foreground">{legend.caption}</span> : null}
      </div>
    </div>
  );
}

export function Swatch({ tone }: { tone: BarTone | "split" }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone === "split" ? "bg-split" : FILL[tone])} />;
}

// Inline label color: a measure wears its winner's color; candidates stay foreground.
function lead(t: Tally, segments: BarSegment[]): string {
  const win = winnerTone(t);
  if (win) return LEAD_TEXT[win] ?? "";
  return segments[0].tone === "empty" ? "text-muted-foreground" : "";
}

function Track({ className, children }: { className?: string; children: ReactNode }) {
  // The empty track needs ink to show on a white card; dark mode's muted already contrasts.
  return <span className={cn("flex w-full overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-muted", className)}>{children}</span>;
}

function Stack({ segments, aria, className }: { segments: BarSegment[]; aria: string; className?: string }) {
  return (
    <div role="img" aria-label={aria} className={cn("flex w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {segments.map((s) => (
        <span key={s.key} className={cn("min-w-1 first:rounded-l-full last:rounded-r-full", FILL[s.tone])} style={{ flex: `${s.pct} 1 0` }} />
      ))}
    </div>
  );
}

export function RankedPopover({ rows }: { rows: Row[] }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Includes ranked endorsements — show order"
        className="relative z-10 -mx-2.5 -my-2 grid size-10 place-items-center rounded-full text-lg font-bold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        *
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverTitle>Ranked-choice order</PopoverTitle>
        <ul className="space-y-2">
          {rankedDetails(rows).map((r) => (
            <li key={r.guideName}>
              <p className="font-medium" title={r.guideName}>
                {r.short}
              </p>
              <p className="text-muted-foreground">{rankedText(r)}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
