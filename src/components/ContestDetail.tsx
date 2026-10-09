"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { barSegments, type BarSegment, type BarTone, type Slots } from "@/lib/bar";
import { detailSides, pickReasons, resultHeadline, type ResultHeadline, type Side, type SideGuide, type SideQuote } from "@/lib/detail";
import { cardDescription, contestHeadline, officialLink } from "@/lib/display";
import { skippedLabel, type Scope } from "@/lib/fallback";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { tally } from "@/lib/score";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";
import { BayBlock, ScopeSwitch } from "./ScopeSwitch";
import { BAR_FILL } from "./tone";
import { useCarriedQuery } from "./useBallotFilters";
import { RankedPopover, Swatch, VerdictBar } from "./VerdictBar";

// Inline links keep their line height but get a 40px-tall tap area.
const TAP = "inline-block py-2.5 -my-2.5";
const CHIPS_SHOWN = 4;

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

export type DetailFallback = { place: string; scope: Scope; onScope: (s: Scope) => void; onReveal: () => void; rows: Row[]; total: number; slots?: Slots };

export function ContestDetail({
  election,
  contest,
  rows: areaRows,
  pending,
  heading = "h2",
  titleId,
  answer,
  slots: areaSlots,
  pageLink = true,
  shortNames = true,
  action,
  fallback,
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
  fallback?: DetailFallback;
}) {
  const bay = fallback?.scope === "bay";
  const rows = bay ? fallback.rows : areaRows;
  const slots = bay ? fallback.slots : areaSlots;
  const description = cardDescription(contest);
  const official = officialLink(contest);
  const result = resultHeadline(contest, rows);
  const { sides, others } = detailSides(contest, rows, slots);
  const ranked = contestHeadline(contest, rows).headline.ranked;
  const multi = contest.kind === "candidate" && contest.seats > 1;
  const Title = heading || "h2";
  const scopeSwitch = fallback ? <ScopeSwitch place={fallback.place} scope={fallback.scope} onChange={fallback.onScope} /> : null;
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
  const guides = sides.length ? (
    <div>
      {sides.map((side) => (
        <SideBlock key={side.key} side={side} rows={rows} contest={contest} short={shortNames} />
      ))}
      {others.length ? <OtherCandidates others={others} rows={rows} contest={contest} short={shortNames} /> : null}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">No guide you&apos;re counting took a position.</p>
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
            <div className={cn("min-w-0", scopeSwitch && "flex-1")}>
              <p className="text-sm text-muted-foreground">{contest.section}</p>
              {scopeSwitch ? (
                <div className="flex flex-col items-start gap-2 xl:flex-row xl:justify-between xl:gap-3">
                  {title}
                  <div className="shrink-0 xl:mt-1">{scopeSwitch}</div>
                </div>
              ) : (
                title
              )}
            </div>
            {action}
          </div>
        ) : scopeSwitch ? (
          <div className="pt-3">{scopeSwitch}</div>
        ) : null}
        {description ? <p className="measure mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {answer ? <p className="measure mt-3 text-base">{answer}</p> : null}
        {fallback?.scope === "area" ? <p className="mt-4 text-sm text-muted-foreground">{skippedLabel(fallback.place)}</p> : null}
        {bay ? (
          <BayBlock id={`bay-${titleId ?? "sheet"}-${contest.id}`} shown={rows.length} total={fallback.total} onReveal={fallback.onReveal} className="mt-4">
            {summary}
            <div className="mt-8">{guides}</div>
          </BayBlock>
        ) : null}
        {fallback ? null : summary}
      </div>

      {fallback ? null : guides}

      <Footer pending={pending} official={official} page={pageLink ? `/${election}/${contest.id}` : null} />
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

function SideBlock({ side, rows, contest, short }: { side: Side; rows: Row[]; contest: Contest; short: boolean }) {
  const { top, rest } = pickReasons(side, rows, contest);
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0 [&+&]:mt-6">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-[3px]", BAR_FILL[side.tone])} />
        <span className="min-w-0">{side.label}</span>
        <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground">{guidesLabel(side.count)}</span>
      </h3>
      <Chips guides={side.guides} short={short} label={`Guides for ${side.label}`} />
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

function OtherCandidates({ others, rows, contest, short }: { others: Side[]; rows: Row[]; contest: Contest; short: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<section className="mt-6 border-t border-border pt-6" />}>
      <CollapsibleTrigger className="-my-2.5 inline-flex min-h-10 items-center rounded-md text-base font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {open ? "Hide other candidates" : `Other candidates (${others.length})`}
      </CollapsibleTrigger>
      <CollapsibleContent className="reveal">
        <div className="pt-6">
          {others.map((side) => (
            <SideBlock key={side.key} side={side} rows={rows} contest={contest} short={short} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const QUOTE_MARK = (
  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 fill-current">
    <path d="M1 7.2C1 4.6 2.4 2.8 4.6 2l.5.9C3.8 3.6 3.2 4.5 3.1 5.6h1.7V10H1V7.2Zm6 0C7 4.6 8.4 2.8 10.6 2l.5.9c-1.3.7-1.9 1.6-2 2.7h1.7V10H7V7.2Z" />
  </svg>
);

function Chip({ guide, short, style, className }: { guide: SideGuide; short: boolean; style?: CSSProperties; className?: string }) {
  return (
    <li style={style} className={className}>
      <Link
        href={`/guides/${guide.id}`}
        title={guide.name}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
      >
        {short ? guide.short : guide.name}
        {guide.quoted ? (
          <>
            {QUOTE_MARK}
            <span className="sr-only">(gave reasons)</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}

// The first few chips, then "+N more" opens the rest below them; the extra chips rise in one by one.
function Chips({ guides, short, label }: { guides: SideGuide[]; short: boolean; label: string }) {
  const [all, setAll] = useState(false);
  const first = guides.slice(0, CHIPS_SHOWN);
  const rest = guides.slice(CHIPS_SHOWN);
  return (
    <Collapsible open={all} onOpenChange={setAll} render={<div role="group" aria-label={label} />}>
      <ul className="flex flex-wrap gap-2">
        {first.map((g) => (
          <Chip key={g.id} guide={g} short={short} />
        ))}
        {rest.length > 0 ? (
          <li>
            <CollapsibleTrigger className="inline-flex min-h-10 items-center rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8">
              {all ? "Show less" : `+${rest.length} more`}
            </CollapsibleTrigger>
          </li>
        ) : null}
      </ul>
      {rest.length > 0 ? (
        <CollapsibleContent className="reveal">
          <ul className="flex flex-wrap gap-2 pt-2">
            {rest.map((g, i) => (
              <Chip key={g.id} guide={g} short={short} className="reveal-item" style={{ "--i": i } as CSSProperties} />
            ))}
          </ul>
        </CollapsibleContent>
      ) : null}
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

function Footer({ pending, official, page }: { pending: string | null; official: string | null; page: string | null }) {
  const carry = useCarriedQuery();
  const parts = [
    pending ? <span key="p">{pending.replace(/\.$/, "")}</span> : null,
    official ? (
      <ExternalLink key="o" href={official} className={`${TAP} underline underline-offset-2`}>
        Official text
      </ExternalLink>
    ) : null,
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
