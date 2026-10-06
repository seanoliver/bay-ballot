import Link from "next/link";
import type { AreaLink } from "@/lib/areas";
import { cn } from "@/lib/utils";

export function AreaPicker({ links }: { links: AreaLink[] }) {
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full px-3 ring-1 ring-foreground/15",
            l.current ? "bg-foreground font-medium text-background" : "hover:bg-muted",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
