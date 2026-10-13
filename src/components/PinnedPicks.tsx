import { slotTone, surname, type BarTone, type Slots } from "@/lib/bar";
import { displayName } from "@/lib/display";
import type { PinnedPick } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { BAR_FILL } from "./tone";

type Part = { label: string; tone: BarTone };

function parts({ entry }: PinnedPick, slots: Slots): Part[] {
  if (entry.pick === "Y") return [{ label: "Yes", tone: "yes" }];
  if (entry.pick === "N") return [{ label: "No", tone: "no" }];
  return entry.pick.map((name, i) => ({ label: entry.ranked ? `${i + 1}. ${surname(name)}` : surname(name), tone: slotTone(slots, name) }));
}

/** Each pinned guide's pick on one contest, in the bar's colors. */
export function PinnedPicks({ picks, slots, className }: { picks: PinnedPick[]; slots: Slots; className?: string }) {
  if (picks.length === 0) return null;
  return (
    <ul aria-label="Your pinned guides" className={cn("flex flex-wrap gap-1.5", className)}>
      {picks.map((p) => (
        <li key={p.guide.id} className="inline-flex min-h-7 max-w-full items-center gap-x-1.5 rounded-full bg-muted px-2.5 py-0.5 text-sm">
          <span className="truncate text-muted-foreground" title={p.guide.name}>
            {displayName(p.guide, { short: true })}
          </span>
          {parts(p, slots).map((part) => (
            <span key={part.label} className="inline-flex items-center gap-1 font-medium whitespace-nowrap">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", BAR_FILL[part.tone])} />
              {part.label}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
