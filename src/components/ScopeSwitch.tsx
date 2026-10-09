"use client";

import type { ReactNode } from "react";
import { BAY_AREA } from "@/lib/areas";
import { bayLabel, type Scope } from "@/lib/fallback";
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

export function BayBlock({ id, count, inline = false, className, children }: { id: string; count: number; inline?: boolean; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className={cn("border-l-2 border-foreground/25 pl-3", inline && "flex items-center gap-3 pl-2.5", className)}>
      <p id={id} className={cn("text-xs font-medium text-muted-foreground", inline && "min-w-0 flex-1")}>
        {bayLabel(count)}
      </p>
      {children}
    </div>
  );
}
