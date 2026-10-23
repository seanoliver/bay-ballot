"use client";

import { useId, useState } from "react";
import type { BarTone } from "@/lib/bar";
import type { PinPart } from "@/lib/pins";
import { cn } from "@/lib/utils";
import { CarriedLink } from "./CarriedLink";
import { QUOTE_MARK } from "./ContestPins";
import { ExternalLink } from "./ExternalLink";
import { ROW_FOCUS, ROW_LINK } from "./row";
import { BAR_FILL, BORDER } from "./tone";

export type RowQuote = { text: string; href: string };

export function GuidePickRow({ href, title, label, parts, quotes }: { href: string; title: string; label: string; parts: PinPart[]; quotes: RowQuote[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone: BarTone = parts[0]?.tone ?? "other";
  return (
    <li>
      <div className={cn("relative flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-[background-color] hover:bg-muted/60", ROW_FOCUS)}>
        <CarriedLink href={href} aria-label={label} className={cn("min-w-0 font-medium", ROW_LINK)}>
          {title}
        </CarriedLink>
        <span className="ml-auto flex items-center gap-3">
          {quotes.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${quotes.length === 1 ? "1 reason" : `${quotes.length} reasons`} for ${title}`}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "relative z-10 inline-flex h-8 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 transition-colors",
                open ? "bg-foreground text-background ring-foreground" : "bg-muted text-foreground/80 ring-border hover:bg-background",
              )}
            >
              {QUOTE_MARK}
              {quotes.length}
            </button>
          ) : null}
          <span aria-hidden="true" className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-sm">
            {parts.map((part) => (
              <span key={part.key} className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
                <span className={cn("size-2.5 shrink-0 rounded-[3px]", BAR_FILL[part.tone])} />
                {part.label}
              </span>
            ))}
          </span>
        </span>
      </div>
      {quotes.length > 0 ? (
        <ul id={panelId} hidden={!open} className="space-y-3 px-4 pb-4">
          {quotes.map((q, i) => (
            <li key={i} className={cn("border-l-2 pl-3", BORDER[tone])}>
              <blockquote className="measure">
                <span className="-ml-[0.45ch]">“</span>
                {q.text}”
              </blockquote>
              <ExternalLink href={q.href} className="inline-block py-1 text-sm text-muted-foreground underline underline-offset-2">
                Source
              </ExternalLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
