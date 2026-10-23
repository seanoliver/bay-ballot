"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { barSegments, type BarSegment, type BarTone, type Slots } from "@/lib/bar";
import { detailSides, pickReasons, resultHeadline, type ResultHeadline, type Side, type SideQuote } from "@/lib/detail";
import { cardDescription, contestHeadline } from "@/lib/display";
import type { Row } from "@/lib/filters";
import { officialSource, type OfficialSource } from "@/lib/official";
import type { Contest } from "@/lib/schema";
import { tally } from "@/lib/score";
import { cn } from "@/lib/utils";
import { NoPickBlock, PinChips, PinHint, PinStatus, TAP, type PinControls, type Pinning } from "./ContestPins";
import { CardLink, ExternalLink } from "./ExternalLink";
import { BAR_FILL } from "./tone";
import { useCarriedQuery } from "./useBallotFilters";
import { RankedPopover, Swatch, VerdictBar } from "./VerdictBar";

const LEAD_TEXT: Record<ResultHeadline["tone"], string> = {
  yes: "text-yes",
  no: "text-no",
  split: "text-split",
  candidate: "text-foreground",
  none: "text-muted-foreground",
};

const BORDER: Record<BarTone, string> = {
  yes: "border-yes-fill",
  no: "border-no-fill",
  c1: "border-bar-1",
  c2: "border-bar-2",
  c3: "border-bar-3",
  c4: "border-bar-4",
  other: "border-muted-foreground/40",
  empty: "border-border",
};

