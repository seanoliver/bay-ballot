"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { counted } from "@/lib/display";
import { isZip } from "@/lib/zip";

export const VOTER_STATUS_URL = "https://voterstatus.sos.ca.gov/";

type BallotLink = { label: string; href: string | null };

export type ZipSummary =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "unknown" }
  | { kind: "elsewhere"; where: string; links: BallotLink[] }
  | { kind: "filtered"; on: number; maybe: number; hidden: number; beyond: { text: string; link: BallotLink | null } | null };

type Props = {
  zip: string | null;
  summary: ZipSummary | null;
  showAll: boolean;
  onZip: (zip: string | null) => void;
  onShowAll: (v: boolean) => void;
  onRetry: () => void;
};

const TEXT_BUTTON = "inline-flex min-h-6 items-center underline underline-offset-2 hover:text-foreground";

// Narrows the list to the contests a ZIP can vote on. The ZIP stays on this device. The input has no `name`, so a
// submit before hydration can't put it in the URL.
export function ZipBox({ zip, summary, showAll, onZip, onShowAll, onRetry }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  // Where focus goes after the box changes shape, since the focused control is replaced.
  const focusNext = useRef<"input" | "summary" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const ids = useId();
  const open = !zip || editing;

  useEffect(() => {
    if (focusNext.current === "input") inputRef.current?.focus();
    if (focusNext.current === "summary") summaryRef.current?.focus();
    focusNext.current = null;
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isZip(draft)) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    setError(false);
    setEditing(false);
    focusNext.current = "summary";
    onZip(draft);
  };
  const cancel = () => {
    setEditing(false);
    setError(false);
    focusNext.current = "summary";
  };

  if (open) {
    return (
      <form onSubmit={submit} className="js-only mt-3 flex flex-wrap items-end gap-2" aria-label="Filter by ZIP code" noValidate>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Your ZIP code</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.replace(/\D/g, "").slice(0, 5));
              setError(false);
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== "Escape" || !zip) return;
              e.stopPropagation();
              cancel();
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            aria-invalid={error || undefined}
            aria-describedby={`${ids}-note ${ids}-error`}
            className="h-11 w-28 rounded-lg bg-card px-3 text-base ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <button type="submit" className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90">
          Show my contests
        </button>
        {zip ? (
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={cancel}>
            Cancel
          </button>
        ) : null}
        <p id={`${ids}-error`} role="alert" className="basis-full text-sm font-medium empty:hidden">
          {error ? "Enter a 5-digit ZIP code." : ""}
        </p>
        <p id={`${ids}-note`} className="basis-full text-sm text-muted-foreground">
          Saved only on this device.
        </p>
      </form>
    );
  }

  const actions = (
    <span className="whitespace-nowrap">
      <button
        type="button"
        className={TEXT_BUTTON}
        onClick={() => {
          setDraft(zip);
          setEditing(true);
          focusNext.current = "input";
        }}
      >
        Change
      </button>
      {" · "}
      <button
        type="button"
        className={TEXT_BUTTON}
        onClick={() => {
          setDraft("");
          focusNext.current = "input";
          onZip(null);
        }}
      >
        Clear
      </button>
    </span>
  );
  return (
    <section aria-label="Your ZIP code" className="js-only mt-3 rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10">
      <p ref={summaryRef} tabIndex={-1} className="outline-none">
        <span className="font-medium">ZIP {zip}</span>
        {" · "}
        <ZipLine summary={summary} showAll={showAll} onShowAll={onShowAll} onRetry={onRetry} />
        {" · "}
        {actions}
      </p>
      {summary?.kind === "filtered" && summary.beyond ? (
        <p className="mt-1 text-muted-foreground">
          {summary.beyond.text} {summary.beyond.link ? <BallotLinkText link={summary.beyond.link} /> : null}
        </p>
      ) : null}
      {summary?.kind === "filtered" && summary.maybe > 0 ? (
        <p className="mt-1 text-muted-foreground">
          {counted(summary.maybe, "contest")} marked “may be on your ballot” depend on your exact address. Confirm with California’s{" "}
          <a href={VOTER_STATUS_URL} className="underline underline-offset-2 hover:text-foreground" rel="noopener" target="_blank">
            My Voter Status
          </a>
          .
        </p>
      ) : null}
    </section>
  );
}

function BallotLinkText({ link }: { link: BallotLink }) {
  return link.href ? (
    <Link href={link.href} className="underline underline-offset-2 hover:text-foreground">
      See the {link.label} ballot
    </Link>
  ) : null;
}

function ZipLine({ summary, showAll, onShowAll, onRetry }: { summary: ZipSummary | null; showAll: boolean; onShowAll: (v: boolean) => void; onRetry: () => void }) {
  if (!summary || summary.kind === "loading") return <span className="text-muted-foreground">Loading…</span>;
  if (summary.kind === "failed") {
    return (
      <span className="text-muted-foreground">
        Couldn’t load the ZIP list, so every contest is shown.{" "}
        <button type="button" className={TEXT_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </span>
    );
  }
  if (summary.kind === "unknown") return <span className="text-muted-foreground">Not a ZIP this site can map (PO box ZIPs aren’t), so every contest is shown.</span>;
  if (summary.kind === "elsewhere") {
    return (
      <span className="text-muted-foreground">
        {summary.where}{" "}
        {summary.links.map((l, i) => (
          <span key={l.label}>
            {i > 0 ? " · " : null}
            <BallotLinkText link={l} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {counted(summary.on + summary.maybe, "contest")} can be on your ballot
      {summary.hidden > 0 ? (
        <>
          {" · "}
          {summary.hidden} {showAll ? "others shown" : "others hidden"} ·{" "}
          <button type="button" className={TEXT_BUTTON} onClick={() => onShowAll(!showAll)}>
            {showAll ? "Hide them" : "Show all"}
          </button>
        </>
      ) : null}
    </span>
  );
}
