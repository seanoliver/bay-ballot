import Link from "next/link";
import type { AreaLink } from "@/lib/areas";
import { cn } from "@/lib/utils";

function Chip({ l }: { l: AreaLink }) {
  return (
    <Link
      href={l.href}
      prefetch={false}
      aria-current={l.current ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full px-3 ring-1 ring-foreground/15",
        l.current ? "bg-foreground font-medium text-background" : l.within ? "bg-muted font-medium hover:bg-muted/70" : "hover:bg-muted",
      )}
    >
      {l.label}
    </Link>
  );
}

export function AreaPicker({ links }: { links: AreaLink[] }) {
  const [bay, ...counties] = links;
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <Chip l={bay} />
      {counties.length ? (
        <>
          <span className="ml-1 text-xs text-muted-foreground">Counties</span>
          {counties.map((l) => <Chip key={l.href} l={l} />)}
        </>
      ) : null}
    </nav>
  );
}
