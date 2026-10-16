"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from "react";
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

// Screen-reader only, and not dead: a disabled chip's aria-describedby points here.
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

// The name opens the guide's page; the pin at the pill's end pins it and fills in once pinned.
function PinChip({ guide, short, pinning, style, className }: { guide: ChipGuide; short: boolean; pinning: PinControls; style?: CSSProperties; className?: string }) {
  const nameId = useId();
  const f = pinning.filters;
  const pinned = isPinned(f, guide.id);
  const full = !pinned && f.pins.length >= MAX_PINS;
  const name = short ? guide.short : guide.name;
  return (
    // Raised while open: an animating chip is its own stacking layer, so later chips would cover its tooltip.
    <li style={style} className={cn("relative hover:z-10 focus-within:z-10", className)}>
      <span
        className={cn(
          "inline-flex items-stretch rounded-full border bg-background text-sm",
          pinned ? "border-foreground" : "border-foreground/20 shadow-xs",
          full && "border-dashed shadow-none",
        )}
      >
        <Link
          href={`/guides/${guide.id}`}
          // Labelled, so the tooltip inside it describes the link without joining its name.
          aria-label={`${name}${guide.quoted ? " (gave reasons)" : ""}`}
          aria-describedby={guide.name !== name ? nameId : undefined}
          onClick={(e) => {
            // A click on the tooltip, which sits over other chips, hides it instead of following the link.
            if (e.target instanceof Element && e.target.closest("[data-tip]")) {
              e.preventDefault();
              e.currentTarget.dataset.tipHidden = "true";
            }
          }}
          onPointerEnter={hoverTip}
          onFocus={placeTip}
          onPointerLeave={leaveTip}
          onBlur={resetTip}
          onKeyDown={dismissTip}
          className="group relative inline-flex min-h-10 items-center gap-1.5 rounded-l-full pr-2.5 pl-3 underline-offset-[3px] sm:min-h-9 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {name}
          {guide.quoted ? QUOTE_MARK : null}
          {guide.name !== name ? (
            <span id={nameId} className="sr-only">
              {guide.name}
            </span>
          ) : null}
          {/* Inside the link with a padded gap, so the pointer can move onto it without it closing. */}
          <span
            aria-hidden="true"
            data-tip
            className="absolute top-full left-0 z-20 hidden w-max max-w-56 cursor-default pt-2 text-left text-[13px] leading-snug font-normal no-underline group-focus-visible:block group-data-[tip-hidden=true]:hidden! group-data-[tip-up=true]:top-auto group-data-[tip-up=true]:bottom-full group-data-[tip-up=true]:pt-0 group-data-[tip-up=true]:pb-2 pointer-fine:group-hover:block"
          >
            <span className="block rounded-lg bg-foreground px-2.5 py-2 text-background shadow-md">
              <b className="font-semibold">{guide.name}</b>.{guide.quoted ? " Gave reasons on this contest." : null} Opens its guide page.
            </span>
          </span>
        </Link>
        <span aria-hidden="true" className="my-2 w-px bg-foreground/20" />
        <button
          type="button"
          aria-label={`Pin ${name}`}
          aria-pressed={pinned}
          aria-disabled={full || undefined}
          aria-describedby={full ? pinning.limitId : undefined}
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

const TIP_MAX = 224;

// Keeps the tooltip inside its row: under the chip from its left edge, else from its right edge, else from the row's start.
// In a collapsible panel, which clips what overflows it, it opens above the chip when it fits there and not below.
function placeTip(e: SyntheticEvent<HTMLElement>) {
  const b = e.currentTarget;
  const tip = b.querySelector<HTMLElement>("[data-tip]");
  const row = b.closest("ul");
  if (!tip || !row) return;
  const chip = b.getBoundingClientRect();
  const width = row.clientWidth;
  const left = chip.left - row.getBoundingClientRect().left;
  const max = Math.min(TIP_MAX, width);
  const [from, to] = left + max <= width ? ["0", "auto"] : left + chip.width >= max ? ["auto", "0"] : [`${-left}px`, "auto"];
  tip.style.left = from;
  tip.style.right = to;
  tip.style.maxWidth = `${max}px`;
  const clip = b.closest(".reveal")?.getBoundingClientRect();
  if (!clip) return void delete b.dataset.tipUp;
  // Measured while laid out but unseen, since it is hidden until the hover or focus lands.
  tip.style.cssText += ";display:block;visibility:hidden";
  const height = tip.offsetHeight;
  tip.style.display = tip.style.visibility = "";
  b.dataset.tipUp = String(chip.bottom + height > clip.bottom && chip.top - height >= clip.top);
}

function resetTip(e: SyntheticEvent<HTMLElement>) {
  delete e.currentTarget.dataset.tipHidden;
}

// The chip under the pointer, whose tooltip Escape hides even while focus is elsewhere.
let hovered: HTMLElement | null = null;

function hoverTip(e: SyntheticEvent<HTMLElement>) {
  placeTip(e);
  hovered = e.currentTarget;
  document.addEventListener("keydown", escapeHovered, true);
}

function leaveTip(e: SyntheticEvent<HTMLElement>) {
  resetTip(e);
  if (hovered === e.currentTarget) unhover();
}

function unhover() {
  hovered = null;
  document.removeEventListener("keydown", escapeHovered, true);
}

// Captured on the document, so it runs before the pane's and the sheet's own Escape.
function escapeHovered(e: globalThis.KeyboardEvent) {
  if (e.key !== "Escape") return;
  const b = hovered;
  if (!b?.isConnected) return unhover();
  if (!b.matches(":hover") || b.dataset.tipHidden === "true" || !window.matchMedia("(pointer: fine)").matches) return;
  b.dataset.tipHidden = "true";
  // Stopping the event skips the focused chip's own handler, so hide its open tooltip here too.
  const f = document.activeElement;
  if (f instanceof HTMLElement && f !== b && f.matches(":focus-visible") && f.querySelector("[data-tip]")) f.dataset.tipHidden = "true";
  e.stopImmediatePropagation();
  e.preventDefault();
}

// Escape hides an open tooltip without closing the panel or sheet around it.
function dismissTip(e: KeyboardEvent<HTMLElement>) {
  const b = e.currentTarget;
  if (e.key !== "Escape" || b.dataset.tipHidden === "true") return;
  const open = b.matches(":focus-visible") || (b.matches(":hover") && window.matchMedia("(pointer: fine)").matches);
  if (!open) return;
  b.dataset.tipHidden = "true";
  // Also keeps it from other listeners on the document, such as the sheet's dismiss.
  e.nativeEvent.stopImmediatePropagation();
  e.stopPropagation();
  e.preventDefault();
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

/** Plain links to each chip's guide page, in the chips' order: a dozen, then "and N more" shows the rest. */
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
