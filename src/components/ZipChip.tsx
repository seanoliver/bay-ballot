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

const CHIP = "js-only inline-flex min-h-10 items-center gap-2 rounded-full pr-3 pl-2.5";
const TEXT_BUTTON = "inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground";

/**
 * The ZIP chip at the end of the area chips. It applies at the fifth digit or on Enter, so it needs no button. The ZIP
 * stays on this device; the input has no `name`, so a submit before hydration can't put it in the URL.
 */
export function ZipChip({ zip, onZip, editing, setEditing, error, setError, errorId }: {
  zip: string | null;
  onZip: (zip: string | null) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  error: boolean;
  setError: (v: boolean) => void;
  errorId: string;
}) {
  const [draft, setDraft] = useState("");
  // Where focus goes once the chip has changed shape, since the focused control is replaced.
  const focusNext = useRef<"input" | "chip" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusNext.current === "input") inputRef.current?.focus();
    if (focusNext.current === "chip") chipRef.current?.focus();
    focusNext.current = null;
  });

  const apply = (v: string) => {
    setEditing(false);
    setError(false);
    setDraft("");
    focusNext.current = "chip";
    onZip(v);
  };
  const close = () => {
    setEditing(false);
    setError(false);
    setDraft("");
    focusNext.current = "chip";
  };

  if (editing) {
    return (
      <span className={cn(CHIP, "bg-card ring-2 ring-foreground")}>
        <MapPin aria-hidden className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          aria-label="Your ZIP code"
          aria-invalid={error || undefined}
          aria-describedby={errorId}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="ZIP code"
          enterKeyHint="go"
          className="w-[5.5rem] bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            setDraft(v);
            setError(false);
            if (isZip(v)) apply(v);
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (isZip(draft)) apply(draft);
              else setError(true);
            }
          }}
          onBlur={() => {
            if (!draft) close();
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
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        Your ZIP
      </button>
    );
  }
  return (
    <span className={cn(CHIP, "bg-card pr-1 font-medium ring-1 ring-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50")}>
      <button
        ref={chipRef}
        type="button"
        aria-label={`ZIP ${zip}. Change`}
        className="inline-flex min-h-10 items-center gap-2 outline-none"
        onClick={() => {
          setDraft(zip);
          setEditing(true);
          focusNext.current = "input";
        }}
      >
        <MapPin aria-hidden className="size-4 shrink-0" />
        {zip}
      </button>
      <button
        type="button"
        aria-label="Clear ZIP"
        className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted"
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
export function ZipStatus({ zip, summary, showAll, onShowAll, onRetry, editing, error, errorId }: {
  zip: string | null;
  summary: ZipSummary | null;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
  onRetry: () => void;
  editing: boolean;
  error: boolean;
  errorId: string;
}) {
  return (
    <div data-zip-status className="js-only mt-2 text-sm text-muted-foreground">
      <p id={errorId} role="alert" className="font-medium text-foreground empty:sr-only">
        {error ? "Enter a 5-digit ZIP code." : ""}
      </p>
      {editing ? (
        <p>Filters as soon as you type 5 digits. Saved only on this device.</p>
      ) : zip && summary ? (
        <ZipLines zip={zip} summary={summary} showAll={showAll} onShowAll={onShowAll} onRetry={onRetry} />
      ) : null}
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
