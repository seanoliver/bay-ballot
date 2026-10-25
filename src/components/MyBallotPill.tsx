"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { RESULTS_URL, shortDate } from "@/lib/election-day";
import { SEEN_KEY } from "@/lib/home-redirect";
import { isTypingTarget, OVERLAY } from "@/lib/keyboard";
import { myBallotText, myPickLabel, pageSlug, pickArea, type MyBallot, type MyBallotIndex } from "@/lib/my-ballot";
import { isPlainClick } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useElectionDay } from "./ElectionChip";
import { ExternalLink } from "./ExternalLink";
import { useHistorySheet } from "./useHistorySheet";
import { useMyBallot, type BallotUpdate } from "./useMyBallot";
import { useSingleKeys } from "./useSingleKeys";

const indexes = new Map<string, Promise<MyBallotIndex>>();
function loadIndex(url: string): Promise<MyBallotIndex> {
  let p = indexes.get(url);
  if (!p) {
    // Not AbortSignal.timeout: Safari added it only in 16.
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 15_000);
    p = fetch(url, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json() as Promise<MyBallotIndex>;
      })
      .finally(() => window.clearTimeout(timer));
    // A failure isn't kept, so Try again fetches again.
    p.catch(() => indexes.delete(url));
    indexes.set(url, p);
  }
  return p;
}

// Its own key: the home page writes "bay-area" to SEEN_KEY, which would forget the voter's area.
const AREA_KEY = "bb-ballot-area";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const PILL = "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const FOOT_LINK = "inline-flex min-h-10 items-center underline underline-offset-2 hover:text-foreground";