export function ContestDetail({
  election,
  contest,
  rows,
  pending,
  heading = "h2",
  titleId,
  answer,
  slots,
  pageLink = true,
  shortNames = true,
  action,
  local,
  pinning,
}: {
  election: string;
  contest: Contest;
  rows: Row[];
  pending: string | null;
  heading?: "h1" | "h2" | false;
  titleId?: string;
  answer?: string;
  slots?: Slots;
  pageLink?: boolean;
  shortNames?: boolean;
  action?: ReactNode;
  /** Guides covering the page's area, listed first within each pick. */
  local?: ReadonlySet<string>;
  pinning: Pinning;
}) {
  const description = cardDescription(contest);
  const official = officialSource(contest);
  const result = resultHeadline(contest, rows);
  const { sides, others } = detailSides(contest, rows, slots, { local });
  const ranked = contestHeadline(contest, rows).headline.ranked;
  const multi = contest.kind === "candidate" && contest.seats > 1;
  const Title = heading || "h2";
  const pins: PinControls = { ...pinning, limitId: useId() };
  const summary = (
    <>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={cn("flex items-center text-lg font-semibold", LEAD_TEXT[result.tone])}>
          {result.lead}
          {ranked ? <RankedPopover rows={rows} /> : null}
        </p>
        {result.detail ? <p className="text-sm text-muted-foreground">{result.detail}</p> : null}
      </div>
      <VerdictBar contest={contest} rows={rows} slots={slots} count={false} size="detail" legend={false} className="mt-2" />
      {multi ? null : <Legend segments={barSegments(tally(contest, rows.map((r) => r.entry)), contest, slots)} />}
    </>
  );
  const guides = (
    <div>
      {sides.length || pinning.noPick.length ? <PinHint pinning={pins} /> : null}
      {sides.length ? (
        <div>
          {sides.map((side) => (
            <SideBlock key={side.key} side={side} rows={rows} contest={contest} short={shortNames} pinning={pins} />
          ))}
          {others.length ? <OtherCandidates others={others} rows={rows} contest={contest} short={shortNames} pinning={pins} /> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No guide you&apos;re counting took a position.</p>
      )}
      <NoPickBlock key={contest.id} pinning={pins} short={shortNames} />
    </div>
  );
  const title = (
    <Title id={titleId} tabIndex={titleId ? -1 : undefined} className={cn("mt-1 font-semibold outline-none", heading === "h1" ? "text-2xl" : "text-xl")}>
      {contest.title}
    </Title>
  );
  return (
    <div className="space-y-8">
      <div>
        {heading ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{contest.section}</p>
              {title}
            </div>
            {action}
          </div>
        ) : null}
        {contest.summary ? (
          <OfficialSummary summary={contest.summary} />
        ) : description ? (
          <p className="measure mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {official ? <Official source={official} /> : null}
        {answer ? <p className="measure mt-3 text-base">{answer}</p> : null}
        {summary}
      </div>

      {guides}

      <Footer pending={pending} page={pageLink ? `/${election}/${contest.id}` : null} />
      <PinStatus message={pinning.status} />
    </div>
  );
}

const SIDE_NAME: Record<string, string> = { Y: "Yes", N: "No" };

function Legend({ segments }: { segments: BarSegment[] }) {
  if (segments[0]?.tone === "empty") return null;
  const item = (s: BarSegment, end = false) => (
    <span key={s.key} className={cn("inline-flex min-w-0 items-center gap-1.5", end && "flex-row-reverse text-right")}>
      <Swatch tone={s.tone} />
      <span className="truncate">{SIDE_NAME[s.key] ?? s.label}</span>
      <span className="text-muted-foreground">{s.count}</span>
    </span>
  );
  if (segments.length === 2) {
    return (
      <div className="mt-2 flex justify-between gap-3 text-sm">
        {item(segments[0])}
        {item(segments[1], true)}
      </div>
    );
  }
  return <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">{segments.map((s) => item(s))}</div>;
}

const guidesLabel = (n: number) => `${n} ${n === 1 ? "guide" : "guides"}`;

function SideBlock({ side, rows, contest, short, pinning }: { side: Side; rows: Row[]; contest: Contest; short: boolean; pinning: PinControls }) {
  const { top, rest } = pickReasons(side, rows, contest);
  const heading = (
    <h3 className="flex flex-1 items-center gap-2 text-base font-semibold">
      <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-[3px]", BAR_FILL[side.tone])} />
      <span className="min-w-0">{side.label}</span>
      <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground">{guidesLabel(side.count)}</span>
    </h3>
  );
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0 [&+&]:mt-6">
      {heading}
      <PinChips key={contest.id} guides={side.guides} short={short} pinning={pinning} label={`Guides for ${side.label}`} />
      {top.length ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Reasons</p>
          <ul className="space-y-4">
            {top.map((q, i) => (
              <QuoteItem key={`${q.guideId}-${i}`} quote={q} tone={side.tone} />
            ))}
          </ul>
          {rest.length ? <AllReasons rest={rest} total={side.quotes.length} tone={side.tone} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function OtherCandidates({ others, rows, contest, short, pinning }: { others: Side[]; rows: Row[]; contest: Contest; short: boolean; pinning: PinControls }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<section className="mt-6 border-t border-border pt-6" />}>
      <CollapsibleTrigger className="-my-2.5 inline-flex min-h-10 items-center rounded-md text-base font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {open ? "Hide other candidates" : `Other candidates (${others.length})`}
      </CollapsibleTrigger>
      <CollapsibleContent className="reveal">
        <div className="pt-6">
          {others.map((side) => (
            <SideBlock key={side.key} side={side} rows={rows} contest={contest} short={short} pinning={pinning} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function QuoteItem({ quote, tone }: { quote: SideQuote; tone: BarTone }) {
  return (
    <li className={cn("border-l-2 pl-4", BORDER[tone])}>
      <blockquote className="measure text-base">
        <span className="-ml-[0.45ch]">“</span>
        {quote.text}”
      </blockquote>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href={`/guides/${quote.guideId}`} className={`${TAP} font-medium text-foreground underline-offset-2 hover:underline`}>
          {quote.guideName}
        </Link>
        {" · "}
        <ExternalLink href={quote.href} className={`${TAP} underline underline-offset-2`}>
          Source
        </ExternalLink>
      </p>
    </li>
  );
}

function AllReasons({ rest, total, tone }: { rest: SideQuote[]; total: number; tone: BarTone }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleContent className="reveal">
        <ul className="space-y-4 pb-4">
          {rest.map((q, i) => (
            <QuoteItem key={`${q.guideId}-${i}`} quote={q} tone={tone} />
          ))}
        </ul>
      </CollapsibleContent>
      <CollapsibleTrigger className="-my-2.5 inline-flex min-h-10 items-center rounded-md text-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {open ? "Fewer reasons" : `All reasons (${total})`}
      </CollapsibleTrigger>
    </Collapsible>
  );
}

function OfficialSummary({ summary }: { summary: NonNullable<Contest["summary"]> }) {
  return (
    <div className="mt-1 text-sm">
      <p className="measure text-muted-foreground">{summary.text}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-4">
        {(["yes", "no"] as const).map((side) => (
          <div key={side}>
            <dt className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[3px]", BAR_FILL[side])} />
              {SIDE_NAME[side === "yes" ? "Y" : "N"]} means
            </dt>
            <dd className="pl-4.5">{summary[side]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Official({ source }: { source: OfficialSource }) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <Landmark aria-hidden="true" strokeWidth={1.75} className="mt-2.5 size-5 shrink-0 text-foreground/80" />
      <div className="min-w-0">
        <CardLink href={source.href} label={source.label} />
      </div>
    </div>
  );
}

function Footer({ pending, page }: { pending: string | null; page: string | null }) {
  const carry = useCarriedQuery();
  const parts = [
    pending ? <span key="p">{pending.replace(/\.$/, "")}</span> : null,
    page ? (
      <Link key="c" href={`${page}${carry}`} className={`${TAP} underline underline-offset-2`}>
        Open contest page
      </Link>
    ) : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </p>
  );
}
