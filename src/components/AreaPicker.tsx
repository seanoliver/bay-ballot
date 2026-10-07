import Link from "next/link";
import { useId } from "react";
import type { AreaLink, AreaMenu } from "@/lib/areas";
import { cn } from "@/lib/utils";

function Pill({ link, id }: { link: AreaLink; id?: string }) {
  return (
    <Link
      id={id}
      href={link.href}
      prefetch={false}
      aria-current={link.current ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full px-3 ring-1 ring-foreground/15",
        link.current ? "bg-foreground font-medium text-background" : "bg-background hover:bg-muted",
      )}
    >
      {link.label}
    </Link>
  );
}

export function AreaPicker({ menu }: { menu: AreaMenu }) {
  const id = useId();
  return (
    <nav aria-label="Area" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <Pill link={menu.bayArea} />
      {menu.groups.map((g, i) =>
        g.page && g.cities.length === 0 ? (
          <Pill key={g.county} link={g.page} />
        ) : (
          <div
            key={g.county}
            role="group"
            aria-labelledby={`${id}-${i}`}
            className="inline-flex flex-wrap items-center gap-1 rounded-3xl bg-muted/60 p-1 ring-1 ring-foreground/10"
          >
            {g.page ? (
              <Pill link={g.page} id={`${id}-${i}`} />
            ) : (
              <span id={`${id}-${i}`} className="px-2 text-muted-foreground">
                {g.label}
              </span>
            )}
            {g.cities.map((l) => (
              <Pill key={l.href} link={l} />
            ))}
          </div>
        ),
      )}
    </nav>
  );
}
