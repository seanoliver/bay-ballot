import { displayName } from "@/lib/display";
import type { PinnedPick } from "@/lib/filters";
import { pinParts } from "@/lib/pins";
import type { Slots } from "@/lib/bar";
import { cn } from "@/lib/utils";
import { BAR_FILL } from "./tone";

/** Each pinned guide's pick on one contest, in the bar's colors. */
export function PinnedPicks({ picks, slots, className }: { picks: PinnedPick[]; slots: Slots; className?: string }) {
  if (picks.length === 0) return null;
  return (
    <ul aria-label="Your guides' picks" className={cn("flex flex-wrap gap-1.5", className)}>
      {picks.map((p) => (
        <li key={p.guide.id} className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 rounded-xl bg-background px-2.5 py-0.5 text-sm ring-1 ring-foreground/10">
          <span className="min-w-0 text-muted-foreground">
            {displayName(p.guide, { short: true })}
            <span className="sr-only">:</span>
          </span>
          {pinParts(p.entry, slots).map((part) => (
            <span key={part.key} className="inline-flex items-center gap-1 font-medium whitespace-nowrap">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", BAR_FILL[part.tone])} />
              {part.label}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
