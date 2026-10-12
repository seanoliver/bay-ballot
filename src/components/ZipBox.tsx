"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { counted } from "@/lib/display";
import { isZip } from "@/lib/zip";

export const VOTER_STATUS_URL = "https://voterstatus.sos.ca.gov/";

export type ZipSummary =
  | { kind: "loading" }
  | { kind: "unknown" }
  | { kind: "elsewhere"; county: string; href: string | null }
  | { kind: "filtered"; on: number; maybe: number; hidden: number };

type Props = {
  zip: string | null;
  summary: ZipSummary | null;
  showAll: boolean;
  onZip: (zip: string | null) => void;
  onShowAll: (v: boolean) => void;
};

// Narrows the list to the contests a ZIP can vote on. The ZIP stays on this device: it never goes in the URL.
export function ZipBox({ zip, summary, showAll, onZip, onShowAll }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!isZip(v)) return setError(true);
    setError(false);
    setEditing(false);
    setDraft("");
    onZip(v);
  };

  if (!zip || editing) {
    return (
      <form onSubmit={submit} className="js-only mt-3 flex flex-wrap items-end gap-2" aria-label="Your ballot">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Your ZIP code</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            aria-invalid={error || undefined}
            aria-describedby="zip-note"
            className="h-11 w-28 rounded-lg bg-card px-3 text-base ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <button type="submit" className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90">
          Show my contests
        </button>
        {zip ? (
          <button type="button" className="h-11 px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setEditing(false)}>
            Cancel
          </button>
        ) : null}
        <p id="zip-note" className="basis-full text-sm text-muted-foreground">
          {error ? "Enter a 5-digit ZIP code." : "Saved only on this device."}
        </p>
      </form>
    );
  }

  const change = (
    <span className="whitespace-nowrap">
      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setEditing(true)}>
        Change
      </button>
      {" · "}
      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onZip(null)}>
        Clear
      </button>
    </span>
  );
  return (
    <div role="status" className="js-only mt-3 rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10">
      <p>
        <span className="font-medium">ZIP {zip}</span>
        {" · "}
        <ZipLine summary={summary} showAll={showAll} onShowAll={onShowAll} /> {change}
      </p>
      {summary?.kind === "filtered" && summary.maybe > 0 && !showAll ? (
        <p className="mt-1 text-muted-foreground">
          {counted(summary.maybe, "contest")} marked “may be on your ballot” depend on your exact address. Confirm with California’s{" "}
          <a href={VOTER_STATUS_URL} className="underline underline-offset-2 hover:text-foreground" rel="noopener" target="_blank">
            My Voter Status
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

function ZipLine({ summary, showAll, onShowAll }: { summary: ZipSummary | null; showAll: boolean; onShowAll: (v: boolean) => void }) {
  if (!summary || summary.kind === "loading") return <span className="text-muted-foreground">Loading…</span>;
  if (summary.kind === "unknown") return <span className="text-muted-foreground">Not in the nine Bay Area counties this site covers.</span>;
  if (summary.kind === "elsewhere") {
    return (
      <span className="text-muted-foreground">
        In {summary.county} County.{" "}
        {summary.href ? (
          <Link href={summary.href} className="underline underline-offset-2 hover:text-foreground">
            See the {summary.county} County ballot
          </Link>
        ) : null}
      </span>
    );
  }
  const toggle = (
    <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onShowAll(!showAll)}>
      {showAll ? "Hide them" : "Show all"}
    </button>
  );
  return (
    <span className="text-muted-foreground">
      {counted(summary.on + summary.maybe, "contest")} can be on your ballot
      {summary.hidden > 0 ? (
        <>
          {" · "}
          {summary.hidden} {showAll ? "others shown" : "others hidden"} · {toggle}
        </>
      ) : null}
      {" ·"}
    </span>
  );
}
