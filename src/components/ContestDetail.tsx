"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { BarTone, Slots } from "@/lib/bar";
import { reasonSections, resultHeadline, whoRows, type ReasonSection, type ResultHeadline, type WhoRow } from "@/lib/detail";
import { cardDescription, officialLink } from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./ExternalLink";
import { BAR_FILL } from "./tone";
import { VerdictBar } from "./VerdictBar";

// Inline links keep their line height but get a 40px-tall tap area.
const TAP = "inline-block py-2.5 -my-2.5";

const LEAD_TEXT: Record<ResultHeadline["tone"], string> = {
  yes: "text-yes",
  no: "text-no",
  split: "text-split",
  candidate: "text-foreground",
  none: "text-muted-foreground",
};

// Verdict labels are colored text (AA); candidate hues aren't all 3:1 on white, so candidates get
// a colored dot or border next to foreground text instead.
const LABEL_TEXT: Partial<Record<BarTone, string>> = { yes: "text-yes", no: "text-no" };
const BORDER: Record<BarTone, string> = {
  yes: "border-yes",
  no: "border-no",
  c1: "border-bar-1",
  c2: "border-bar-2",
  c3: "border-bar-3",
  c4: "border-bar-4",
  other: "border-muted-foreground/40",
  empty: "border-border",
};

// One contest in full, shared by the desktop pane, the phone sheet and the contest page:
// result headline and bar, WHO endorsed each pick, then WHY (only when there are quotes).
// `heading`: "h1" on the contest page, "h2" in the pane, false when a sheet title already names it.
export function ContestDetail({
  election,
  contest,
  rows,
  pending,
  heading = "h2",
  titleId,
  slots,
  pageLink = true,
  shortNames = true,
  action,
}: {
  election: string;
  contest: Contest;
  rows: Row[];
  pending: string | null;
  heading?: "h1" | "h2" | false;
  titleId?: string;
  slots?: Slots;
  pageLink?: boolean;
  // Short guide names in the WHO lists (the contest page lists full names).
  shortNames?: boolean;
  // Sits at the header's top-right (the desktop pane's close button).
  action?: ReactNode;
}) {
  const description = cardDescription(contest);
  const official = officialLink(contest);
  const result = resultHeadline(contest, rows);
  const who = whoRows(contest, rows, slots);
  const why = reasonSections(contest, rows, slots);
  const Title = heading || "h2";
  return (
    <div className="space-y-6">
      <div>
        {heading ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{contest.section}</p>
              <Title
                id={titleId}
                tabIndex={titleId ? -1 : undefined}
                className={cn("mt-1 leading-tight font-semibold outline-none", heading === "h1" ? "text-2xl font-bold" : "text-xl")}
              >
                {contest.title}
              </Title>
            </div>
            {action}
          </div>
        ) : null}
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className={cn("text-lg font-semibold", LEAD_TEXT[result.tone])}>{result.lead}</span>
          {result.detail ? <span className="text-sm text-muted-foreground tabular-nums">{result.detail}</span> : null}
        </p>
        <VerdictBar contest={contest} rows={rows} slots={slots} count={false} className="mt-2" />
      </div>

      {who.length ? (
        <section aria-label="Who endorses">
          <ul className="space-y-2.5">
            {who.map((w) => (
              <WhoLine key={w.key} row={w} short={shortNames} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No guide you&apos;re counting took a position.</p>
      )}

      {why.length ? (
        <div className="space-y-6">
          {why.map((s) => (
            <Reasons key={s.key} section={s} />
          ))}
        </div>
      ) : null}

      <Footer
        pending={pending}
        official={official}
        page={pageLink ? `/${election}/${contest.id}` : null}
      />
    </div>
  );
}

function Label({ tone, children }: { tone: BarTone; children: ReactNode }) {
  const verdict = LABEL_TEXT[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase", verdict ?? "text-foreground")}>
      {verdict ? null : <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", BAR_FILL[tone])} />}
      {children}
    </span>
  );
}

function WhoLine({ row, short }: { row: WhoRow; short: boolean }) {
  const [all, setAll] = useState(false);
  const names = all ? [...row.shown, ...row.hidden] : row.shown;
  return (
    <li className="text-sm leading-relaxed">
      <Label tone={row.tone}>
        {row.label} <span className="font-normal text-muted-foreground normal-case">· {row.count}</span>
      </Label>{" "}
      {names.map((g, i) => (
        <span key={g.id}>
          <Link href={`/guides/${g.id}`} title={g.name} className={`${TAP} underline-offset-2 hover:underline`}>
            {short ? g.short : g.name}
          </Link>
          {g.rank !== null ? <span className="whitespace-nowrap text-xs text-muted-foreground"> (ranked #{g.rank})</span> : null}
          {i < names.length - 1 ? ", " : " "}
        </span>
      ))}
      {row.hidden.length ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="-my-2.5 inline-block rounded-md py-2.5 font-medium whitespace-nowrap text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {all ? "Show less" : `+${row.hidden.length} more`}
        </button>
      ) : null}
    </li>
  );
}

function Reasons({ section }: { section: ReasonSection }) {
  const [all, setAll] = useState(false);
  return (
    <section>
      <h3>
        <Label tone={section.tone}>{section.title}</Label>
      </h3>
      <ul className="mt-3 space-y-4">
        {section.items.map((item) =>
          (all ? item.quotes : item.quotes.slice(0, 1)).map((q, i) => (
            <li key={`${item.guideId}-${i}`} className={cn("border-l-[3px] pl-3", BORDER[section.tone])}>
              <blockquote className="text-[15px] leading-relaxed">“{q.text}”</blockquote>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link href={`/guides/${item.guideId}`} className={`${TAP} font-medium text-foreground/80 underline-offset-2 hover:underline`}>
                  {item.guideName}
                </Link>
                {" · "}
                <ExternalLink href={q.href} className={`${TAP} underline underline-offset-2`}>
                  Source
                </ExternalLink>
              </p>
            </li>
          )),
        )}
      </ul>
      {section.hidden > 0 ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="mt-2 inline-flex min-h-10 items-center rounded-md text-sm font-medium underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {all ? "Show fewer" : `+${section.hidden} more`}
        </button>
      ) : null}
    </section>
  );
}

function Footer({ pending, official, page }: { pending: string | null; official: string | null; page: string | null }) {
  const parts = [
    pending ? <span key="p">{pending.replace(/\.$/, "")}</span> : null,
    official ? (
      <ExternalLink key="o" href={official} className={`${TAP} underline underline-offset-2`}>
        Official text
      </ExternalLink>
    ) : null,
    page ? (
      <Link key="c" href={page} className={`${TAP} underline underline-offset-2`}>
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
