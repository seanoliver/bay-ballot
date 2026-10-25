"use client";

import { Check } from "lucide-react";
import { shortDate } from "@/lib/election-day";
import { myPickLabel, setPick, tapCandidate, type MyPick } from "@/lib/my-ballot";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useElectionDay } from "./ElectionChip";
import { useMyBallot } from "./useMyBallot";

const OPTION = "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const ON = "bg-primary text-primary-foreground ring-primary";
const OFF = "bg-background ring-foreground/15 hover:bg-muted";

export function YourVote({ election, date, contest }: { election: string; date: string; contest: Contest }) {
  const { ballot, update, saved } = useMyBallot(election);
  const day = useElectionDay(date);
  if (!ballot || !day) return null;
  const pick = ballot.picks[contest.id];
  const ranked = contest.kind === "candidate" && contest.rankedChoice;

  if (day.kind === "after") {
    if (!pick) return null;
    return (
      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
        <span>
          <span className="text-muted-foreground">You planned: </span>
          <span className="font-medium">{myPickLabel(pick, { ranked, short: false })}</span>
        </span>
        <span className="text-xs text-muted-foreground">{shortDate(date)} ballot</span>
      </p>
    );
  }
  if (!ballot.started) return null;

  const choose = (next: MyPick | null) => update((b) => setPick(b, contest.id, next));
  // A name the data no longer lists would take a seat no button can clear.
  const names = Array.isArray(pick) ? pick.filter((n) => contest.candidates.includes(n)) : [];
  const hint =
    contest.kind === "measure"
      ? null
      : ranked
        ? "Tap names in the order you'd rank them. Tap again to remove. Ranking fewer is fine."
        : contest.seats > 1
          ? `Choose up to ${contest.seats}. ${names.length} of ${contest.seats} chosen.`
          : null;

  return (
    <section aria-labelledby="your-vote-heading" className={cn("mt-4 rounded-xl border p-3", pick ? "border-foreground/15" : "border-dashed border-foreground/30")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="your-vote-heading" className="text-sm font-semibold">
          Your vote
        </h2>
        <p className="text-xs text-muted-foreground">{saved ? "Saved on this device" : "Not saved"}</p>
      </div>
      {contest.kind === "measure" ? (
        <div role="group" aria-label="Your vote" className="mt-2 grid grid-cols-3 gap-2">
          {(["Y", "N", "blank"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={pick === v} onClick={() => choose(pick === v ? null : v)} className={cn(OPTION, "justify-center", pick === v ? ON : OFF)}>
              {pick === v ? <Check aria-hidden="true" className="size-4" /> : null}
              {v === "Y" ? "Yes" : v === "N" ? "No" : "Blank"}
            </button>
          ))}
        </div>
      ) : (
        <>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          <ul aria-label="Your vote" className="mt-2 grid gap-1.5">
            {contest.candidates.map((name) => {
              const rank = names.indexOf(name);
              const on = rank !== -1;
              return (
                <li key={name}>
                  <button type="button" aria-pressed={on} onClick={() => choose(tapCandidate(names, name, contest))} className={cn(OPTION, "w-full text-left", on ? ON : OFF)}>
                    <span aria-hidden="true" className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums", on ? "bg-primary-foreground text-primary" : "ring-1 ring-foreground/20")}>
                      {on ? ranked ? rank + 1 : <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0">{name}</span>
                    {on && ranked ? <span className="sr-only">, ranked {rank + 1}</span> : null}
                  </button>
                </li>
              );
            })}
            <li>
              <button type="button" aria-pressed={pick === "blank"} onClick={() => choose(pick === "blank" ? null : "blank")} className={cn(OPTION, "w-full", pick === "blank" ? ON : OFF)}>
                Leave blank
              </button>
            </li>
          </ul>
        </>
      )}
      {saved ? null : (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          This browser isn&apos;t saving data, so your picks will be gone when you close the tab. Private browsing does this.
        </p>
      )}
    </section>
  );
}
