"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Funnel, Pin } from "lucide-react";
import { countedNoPick, countOnly, isCountingOnly, pinMessage, type NoPickGuide } from "@/lib/contest-pins";
import type { Side } from "@/lib/detail";
import { displayName } from "@/lib/display";
import { isPinned, MAX_PINS, togglePin, type Filters, type GuideInfo } from "@/lib/filters";
import { cn } from "@/lib/utils";

/** What a contest's sides need to pin guides and count only one side. */
export type Pinning = {
  filters: Filters;
  status: string;
  noPick: GuideInfo[];
  limitId: string;
  onPin: (id: string) => void;
  onCountOnly: (side: Side) => void;
  counting: (side: Side) => boolean;
};

const STATUS_MS = 4000;
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
  const limitId = useId();
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The filters before the last Count only, so pressing it again puts them back.
  const before = useRef<Filters | null>(null);
  const say = useCallback((s: string) => {
    // Cleared first, so the same message twice is announced twice.
    setStatus("");
    requestAnimationFrame(() => setStatus(s));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), STATUS_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const all = useMemo(() => guides.map((g) => g.id), [guides]);
  const ids = (side: Side) => side.guides.map((g) => g.id);

  return {
    filters: f,
    status,
    noPick: countedNoPick(f, noPick, guides),
    limitId,
    onPin: (id) => {
      const guide = guides.find((g) => g.id === id);
      if (!guide) return;
      say(pinMessage(f, guide));
      onChange(togglePin(f, id));
    },
    counting: (side) => isCountingOnly(f, ids(side), all),
    onCountOnly: (side) => {
      if (isCountingOnly(f, ids(side), all)) {
        onChange(before.current ?? { ...f, off: [] });
        before.current = null;
        say(`Stopped counting only the guides for ${side.label}`);
        return;
      }
      before.current = f;
      onChange(countOnly(f, ids(side), all));
      say(`Counting only the ${guidesLabel(side.count)} for ${side.label}`);
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

export function PinHint({ pinning }: { pinning: Pinning }) {
  const n = pinning.filters.pins.length;
  return (
    <p id={pinning.limitId} className="text-sm text-muted-foreground">
      {n >= MAX_PINS
        ? `${n} of ${MAX_PINS} pinned. Unpin one to pin another.`
        : `Tap a guide to pin it and see its picks on every contest. ${n} of ${MAX_PINS} pinned.`}
    </p>
  );
}

/** Short names, as the Filters panel shows them. */
export function PinChips({ guides, pinning, label }: { guides: { id: string; name: string }[]; pinning: Pinning; label: string }) {
  const f = pinning.filters;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {guides.map((g) => {
        const pinned = isPinned(f, g.id);
        const full = !pinned && f.pins.length >= MAX_PINS;
        return (
          <li key={g.id}>
            <button
              type="button"
              aria-label={`Pin ${g.name}`}
              aria-pressed={pinned}
              aria-disabled={full || undefined}
              aria-describedby={full ? pinning.limitId : undefined}
              title={pinned ? "Unpin" : full ? `You can pin up to ${MAX_PINS} guides` : "Pin to see its picks on every contest"}
              onClick={() => (full ? undefined : pinning.onPin(g.id))}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8",
                pinned ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-muted/60 hover:bg-muted",
                full && "cursor-not-allowed opacity-40 hover:bg-muted/60",
              )}
            >
              {g.name}
              <Pin aria-hidden="true" className={cn("size-3.5 shrink-0", pinned ? "fill-current" : "text-muted-foreground")} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CountOnlyButton({ side, pinning, className }: { side: Side; pinning: Pinning; className?: string }) {
  const on = pinning.counting(side);
  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Count every guide you counted before" : "Count only these guides on every contest"}
      onClick={() => pinning.onCountOnly(side)}
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

export function NoPickBlock({ pinning }: { pinning: Pinning }) {
  const guides = pinning.noPick;
  if (!guides.length) return null;
  return (
    <section className="mt-6 space-y-4 border-t border-border pt-6">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px] bg-muted ring-1 ring-border ring-inset" />
        <span className="min-w-0">No pick</span>
        <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground">{guidesLabel(guides.length)}</span>
      </h3>
      <PinChips guides={guides.map((g) => ({ id: g.id, name: displayName(g, { short: true }) }))} pinning={pinning} label="Guides with no pick" />
    </section>
  );
}
