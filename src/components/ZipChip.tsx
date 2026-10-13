"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { counted } from "@/lib/display";
import { isZip } from "@/lib/zip";
import { cn } from "@/lib/utils";

export const VOTER_STATUS_URL = "https://voterstatus.sos.ca.gov/";

type BallotLink = { label: string; href: string | null };

export type ZipSummary =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "unknown" }
  | { kind: "filtered"; on: number; maybe: number; hidden: number; notes: { text: string; links: BallotLink[] }[] };

// One width for every state, so closing the field on mousedown can't move what the mouseup lands on.
// Set before a navigation to the ZIP's ballot, so the chip on the next page takes focus as the one typed in did.
// Expires, so a navigation that never finishes can't hand focus to a later chip.
let focusOnMountUntil = 0;
export function focusZipChipAfterLoad() {
  focusOnMountUntil = Date.now() + 10_000;
}

const CHIP = "js-only inline-flex min-h-10 min-w-[8.75rem] items-center gap-2 whitespace-nowrap rounded-full pr-3 pl-2.5";
const TEXT_BUTTON = "inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground";

/**
 * The ZIP chip at the end of the area chips. It applies at the fifth digit or on Enter, so it needs no button. The ZIP
 * stays on this device; the input has no `name`, so a submit before hydration can't put it in the URL.
 */
