import { X } from "lucide-react";
import Link from "next/link";
import type { AreaLink } from "@/lib/areas";
import { BAY_AREA_SHAPE, COUNTY_SHAPES, type Shape } from "@/lib/county-shapes";
import { cn } from "@/lib/utils";

function Outline({ shape }: { shape?: Shape }) {
  if (!shape) return null;
  return (
    <svg viewBox={`-1 -1 ${shape.w + 2} ${shape.h + 2}`} className="size-5 shrink-0" aria-hidden="true">
      <path d={shape.d} fill="currentColor" fillOpacity={0.35} stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

/** The selected county links back to the Bay Area; its ✕ widens in when the page opens. */
function Chip({ l, shape, bayHref }: { l: AreaLink; shape?: Shape; bayHref?: string }) {
  const clears = l.current && bayHref !== undefined;
  return (
    <Link
      href={clears ? bayHref : l.href}
      prefetch={false}
      aria-current={l.current ? "page" : l.within ? "true" : undefined}
      aria-label={clears ? `Clear ${l.label}` : undefined}
      data-within={l.within || undefined}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full pr-3 pl-2.5 ring-1 ring-foreground/15",
        l.current ? cn("bg-foreground font-medium text-background", clears && "hover:bg-foreground/85") : l.within ? "font-medium ring-2 ring-foreground/50 hover:bg-muted" : "hover:bg-muted",
      )}
    >
      <Outline shape={shape} />
      {l.label}
      {clears ? (
        <span aria-hidden="true" className="chip-clear -mr-1 shrink-0">
          <span className="grid size-5 place-items-center rounded-full bg-background/20">
            <X className="size-3" strokeWidth={2.5} />
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export function AreaPicker({ links }: { links: AreaLink[] }) {
  const [bay, ...counties] = links;
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap gap-2 text-sm">
      <Chip l={bay} shape={BAY_AREA_SHAPE} />
      {counties.map((l) => (
        <Chip key={l.href} l={l} shape={COUNTY_SHAPES[l.label]} bayHref={bay.href} />
      ))}
    </nav>
  );
}
