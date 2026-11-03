"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { RESULTS_URL, shortDate } from "@/lib/election-day";
import { isTypingTarget, OVERLAY } from "@/lib/keyboard";
import { ballotPosition, myBallotText, myPickLabel, pageSlug, pickArea, shortTitle, type BallotPosition, type MyBallot, type MyBallotIndex } from "@/lib/my-ballot";
import { isPlainClick } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useElectionDay } from "./ElectionChip";
import { ExternalLink } from "./ExternalLink";
import { AREA_KEY, OPEN_BALLOT, storedAreas, useBallotIndex } from "./useBallotIndex";
import { useHistorySheet } from "./useHistorySheet";
import { useMyBallot, type BallotUpdate } from "./useMyBallot";
import { useSingleKeys } from "./useSingleKeys";

const PILL = "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const FOOT_LINK = "inline-flex min-h-10 items-center underline underline-offset-2 hover:text-foreground";

export function MyBallotPill({ election, date, indexUrl, areas }: { election: string; date: string; indexUrl: string; areas: string[] }) {
  const { ballot, update } = useMyBallot(election);
  const day = useElectionDay(date);
  const [open, setOpen, leave] = useHistorySheet();
  const [singleKeys] = useSingleKeys();
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

  const live = ballot !== null && ballot.started && !after;
  // Not only while open: the bar needs the index on every contest page.
  const { index, failed, retry } = useBallotIndex(indexUrl, open || (live && slug !== null), { retryKey: pathname });
  const position = live && index && ballot ? ballotPosition(index, slug, storedAreas(), ballot.picks) : null;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_BALLOT, onOpen);
    return () => window.removeEventListener(OPEN_BALLOT, onOpen);
  }, [setOpen]);

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
      {position && index ? (
        <NextBar election={election} index={index} position={position} openSheet={() => setOpen(true)} />
      ) : (
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
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] lg:max-h-[min(42rem,80dvh)] lg:w-[24rem] lg:rounded-2xl lg:border lg:pb-0 data-[side=bottom]:lg:right-4 data-[side=bottom]:lg:bottom-4 data-[side=bottom]:lg:left-auto"
        >
          {open ? (
            <SheetBody election={election} after={after} ballot={ballot} index={index} failed={failed} retry={retry} slug={slug} label={label} update={update} close={() => setOpen(false)} go={go} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

const BAR_BTN = "inline-flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function NextBar({ election, index, position, openSheet }: { election: string; index: MyBallotIndex; position: BallotPosition; openSheet: () => void }) {
  const { order, at, prev, next, decided } = position;
  const title = (id: string) => index.contests[id]?.title ?? id;
  return (
    <>
      <div aria-hidden="true" className="js-only h-20 lg:hidden" />
      <nav
        aria-label="Contest by contest"
        className="js-only fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-4 lg:bottom-4 lg:w-[24rem] lg:rounded-2xl lg:border lg:pb-3 lg:shadow-lg"
      >
        <div aria-hidden="true" className="mb-2 h-[3px] overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground" style={{ width: `${(decided / order.length) * 100}%` }} />
        </div>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-2">
          {prev ? (
            <Link href={`/${election}/${prev}`} aria-label={`Previous: ${title(prev)}`} className={cn(BAR_BTN, "justify-center ring-1 ring-foreground/15 hover:bg-muted")}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Your ballot, ${at + 1} of ${order.length}, ${decided} decided`}
            onClick={openSheet}
            className={cn(BAR_BTN, "flex-col justify-center leading-tight hover:bg-muted")}
          >
            <span className="text-sm font-semibold tabular-nums">
              {at + 1} of {order.length}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{decided} decided</span>
          </button>
          {next ? (
            <Link href={`/${election}/${next}`} className={cn(BAR_BTN, "justify-between gap-1 bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80")}>
              <span className="truncate">
                <span className="sr-only">Next: </span>
                {shortTitle(title(next))}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          ) : (
            <button type="button" aria-haspopup="dialog" onClick={openSheet} className={cn(BAR_BTN, "justify-between gap-1 bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80")}>
              Review
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </button>
          )}
        </div>
      </nav>
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
  const { area, here } = index ? pickArea(index, slug, storedAreas()) : { area: null, here: null };
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
