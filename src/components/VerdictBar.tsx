import type { ReactNode } from "react";
import { barSegments, barShort, barSummary, type BarSegment, type BarTone } from "@/lib/bar";
import { contestHeadline } from "@/lib/display";
import type { Row } from "@/lib/filters";
import { tally } from "@/lib/score";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { RankedPopover } from "./ContestCard";

const FILL: Record<BarTone, string> = {
  yes: "bg-yes",
  no: "bg-no",
  c1: "bg-bar-1",
  c2: "bg-bar-2",
  c3: "bg-bar-3",
  c4: "bg-bar-4",
  empty: "bg-muted ring-1 ring-inset ring-border",
};

const TEXT: Partial<Record<BarTone, string>> = { yes: "text-yes", no: "text-no" };

type Props = {
  contest: Contest;
  rows: Row[];
  // "full": bar plus legend/caption. "inline": a short bar and a few words, for one-line rows.
  variant?: "full" | "inline";
  className?: string;
};

// A contest's result at a glance. The math lives in lib/bar; this only draws it.
export function VerdictBar({ contest, rows, variant = "full", className }: Props) {
  const t = tally(contest, rows.map((r) => r.entry));
  const segments = barSegments(t, contest);
  const summary = barSummary(t, contest);
  const multi = t.kind === "candidate" && contest.seats > 1 && segments[0]?.tone !== "empty";

  if (variant === "inline") {
    return (
      <div className={cn("flex w-28 shrink-0 flex-col items-end gap-1", className)}>
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
        <span className={cn("max-w-full truncate text-xs font-medium", lead(segments))}>{barShort(t, contest)}</span>
      </div>
    );
  }

  const { headline } = contestHeadline(contest, rows);
  // Clicks inside the popover (portaled, but React events still bubble) must not toggle the row around it.
  const ranked = headline.ranked ? (
    <span className="relative z-10" onClick={(e) => e.stopPropagation()}>
      <RankedPopover rows={rows} />
    </span>
  ) : null;

  if (multi) {
    return (
      <div className={cn("mt-2", className)}>
        <ul role="img" aria-label={summary.aria} className="space-y-1">
          {segments.map((s) => (
            <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_2.5rem] items-center gap-2 text-sm">
              <span className="truncate">{s.label}</span>
              <Track className="h-2">
                <span className={FILL[s.tone]} style={{ width: `${s.pct}%` }} />
              </Track>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {s.count}/{t.total}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">Top {contest.seats} · {summary.caption}</p>
      </div>
    );
  }

  return (
    <div className={cn("mt-2", className)}>
      <Stack segments={segments} aria={summary.aria} className="h-2.5" />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
        {segments[0].tone === "empty" ? (
          <span className="text-muted-foreground">No picks yet</span>
        ) : t.kind === "measure" ? (
          <>
            {t.verdict === "split" ? (
              <span className="font-semibold text-split">{summary.caption}</span>
            ) : (
              <>
                {segments.map((s) => (
                  <span key={s.key} className={cn("tabular-nums", TEXT[s.tone], s === segments[0] && "font-semibold")}>
                    {s.label}
                  </span>
                ))}
                <span className="text-muted-foreground">{summary.caption}</span>
              </>
            )}
          </>
        ) : (
          <>
            {segments.map((s, i) => (
              <span key={s.key} className={cn("inline-flex min-w-0 items-center gap-1.5", i === 0 && "font-semibold")}>
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", FILL[s.tone])} />
                <span className="truncate">{s.label}</span>
                <span className="font-normal text-muted-foreground tabular-nums">{s.count}</span>
                {i === 0 ? ranked : null}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function lead(segments: BarSegment[]): string {
  const s = segments[0];
  if (segments.length === 2 && s.pct === 50 && (s.tone === "yes" || s.tone === "no")) return "text-split";
  return TEXT[s.tone] ?? (s.tone === "empty" ? "text-muted-foreground" : "");
}

function Track({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("flex w-full overflow-hidden rounded-full bg-muted", className)}>{children}</span>;
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
