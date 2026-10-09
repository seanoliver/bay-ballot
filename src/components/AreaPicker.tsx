import Link from "next/link";
import type { AreaLink } from "@/lib/areas";
import { cn } from "@/lib/utils";

function Chip({ l }: { l: AreaLink }) {
  return (
    <Link
      href={l.href}
      prefetch={false}
      aria-current={l.current ? "page" : l.within ? "true" : undefined}
      data-within={l.within || undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full px-3 ring-1 ring-foreground/15",
        l.current ? "bg-foreground font-medium text-background" : l.within ? "font-medium ring-2 ring-foreground/50 hover:bg-muted" : "hover:bg-muted",
      )}
    >
      {l.label}
    </Link>
  );
}

export function AreaPicker({ links }: { links: AreaLink[] }) {
  const [bay, first, ...rest] = links;
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <Chip l={bay} />
      {first ? (
        <span className="inline-flex items-center gap-2">
          <span className="ml-1 text-xs text-muted-foreground">Counties</span>
          <Chip l={first} />
        </span>
      ) : null}
      {rest.map((l) => <Chip key={l.href} l={l} />)}
    </nav>
  );
}
