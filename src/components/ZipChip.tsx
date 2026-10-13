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
  | { kind: "elsewhere"; where: string; links: BallotLink[] }
  | { kind: "filtered"; on: number; maybe: number; hidden: number; notes: { text: string; links: BallotLink[] }[] };

// One width for every state, so closing the field on mousedown can't move what the mouseup lands on.
const CHIP = "js-only inline-flex min-h-10 min-w-[8.75rem] items-center gap-2 rounded-full pr-3 pl-2.5";
const TEXT_BUTTON = "inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground";

/**
 * The ZIP chip at the end of the area chips. It applies at the fifth digit or on Enter, so it needs no button. The ZIP
 * stays on this device; the input has no `name`, so a submit before hydration can't put it in the URL.
 */
export function ZipChip({ zip, onZip, editing, setEditing, error, setError, errorId, hintId }: {
  zip: string | null;
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
    if (refocus) focusNext.current = "chip";
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
          className="w-[5.5rem] bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          onChange={(e) => take(e.target.value)}
          onPaste={(e) => {
            // A pasted address ends with its ZIP (a street number can also be 5 digits); stripping every non-digit would mangle it.
            const text = e.clipboardData.getData("text");
            const found = [...text.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].at(-1);
            if (found) {
              e.preventDefault();
              take(found[1]);
            } else if (/[^\d\s-]/.test(text)) {
              e.preventDefault();
              setError(true);
            }
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close({ refocus: true });
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (isZip(draft)) apply(draft);
              else setError(true);
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
        className={cn(CHIP, "border border-dashed border-foreground/40 text-foreground/80 hover:bg-muted")}
        onClick={() => {
          setEditing(true);
          setError(false);
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        Your ZIP
      </button>
    );
  }
  return (
    <span className="js-only inline-flex min-h-10 min-w-[8.75rem] items-center justify-between rounded-full bg-card pr-1 font-medium ring-1 ring-foreground">
      <button
        ref={chipRef}
        type="button"
        aria-label={`ZIP ${zip}. Change`}
        className="inline-flex min-h-10 items-center gap-2 rounded-full pr-1 pl-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => {
          setDraft(zip);
          setEditing(true);
          setError(false);
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        {zip}
      </button>
      <button
        type="button"
        aria-label="Clear ZIP"
        className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
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
  if (summary.kind === "elsewhere") {
    return (
      <p>
        {zip}: {summary.where} <BallotLinks links={summary.links} />
      </p>
    );
  }
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
