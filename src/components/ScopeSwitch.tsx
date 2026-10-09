"use client";

import { useRef, type ReactNode } from "react";
import { BAY_AREA } from "@/lib/areas";
import { bayHeading, type Scope } from "@/lib/fallback";
import { cn } from "@/lib/utils";

const SCOPES: Scope[] = ["area", "bay"];

export function ScopeSwitch({ place, scope, onChange, className }: { place: string; scope: Scope; onChange: (s: Scope) => void; className?: string }) {
  return (
    <div role="group" aria-label="Show guides from" className={cn("js-only inline-flex shrink-0 rounded-full bg-muted p-0.5 ring-1 ring-border", className)}>
      {SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={scope === s}
          onClick={() => onChange(s)}
          className={cn(
            "min-h-9 rounded-full px-3 text-xs font-medium text-muted-foreground outline-none transition-[background-color,color] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-7",
            scope === s && "bg-background text-foreground shadow-sm ring-1 ring-foreground/10 dark:bg-card",
          )}
        >
          {s === "area" ? place : BAY_AREA.name}
        </button>
      ))}
    </div>
  );
}

export function BayBlock({
  id,
  title,
  shown,
  total,
  onReveal,
  inline = false,
  className,
  children,
}: {
  id: string;
  title: string;
  shown: number;
  total: number;
  onReveal: () => void;
  inline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { label, hidden } = bayHeading(shown, total);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-labelledby={id} className={cn("outline-none border-l-2 border-foreground/25 pl-3", inline && "flex items-center gap-3 pl-2.5", className)}>
      <p aria-live="polite" className={cn("text-xs text-muted-foreground", inline && "min-w-0 flex-1")}>
        <span id={id} className="font-medium">
          {label}
        </span>
        {hidden ? ` · ${hidden}` : null}
        {shown < total ? (
          <>
            {" · "}
            <button
              type="button"
              aria-label={`Show all Bay Area guides on ${title}`}
              onClick={() => {
                // Show unmounts itself once nothing is hidden, so move focus to the block first.
                ref.current?.focus();
                onReveal();
              }}
              className="relative z-10 -my-2.5 inline-block py-2.5 underline underline-offset-2 hover:text-foreground"
            >
              Show
            </button>
          </>
        ) : null}
      </p>
      {shown > 0 ? children : null}
    </div>
  );
}