export function MyBallotPill({ election, date, indexUrl, areas }: { election: string; date: string; indexUrl: string; areas: string[] }) {
  const { ballot, update } = useMyBallot(election);
  const day = useElectionDay(date);
  const [open, setOpen, leave] = useHistorySheet();
  const [singleKeys] = useSingleKeys();
  const [index, setIndex] = useState<MyBallotIndex | "failed" | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const slug = pageSlug(election, pathname);
  // Replaces the sheet's own history entry, so Back from the contest returns to the page under the sheet.
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    if (!href) return;
    if (leave()) router.replace(href);
    else router.push(href);
  };

  useEffect(() => {
    if (!slug || !areas.includes(slug)) return;
    try {
      window.localStorage.setItem(AREA_KEY, slug);
    } catch {}
  }, [slug, areas]);
  const count = ballot ? Object.keys(ballot.picks).length : 0;
  const after = day?.kind === "after";
  const shown = ballot !== null && day !== null && !(after && count === 0);

  useEffect(() => {
    if (!open || index) return;
    let live = true;
    loadIndex(indexUrl).then(
      (x) => live && setIndex(x),
      () => live && setIndex("failed"),
    );
    return () => {
      live = false;
    };
  }, [open, index, indexUrl]);

  useEffect(() => {
    if (!shown || !singleKeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "b" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(document.activeElement as HTMLElement | null) || document.querySelector(OVERLAY)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, singleKeys, setOpen]);

  if (!shown || !ballot) return null;
  const label = after ? `Your ${shortDate(date)} ballot` : "Your ballot";
  const dark = ballot.started && !after;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(PILL, "js-only", dark ? "bg-primary text-primary-foreground" : "bg-background text-foreground ring-1 ring-foreground/15")}
      >
        {label}
        {dark ? <span className="tabular-nums opacity-75">{count}</span> : null}
        <span className="sr-only">{dark ? ` · ${count} picked` : ""}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] lg:max-h-[min(42rem,80dvh)] lg:w-[24rem] lg:rounded-2xl lg:border lg:pb-0 data-[side=bottom]:lg:right-4 data-[side=bottom]:lg:bottom-4 data-[side=bottom]:lg:left-auto"
        >
          {open ? (
            <SheetBody election={election} after={after} ballot={ballot} index={index === "failed" ? null : index} failed={index === "failed"} retry={() => setIndex(null)} slug={slug} label={label} update={update} close={() => setOpen(false)} go={go} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SheetBody({
  election,
  after,
  ballot,
  index,
  failed,
  retry,
  slug,
  label,
  update,
  close,
  go,
}: {
  election: string;
  after: boolean;
  ballot: MyBallot;
  index: MyBallotIndex | null;
  failed: boolean;
  retry: () => void;
  slug: string | null;
  label: string;
  update: (change: BallotUpdate) => void;
  close: () => void;
  go: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const { area, here } = index ? pickArea(index, slug, [read(AREA_KEY), read(SEEN_KEY)]) : { area: null, here: null };
  const view = area && index ? index.areas[area] : null;
  const count = Object.keys(ballot.picks).length;
  const live = ballot.started && !after;

  useEffect(() => {
    list.current?.querySelector("[data-here]")?.scrollIntoView({ block: "center" });
  }, [view]);

  const listed = new Set(view?.groups.flatMap((g) => g.sections.flatMap((s) => s.ids)) ?? []);
  const other = Object.keys(ballot.picks).filter((id) => !listed.has(id) && index?.contests[id]);
  const status = after ? "Locked" : ballot.started ? `${count} picked` : "Not started";

  const copy = () => {
    if (!index) return;
    const text = myBallotText(ballot, index, view?.groups ?? null, `${label}${view ? ` · ${view.name}` : ""}`);
    navigator.clipboard.writeText(text).then(
      () => setCopied("yes"),
      () => setCopied("failed"),
    );
  };

  const row = (id: string) => {
    const c = index?.contests[id];
    if (!c) return null;
    const pick = ballot.picks[id];
    const current = id === here;
    const value = pick ? myPickLabel(pick, { ranked: c.ranked }) : after ? "Not decided" : live ? "Not decided ›" : "—";
    const inner = (
      <>
        <span className="min-w-0">
          {c.title}
          {current ? <span className="text-xs text-muted-foreground"> · you&apos;re here</span> : null}
        </span>
        <span className={cn("text-right", pick && (live || after) ? "font-medium" : "text-muted-foreground")}>{value}</span>
      </>
    );
    const cls = cn("grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-2 text-sm", current && "bg-muted shadow-[inset_3px_0_0_var(--foreground)]");
    return (
      <li key={id} {...(current ? { "data-here": "" } : {})}>
        {live || after ? (
          <Link href={`/${election}/${id}`} onClick={go} aria-current={current ? "page" : undefined} className={cn(cls, "hover:bg-muted")}>
            {inner}
          </Link>
        ) : (
          <div className={cn(cls, "text-muted-foreground")}>{inner}</div>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="border-b border-border px-4 pt-4 pb-3 pr-14">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <SheetTitle className="text-base font-semibold">{label}</SheetTitle>
          <span className={cn("rounded-full px-2 text-xs leading-5", ballot.started || after ? "bg-muted text-muted-foreground" : "border border-dashed border-foreground/30 text-muted-foreground")}>{status}</span>
        </div>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          {after ? (
            <>
              Votes are still being counted.{" "}
              <ExternalLink href={RESULTS_URL} className="inline-flex items-center gap-0.5 underline underline-offset-2">
                Election results
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </ExternalLink>
            </>
          ) : ballot.started ? (
            <>{view ? `${view.name} ballot.` : null} Mark your picks under &ldquo;Your vote&rdquo; on each contest page.</>
          ) : (
            <>{view ? `${view.name} ballot.` : null} Mark how you plan to vote as you read, then use this list when you fill out your ballot.</>
          )}
        </SheetDescription>
      </div>

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {failed ? (
          <p role="alert" className="px-4 py-6 text-sm text-muted-foreground">
            Couldn&apos;t load your ballot.{" "}
            <button type="button" onClick={retry} className="underline underline-offset-2 hover:text-foreground">
              Try again
            </button>
          </p>
        ) : !index ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading your ballot…</p>
        ) : (
          <>
            {view ? null : (
              <div className="px-4 py-3 text-sm">
                <p>Pick your area to see every contest on your ballot.</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(index.areas).map(([id, a]) => (
                    <li key={id}>
                      <Link href={`/${election}/${id}`} onClick={go} className="inline-flex min-h-9 items-center rounded-full px-3 text-sm ring-1 ring-foreground/15 hover:bg-muted">
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view?.groups.map((g) => (
              <div key={g.heading}>
                <h3 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wider text-foreground uppercase">{g.heading}</h3>
                {g.sections.map((s) => (
                  <div key={s.name}>
                    <h4 className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">{s.name}</h4>
                    <ul>{s.ids.map(row)}</ul>
                  </div>
                ))}
              </div>
            ))}
            {other.length ? (
              <div>
                <h3 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wider text-foreground uppercase">{view ? "Other picks" : "Your picks"}</h3>
                <ul>{other.map(row)}</ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        {confirming ? (
          <div role="alertdialog" aria-labelledby="delete-picks-heading" className="space-y-2 text-sm">
            <p id="delete-picks-heading" className="font-semibold">
              Delete your picks?
            </p>
            <p className="text-muted-foreground">
              This removes {count === 1 ? "your 1 pick" : count === 2 ? "both picks" : `all ${count} picks`} from this device. It can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  update(() => null);
                  if (after) close();
                  setConfirming(false);
                }}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-destructive/10 px-3 font-medium text-destructive hover:bg-destructive/20"
              >
                Delete picks
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 font-medium ring-1 ring-foreground/15 hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {!ballot.started && !after ? (
              <>
                <button
                  type="button"
                  onClick={() => update((b) => ({ ...b, started: true }))}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary/80"
                >
                  Start my ballot
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">Saved on this device only. Never counted in guide tallies.</p>
              </>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted-foreground">
              {count > 0 ? (
                <button type="button" onClick={copy} className={FOOT_LINK}>
                  {copied === "yes" ? "Copied" : copied === "failed" ? "Couldn't copy" : "Copy as text"}
                </button>
              ) : null}
              {live ? (
                <button type="button" onClick={() => update((b) => ({ ...b, started: false }))} className={FOOT_LINK}>
                  Stop recording picks
                </button>
              ) : null}
              {count > 0 ? (
                <button type="button" onClick={() => setConfirming(true)} className={FOOT_LINK}>
                  Delete my picks
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}
