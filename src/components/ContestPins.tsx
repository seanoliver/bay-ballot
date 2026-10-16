"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import { countedNoPick, pinMessage, type NoPickGuide } from "@/lib/contest-pins";
import { displayName } from "@/lib/display";
import { isPinned, MAX_PINS, togglePin, type Filters, type GuideInfo } from "@/lib/filters";
import { cn } from "@/lib/utils";

export type Pinning = {
  filters: Filters;
  status: string;
  noPick: GuideInfo[];
  onPin: (id: string) => void;
};

/** Pinning plus what belongs to one rendered contest detail: the panel and the phone sheet can both be in the page. */
export type PinControls = Pinning & { limitId: string };

export type ChipGuide = { id: string; name: string; short: string; quoted: boolean };

/** Inline links keep their line height but get a 40px-tall tap area. */
export const TAP = "inline-block py-2.5 -my-2.5";

const STATUS_MS = 4000;
const CHIPS_SHOWN = 4;
const guidesLabel = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

export function useContestPins({
  filters: f,
  onChange,
  guides,
  noPick,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  guides: GuideInfo[];
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
  };
}

/** A pin toggle, said aloud everywhere and shown as a toast on phones, where the Filters panel is out of sight.
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

// Screen-reader only, and not dead: a disabled pin's aria-describedby points here.
export function PinHint({ pinning }: { pinning: PinControls }) {
  const n = pinning.filters.pins.length;
  return (
    <p id={pinning.limitId} className="sr-only">
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

function PinChip({ guide, short, pinning, style, className }: { guide: ChipGuide; short: boolean; pinning: PinControls; style?: CSSProperties; className?: string }) {
  const nameId = useId();
  const f = pinning.filters;
  const pinned = isPinned(f, guide.id);
  const full = !pinned && f.pins.length >= MAX_PINS;
  const name = short ? guide.short : guide.name;
  return (
    <li style={style} className={className}>
      <span
        className={cn(
          "inline-flex items-stretch rounded-full border bg-background text-sm",
          pinned ? "border-foreground" : "border-foreground/20 shadow-xs",
          full && "border-dashed shadow-none",
        )}
      >
        <Link
          href={`/guides/${guide.id}`}
          prefetch={false}
          aria-label={`${name}${guide.quoted ? " (gave reasons)" : ""}`}
          aria-describedby={guide.name !== name ? nameId : undefined}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-l-full pr-2.5 pl-3 underline-offset-[3px] sm:min-h-9 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {name}
          {guide.quoted ? QUOTE_MARK : null}
          {guide.name !== name ? (
            <span id={nameId} className="sr-only">
              {guide.name}
            </span>
          ) : null}
        </Link>
        <span aria-hidden="true" className="my-2 w-px bg-foreground/20" />
        <button
          type="button"
          aria-label={`Pin ${name}`}
          title={full ? `You can pin up to ${MAX_PINS} guides` : undefined}
          aria-pressed={pinned}
          aria-disabled={full || undefined}
          aria-describedby={[guide.name !== name && nameId, full && pinning.limitId].filter(Boolean).join(" ") || undefined}
          onClick={() => pinning.onPin(guide.id)}
          className={cn(
            "inline-flex min-h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-r-full outline-none sm:min-h-9 focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-9",
            pinned ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            full && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
          )}
        >
          <Pin aria-hidden="true" className={cn("size-3.5", pinned && "fill-current")} />
        </button>
      </span>
    </li>
  );
}

export function PinChips({ guides, short, pinning, label }: { guides: ChipGuide[]; short: boolean; pinning: PinControls; label: string }) {
  const [all, setAll] = useState(false);
  const pinnedLater = guides.slice(CHIPS_SHOWN).filter((g) => isPinned(pinning.filters, g.id)).map((g) => g.id);
  // The first row changes only on "Show less" or a pin while collapsed, so a chip never jumps rows under the pointer or focus.
  const [kept, setKept] = useState(pinnedLater);
  if (!all && pinnedLater.some((id) => !kept.includes(id))) setKept([...kept, ...pinnedLater.filter((id) => !kept.includes(id))]);
  const inFirstRow = (g: ChipGuide, i: number) => i < CHIPS_SHOWN || kept.includes(g.id);
  const first = guides.filter(inFirstRow);
  const rest = guides.filter((g, i) => !inFirstRow(g, i));
  if (all && !rest.length) setAll(false);
  const firstRow = useRef<HTMLUListElement>(null);
  // "Show less" unmounts when every hidden chip was pinned into the first row, so focus moves to that row's last chip.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    [...(firstRow.current?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]") ?? [])].at(-1)?.focus();
  }, [all]);
  return (
    <>
      <div role="group" aria-label={label}>
        <ul ref={firstRow} className="flex flex-wrap gap-2">
          {first.map((g) => (
            <PinChip key={g.id} guide={g} short={short} pinning={pinning} />
          ))}
          {rest.length ? (
            <li>
              <button
                type="button"
                aria-expanded={all}
                onClick={() => {
                  if (all) {
                    setKept(pinnedLater);
                    refocus.current = rest.every((g) => pinnedLater.includes(g.id));
                  }
                  setAll(!all);
                }}
                className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
              >
                {all ? "Show less" : `+${rest.length} more`}
              </button>
            </li>
          ) : null}
        </ul>
        {all && rest.length ? (
          <ul className="flex flex-wrap gap-2 pt-2">
            {rest.map((g, i) => (
              <PinChip key={g.id} guide={g} short={short} pinning={pinning} className="reveal-item" style={{ "--i": i } as CSSProperties} />
            ))}
          </ul>
        ) : null}
      </div>
    </>
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
      />
    </section>
  );
}
