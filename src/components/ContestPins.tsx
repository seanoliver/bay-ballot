"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import Link from "next/link";
import { ChevronDown, Funnel, Pin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { countedNoPick, isCountingOnly, pinMessage, toggleCountOnly, type NoPickGuide } from "@/lib/contest-pins";
import type { Side } from "@/lib/detail";
import { displayName } from "@/lib/display";
import { isPinned, MAX_PINS, togglePin, type Filters, type GuideInfo, type PickFile } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** What a contest's sides need to pin guides and count only one side. */
export type Pinning = {
  filters: Filters;
  status: string;
  noPick: GuideInfo[];
  onPin: (id: string) => void;
  onCountOnly: (side: Side) => void;
  counting: (side: Side) => boolean;
};

/** Pinning plus what belongs to one rendered contest detail: the panel and the phone sheet can both be in the page. */
export type PinControls = Pinning & { limitId: string; onCountPress: (key: string) => void };

export type ChipGuide = { id: string; name: string; short: string; quoted: boolean };

const STATUS_MS = 4000;
const CHIPS_SHOWN = 12;
const guidesLabel = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

export function useContestPins({
  filters: f,
  onChange,
  guides,
  files,
  noPick,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  guides: GuideInfo[];
  /** Covering every guide a side can list, to tell whether `only` is that side's. */
  files: Record<string, PickFile>;
  noPick: NoPickGuide[];
}): Pinning {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frame = useRef(0);
  const say = useCallback((s: string) => {
    // Cleared first, so the same message twice is announced twice.
    setStatus("");
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setStatus(s));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), STATUS_MS);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  const counted = useMemo(() => countedNoPick(f, noPick, guides), [f, noPick, guides]);
  const ids = (side: Side) => side.guides.map((g) => g.id);

  return {
    filters: f,
    status,
    noPick: counted,
    onPin: (id) => {
      const guide = guides.find((g) => g.id === id);
      if (!guide) return;
      say(pinMessage(f, guide));
      // At the limit nothing changes; the message says why.
      const next = togglePin(f, id);
      if (next !== f) onChange(next);
    },
    counting: (side) => isCountingOnly(f, ids(side), files),
    onCountOnly: (side) => {
      const stop = isCountingOnly(f, ids(side), files);
      onChange(toggleCountOnly(f, ids(side), files));
      say(stop ? `Stopped counting only the guides for ${side.label}` : `Counting only the ${guidesLabel(side.count)} for ${side.label}`);
    },
  };
}

/** A pin toggle or a Count only change, said aloud everywhere and shown as a toast on phones, where the Filters panel is out of sight.
 * Rendered inside each contest detail so it stays reachable inside the phone sheet, which hides the rest of the page. */
export function PinStatus({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 rounded-xl bg-foreground px-4 py-3.5 text-sm text-background shadow-lg empty:opacity-0 lg:sr-only"
    >
      {message}
    </p>
  );
}

export function PinHint({ pinning }: { pinning: PinControls }) {
  const n = pinning.filters.pins.length;
  return (
    <p id={pinning.limitId} className="text-sm text-muted-foreground">
      {n >= MAX_PINS
        ? `${n} of ${MAX_PINS} pinned. Unpin one to pin another.`
        : `Pin a guide to see its picks on every contest. ${n} of ${MAX_PINS} pinned.`}
    </p>
  );
}

const QUOTE_MARK = (
  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 fill-current">
    <path d="M1 7.2C1 4.6 2.4 2.8 4.6 2l.5.9C3.8 3.6 3.2 4.5 3.1 5.6h1.7V10H1V7.2Zm6 0C7 4.6 8.4 2.8 10.6 2l.5.9c-1.3.7-1.9 1.6-2 2.7h1.7V10H7V7.2Z" />
  </svg>
);

// The whole pill pins its guide and fills in once pinned. Guide pages are linked from the list under the chips.
function PinChip({ guide, short, pinning, style, className }: { guide: ChipGuide; short: boolean; pinning: PinControls; style?: CSSProperties; className?: string }) {
  const f = pinning.filters;
  const pinned = isPinned(f, guide.id);
  const full = !pinned && f.pins.length >= MAX_PINS;
  const name = short ? guide.short : guide.name;
  return (
    <li style={style} className={className}>
      <button
        type="button"
        aria-pressed={pinned}
        aria-disabled={full || undefined}
        aria-describedby={full ? pinning.limitId : undefined}
        title={guide.quoted || guide.name === name ? undefined : guide.name}
        onClick={() => pinning.onPin(guide.id)}
        onPointerEnter={guide.quoted ? alignTip : undefined}
        onFocus={guide.quoted ? alignTip : undefined}
        className={cn(
          "group relative inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border pr-3 pl-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-9",
          pinned
            ? "border-foreground bg-foreground font-semibold text-background"
            : "border-foreground/20 bg-background shadow-xs hover:border-foreground hover:bg-muted",
          full && "cursor-not-allowed border-dashed text-muted-foreground shadow-none hover:border-foreground/20 hover:bg-background",
        )}
      >
        <Pin aria-hidden="true" className={cn("size-3.5 shrink-0", pinned ? "fill-current" : "text-muted-foreground", full && "opacity-60")} />
        <span className="sr-only">Pin </span>
        {name}
        {guide.quoted ? (
          <>
            {QUOTE_MARK}
            <span className="sr-only">(gave reasons)</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-full left-0 z-20 mt-2 hidden w-max max-w-56 rounded-lg bg-foreground px-2.5 py-2 text-left text-[13px] leading-snug font-normal text-background shadow-md group-data-[tip-end=true]:right-0 group-data-[tip-end=true]:left-auto lg:group-focus-visible:block lg:pointer-fine:group-hover:block"
            >
              <b className="font-semibold">{guide.name}</b>. Gave reasons on this contest.
            </span>
          </>
        ) : null}
      </button>
    </li>
  );
}

