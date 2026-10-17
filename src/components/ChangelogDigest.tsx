"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { ExternalLink } from "@/components/ExternalLink";
import {
  dataSummary,
  digestSearch,
  FOLDED_ROWS,
  readDigestQuery,
  SHOWS,
  visibleDays,
  type DataRow,
  type DigestArea,
  type DigestDay,
  type DigestQuery,
  type Show,
  type SiteItem,
} from "@/lib/changelog-digest";
import { monthDay } from "@/lib/display";
import { cn } from "@/lib/utils";
import { replaceQuery, useQuery } from "./useBallotFilters";

const PULL = "https://github.com/seanoliver/bay-ballot/pull";
const LABEL: Record<SiteItem["type"], string> = { new: "New", data: "Data", fix: "Fix" };
const SHOW_LABEL: Record<Show, string> = { all: "All", site: "Site", data: "Data" };

const writeQuery = (q: DigestQuery) => replaceQuery(digestSearch(q).replace(/^\?/, ""));
const never = () => () => {};

export function ChangelogDigest({ days, areas }: { days: DigestDay[]; areas: DigestArea[] }) {
  const search = useQuery();
  // Marks the filter row once hydrated, so tests know a click will be handled.
  const hydrated = useSyncExternalStore(never, () => true, () => false);
  const areaIds = useMemo(() => areas.map((a) => a.id), [areas]);
  const { show, area } = readDigestQuery(search, areaIds);
  const guides = useMemo(() => {
    const a = areas.find((x) => x.id === area);
    return a ? new Set(a.guides) : null;
  }, [areas, area]);
  const shown = useMemo(() => visibleDays(days, { show, guides }), [days, show, guides]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const selectId = useId();
  const toggle = (date: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(date)) next.add(date);
      return next;
    });

  return (
    <>
      <div data-ready={hydrated ? "" : undefined} className="js-only mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Show" className="inline-flex rounded-full bg-muted p-0.5 ring-1 ring-border">
          {SHOWS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={show === s}
              onClick={() => writeQuery({ show: s, area: s === "site" ? null : area })}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-medium text-muted-foreground outline-none transition-[background-color,color] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8",
                show === s && "bg-background text-foreground shadow-sm ring-1 ring-foreground/10 dark:bg-card",
              )}
            >
              {SHOW_LABEL[s]}
            </button>
          ))}
        </div>
        {show !== "site" ? (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor={selectId} className="text-muted-foreground">
              Area
            </label>
            <select
              id={selectId}
              value={area ?? ""}
              onChange={(e) => writeQuery({ show, area: e.target.value || null })}
              className="min-h-10 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8 dark:bg-input/30"
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {shown.length === 0 ? <p className="mt-8 text-muted-foreground">No updates for this area yet.</p> : null}
      {shown.map((d) => (
        <section key={d.date} className="mt-6 border-t border-border pt-4">
          <h2 className="text-base font-semibold">
            <time dateTime={d.date}>{monthDay(d.date)}</time>
          </h2>
          {d.site.length > 0 ? (
            <ol className="mt-3 space-y-4">
              {d.site.map((e) => (
                <SiteEntry key={e.file} entry={e} />
              ))}
            </ol>
          ) : null}
          {d.data.length > 0 ? <DataBlock date={d.date} rows={d.data} always={show === "data"} open={open.has(d.date)} onToggle={() => toggle(d.date)} /> : null}
        </section>
      ))}
    </>
  );
}

function SiteEntry({ entry: e }: { entry: SiteItem }) {
  return (
    <li className="text-base">
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span className="rounded-full border border-border px-2 text-xs font-medium text-foreground">{LABEL[e.type]}</span>
        {e.pr ? (
          <ExternalLink href={`${PULL}/${e.pr}`} aria-label={`Pull request #${e.pr} (opens in new tab)`} className="underline underline-offset-2">
            #{e.pr}
          </ExternalLink>
        ) : null}
      </p>
      <p className="mt-1 font-medium">{e.title}</p>
      {e.details ? <p className="text-sm text-muted-foreground">{e.details}</p> : null}
    </li>
  );
}

function SummaryText({ text }: { text: string }) {
  const [lead, ...rest] = text.split(" · ");
  return (
    <span>
      <span className="font-semibold">{lead}</span>
      {rest.length > 0 ? <span className="text-muted-foreground">{` · ${rest.join(" · ")}`}</span> : null}
    </span>
  );
}

function DataBlock({ date, rows, always, open, onToggle }: { date: string; rows: DataRow[]; always: boolean; open: boolean; onToggle: () => void }) {
  const listId = `data-${date}`;
  const list = (
    <ul
      id={listId}
      aria-label={`Data updates, ${monthDay(date)}`}
      className={cn("divide-y divide-border/70 border border-border bg-card text-sm", always ? "rounded-xl" : [FOLDED_ROWS, "rounded-b-xl border-t-0", !open && "hidden"])}
    >
      {rows.map((r) => (
        <li key={r.file} className="px-3 py-2.5 text-muted-foreground">
          {r.name ? <span className="font-semibold text-foreground">{r.name}</span> : null}
          {r.name ? " " : null}
          {r.text}
          {r.pr ? (
            <>
              {" "}
              <ExternalLink href={`${PULL}/${r.pr}`} aria-label={`Pull request #${r.pr} (opens in new tab)`} className="underline underline-offset-2">
                #{r.pr}
              </ExternalLink>
            </>
          ) : null}
          {r.details ? <span className="mt-1 block">{r.details}</span> : null}
        </li>
      ))}
    </ul>
  );
  if (always) return <div className="mt-3">{list}</div>;
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "js-only flex min-h-11 w-full items-center justify-between gap-3 border border-border bg-card px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          open ? "rounded-t-xl" : "rounded-xl",
        )}
      >
        <SummaryText text={dataSummary(rows)} />
        <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-(--motion-in) ease-(--ease-out)", open && "rotate-180")} />
      </button>
      {list}
    </div>
  );
}