export function ZipChip({ zip, selected, onSelect, onZip, editing, setEditing, error, setError, errorId, hintId }: {
  zip: string | null;
  /** True when the ZIP's ballot is the list shown; false when another area chip is picked. */
  selected: boolean;
  onSelect: () => void;
  onZip: (zip: string | null) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  error: boolean;
  setError: (v: boolean) => void;
  errorId: string;
  hintId: string;
}) {
  const [draft, setDraft] = useState("");
  // Where focus goes once the chip has changed shape, since the focused control is replaced.
  const focusNext = useRef<"input" | "chip" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  // The listeners that clear an error after a click-away; dropped together, and whenever the error is set again.
  const pendingClear = useRef<AbortController | null>(null);
  const cancelPendingClear = () => {
    pendingClear.current?.abort();
    pendingClear.current = null;
  };
  useEffect(() => cancelPendingClear, []);
  useEffect(() => {
    if (Date.now() > focusOnMountUntil) return;
    focusOnMountUntil = 0;
    chipRef.current?.focus({ preventScroll: true });
  }, []);
  const fail = () => {
    cancelPendingClear();
    setError(true);
  };
  useEffect(() => {
    if (focusNext.current === "input") {
      inputRef.current?.focus({ preventScroll: true });
      // Selected, so the first digit typed replaces the old ZIP instead of adding to it.
      inputRef.current?.select();
    }
    if (focusNext.current === "chip") chipRef.current?.focus({ preventScroll: true });
    focusNext.current = null;
  });

  const apply = (v: string) => {
    cancelPendingClear();
    setEditing(false);
    setError(false);
    setDraft("");
    focusNext.current = "chip";
    onZip(v);
  };
  // Escape returns focus to the chip; leaving the field closes it where focus went.
  const close = ({ refocus }: { refocus: boolean }) => {
    setEditing(false);
    setDraft("");
    if (refocus) {
      focusNext.current = "chip";
      setError(false);
    } else if (error) {
      // Closed by a mousedown: clear the error once the click has landed, so the line can't move beneath it.
      // (A click whose handler stops propagation leaves it until the next click or key.)
      cancelPendingClear();
      const ac = (pendingClear.current = new AbortController());
      const clear = () => {
        ac.abort();
        setError(false);
      };
      document.addEventListener("click", clear, { signal: ac.signal });
      document.addEventListener("keydown", clear, { signal: ac.signal });
    }
  };
  const take = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 5);
    setDraft(v);
    setError(false);
    if (isZip(v)) apply(v);
  };

  if (editing) {
    return (
      <span
        className={cn(CHIP, "bg-card ring-2 ring-foreground")}
        onMouseDown={(e) => {
          // A click on the chip's own padding or pin would otherwise blur and close the field.
          if (e.target !== inputRef.current) e.preventDefault();
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          aria-label="Your ZIP code"
          aria-invalid={error || undefined}
          aria-describedby={`${errorId} ${hintId}`}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="ZIP code"
          enterKeyHint="go"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          onChange={(e) => take(e.target.value)}
          onPaste={(e) => {
            // A pasted address ends with its ZIP (a street number can also be 5 digits); stripping every non-digit would mangle it.
            const text = e.clipboardData.getData("text");
            // Text with letters is an address: only a ZIP at its end counts. Digits alone must be a ZIP or ZIP+4.
            const found = /[a-z]/i.test(text)
              ? /(?:^|\D)(\d{5})(?:[-\s]?\d{4})?[\s,.]*(?:U\.?S\.?A?\.?|United States(?: of America)?)?[\s.]*$/i.exec(text)
              : /^\s*(\d{5})(?:[-\s]?\d{4})?\s*$/.exec(text);
            e.preventDefault();
            if (found) take(found[1]);
            else fail();
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close({ refocus: true });
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (isZip(draft)) apply(draft);
              else fail();
            }
          }}
          onBlur={() => {
            // Switching apps blurs the field too; the browser refocuses it on return, so keep what was typed.
            if (document.hasFocus()) close({ refocus: false });
          }}
        />
      </span>
    );
  }
  if (!zip) {
    return (
      <button
        ref={chipRef}
        type="button"
        className={cn(CHIP, "justify-center border border-dashed border-foreground/40 text-foreground/80 hover:bg-muted")}
        onClick={() => {
          setEditing(true);
          setError(false);
          cancelPendingClear();
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        Your ZIP
      </button>
    );
  }
  return (
    <span
      className={cn(
        // The ZIP button's focus ring goes on the whole pill; on the button alone it covers only the left part. Clear keeps its own.
        "js-only inline-flex min-h-10 min-w-[8.75rem] items-center justify-between whitespace-nowrap rounded-full pr-1 has-[[data-zip-main]:focus-visible]:ring-3 has-[[data-zip-main]:focus-visible]:ring-ring/50",
        selected ? "bg-foreground font-medium text-background" : "ring-1 ring-foreground/15 hover:bg-muted",
      )}
    >
      <button
        ref={chipRef}
        type="button"
        aria-label={selected ? `ZIP ${zip}. Change` : `ZIP ${zip}. Show its ballot`}
        aria-current={selected ? "page" : undefined}
        data-zip-main
        className="inline-flex min-h-10 items-center gap-2 rounded-full pr-1 pl-2.5 outline-none"
        onClick={() => {
          if (!selected) {
            onSelect();
            return;
          }
          setDraft(zip);
          setEditing(true);
          setError(false);
          cancelPendingClear();
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        {zip}
      </button>
      <button
        type="button"
        aria-label="Clear ZIP"
        className={cn(
          "grid size-10 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected ? "text-background/80 hover:bg-background/20 hover:text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={() => {
          focusNext.current = "chip";
          onZip(null);
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </span>
  );
}

/** The one muted line under the chips that says what the ZIP did. */
export function ZipStatus({ zip, summary, showAll, onShowAll, onRetry, error, errorId, hintId }: {
  zip: string | null;
  summary: ZipSummary | null;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
  onRetry: () => void;
  error: boolean;
  errorId: string;
  hintId: string;
}) {
  return (
    <div data-zip-status className="js-only mt-2 text-sm text-muted-foreground">
      <p id={errorId} role="alert" className="font-medium text-foreground empty:sr-only">
        {error ? "Enter a 5-digit ZIP code." : ""}
      </p>
      <p id={hintId} hidden>
        Filters as soon as you type 5 digits. Saved only on this device.
      </p>
      {zip && summary ? <ZipLines zip={zip} summary={summary} showAll={showAll} onShowAll={onShowAll} onRetry={onRetry} /> : null}
    </div>
  );
}

function ZipLines({ zip, summary, showAll, onShowAll, onRetry }: { zip: string; summary: ZipSummary; showAll: boolean; onShowAll: (v: boolean) => void; onRetry: () => void }) {
  if (summary.kind === "loading") return <p>Loading…</p>;
  if (summary.kind === "failed") {
    return (
      <p>
        Couldn’t load the ZIP list, so every contest is shown.{" "}
        <button type="button" className={TEXT_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  if (summary.kind === "unknown") return <p>{zip} isn’t a Bay Area ZIP, or one this site can’t map (a PO box or new ZIP). Every contest is shown.</p>;
  const total = summary.on + summary.maybe + summary.hidden;
  return (
    <>
      <p>
        {summary.on + summary.maybe} of {counted(total, "contest")} can be on your ballot in {zip}
        {summary.hidden > 0 ? (
          <>
            {" · "}
            <button type="button" className={TEXT_BUTTON} onClick={() => onShowAll(!showAll)}>
              {showAll ? "Hide the others" : "Show all"}
            </button>
          </>
        ) : null}
      </p>
      {summary.notes.map((n) => (
        <p key={n.text}>
          {n.text} <BallotLinks links={n.links} />
        </p>
      ))}
      {summary.maybe > 0 ? (
        <p>
          “May be on your ballot” depends on your exact address
          {summary.hidden > 0 ? ", and ZIP areas are approximate near city and county lines" : ""}. Check{" "}
          <a href={VOTER_STATUS_URL} className="underline underline-offset-2 hover:text-foreground" rel="noopener" target="_blank">
            My Voter Status
          </a>
          .
        </p>
      ) : null}
    </>
  );
}

function BallotLinks({ links }: { links: BallotLink[] }) {
  return links
    .filter((l) => l.href)
    .map((l, i) => (
      <span key={l.label}>
        {i > 0 ? " · " : null}
        <Link href={l.href!} className="underline underline-offset-2 hover:text-foreground">
          See the {l.label} ballot
        </Link>
      </span>
    ));
}