// A chip in the right half of its row opens its tooltip leftward, so it stays inside the panel.
function alignTip(e: SyntheticEvent<HTMLButtonElement>) {
  const b = e.currentTarget;
  const row = b.closest("ul");
  if (row) b.dataset.tipEnd = String(b.getBoundingClientRect().left - row.getBoundingClientRect().left > row.clientWidth / 2);
}

/** The first dozen chips, then "Show all N" opens the rest in place. A legend explains the quote mark when a chip has one. */
export function PinChips({ guides, short, pinning, label, side }: { guides: ChipGuide[]; short: boolean; pinning: PinControls; label: string; side: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? guides : guides.slice(0, CHIPS_SHOWN);
  return (
    <>
      {guides.some((g) => g.quoted) ? (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="text-foreground">{QUOTE_MARK}</span>
          <span>
            <span className="sr-only">A quote mark </span>means the guide explained its pick. Read its reasons below.
          </span>
        </p>
      ) : null}
      <div role="group" aria-label={label}>
        <ul className="flex flex-wrap gap-2">
          {shown.map((g, i) => (
            <PinChip
              key={g.id}
              guide={g}
              short={short}
              pinning={pinning}
              className={i >= CHIPS_SHOWN ? "reveal-item" : undefined}
              style={i >= CHIPS_SHOWN ? ({ "--i": i - CHIPS_SHOWN } as CSSProperties) : undefined}
            />
          ))}
        </ul>
        {guides.length > CHIPS_SHOWN ? (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll(!all)}
            className="mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
          >
            {all ? "Show fewer" : `Show all ${guides.length}`}
          </button>
        ) : null}
      </div>
      <GuidePages guides={guides} short={short} side={side} />
    </>
  );
}

/** Plain links to each chip's guide page, in the chips' order: a dozen, then "and N more" shows the rest. */
function GuidePages({ guides, short, side }: { guides: ChipGuide[]; short: boolean; side: string }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? guides : guides.slice(0, CHIPS_SHOWN);
  const more = guides.length - shown.length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="text-sm">
      <CollapsibleTrigger className="-my-1 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8">
        Guide pages<span className="sr-only"> for {side}</span>
        <ChevronDown aria-hidden="true" className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="reveal">
        <div className="pt-1 leading-loose text-muted-foreground">
          <ul aria-label={`Guide pages for ${side}`} className="inline">
            {shown.map((g, i) => (
              <li key={g.id} className="inline">
                <Link href={`/guides/${g.id}`} className="text-foreground underline decoration-foreground/30 underline-offset-[3px] hover:decoration-foreground">
                  {short ? g.short : g.name}
                </Link>
                {i < shown.length - 1 ? ", " : more ? ", " : null}
              </li>
            ))}
          </ul>
          {more ? (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="cursor-pointer rounded-md underline underline-offset-[3px] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              and {more} more
            </button>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CountOnlyButton({ side, pinning, className }: { side: Side; pinning: PinControls; className?: string }) {
  const on = pinning.counting(side);
  return (
    <button
      type="button"
      data-count-only={side.key}
      aria-pressed={on}
      title={on ? "Count the guides you counted before" : "Count only these guides on every contest"}
      onClick={() => {
        pinning.onCountPress(side.key);
        pinning.onCountOnly(side);
      }}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8",
        on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted",
        className,
      )}
    >
      <Funnel aria-hidden="true" className="size-3.5 shrink-0" />
      Count only these {side.count} on the ballot
    </button>
  );
}

export function NoPickBlock({ pinning, short }: { pinning: PinControls; short: boolean }) {
  const guides = pinning.noPick;
  if (!guides.length) return null;
  return (
    <section className="mt-6 space-y-4 border-t border-border pt-6">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px] bg-muted ring-1 ring-border ring-inset" />
        <span className="min-w-0">No pick</span>
        <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground">{guidesLabel(guides.length)}</span>
      </h3>
      <PinChips
        guides={guides.map((g) => ({ id: g.id, name: g.name, short: displayName(g, { short: true }), quoted: false }))}
        short={short}
        pinning={pinning}
        label="Guides with no pick"
        side="No pick"
      />
    </section>
  );
}
