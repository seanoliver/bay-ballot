"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cardDescription, officialLink, sections } from "@/lib/display";
import {
  activeEntries,
  countedLabel,
  filterSummary,
  visibleContest,
  type Filters,
  type GuideInfo,
  type PickFile,
} from "@/lib/filters";
import type { Ballot, Contest } from "@/lib/schema";
import { Groups, TAP } from "../ContestCard";
import { ExternalLink } from "../ExternalLink";
import { FilterControls } from "../FilterPanel";
import { useBallotFilters, useQueryParam } from "../useBallotFilters";
import { VerdictBar } from "../VerdictBar";

export type LabProps = {
  election: string;
  subtitle: string;
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

// Everything the three layouts share: filter state (URL + device storage, same as the ballot page),
// the selected/open contest in ?c, and the visible sections after district filtering.
export function useLab({ ballot, guides, files }: Pick<LabProps, "ballot" | "guides" | "files">) {
  const { filters, setFilters } = useBallotFilters({ ballot, guides, keep: ["c"] });
  const [selected, setSelected] = useQueryParam("c");
  const visible = sections(ballot.contests.filter((c) => visibleContest(c, filters)));
  const rowsFor = (id: string) => activeEntries(id, guides, files, filters);
  const summary = filterSummary(filters, guides, files);
  return { filters, setFilters, selected, setSelected, visible, rowsFor, summary };
}

type FilterProps = { filters: Filters; onChange: (f: Filters) => void } & Pick<LabProps, "ballot" | "guides" | "files">;

// Desktop sidebar: always open, scrolls on its own.
export function FilterSidebar(props: FilterProps & { className?: string }) {
  const { className, ...rest } = props;
  return (
    <aside aria-label="Filters" className={className}>
      <p className="text-sm font-semibold">
        Filters <span className="font-normal text-muted-foreground">· {countedLabel(filterSummary(rest.filters, rest.guides, rest.files))}</span>
      </p>
      <FilterControls {...rest} />
    </aside>
  );
}

// Mobile: a Filters button that opens the controls in a bottom sheet.
export function FiltersSheet(props: FilterProps & { className?: string }) {
  const { className, ...rest } = props;
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" className={`h-11 justify-start gap-2 rounded-xl px-3.5 text-[15px] font-normal ${className ?? ""}`} />}
      >
        <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
        <span className="font-semibold">Filters</span>
        <span className="truncate text-muted-foreground">· {countedLabel(filterSummary(rest.filters, rest.guides, rest.files))}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          <FilterControls {...rest} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// The full detail for one contest: who picked what, their quotes and sources, official text.
export function ContestDetail({
  election,
  contest,
  rows,
  pending,
  heading = true,
  bar = true,
}: {
  election: string;
  contest: Contest;
  rows: ReturnType<typeof activeEntries>;
  pending: string | null;
  heading?: boolean;
  bar?: boolean;
}) {
  const description = cardDescription(contest);
  const official = officialLink(contest);
  return (
    <div>
      {heading ? (
        <>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{contest.section}</p>
          <h2 className="mt-1 text-xl font-semibold">{contest.title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </>
      ) : null}
      {bar ? <VerdictBar contest={contest} rows={rows} className="mt-3" /> : null}
      <Groups contest={contest} rows={rows} />
      {pending ? <p className="mt-3 text-sm text-muted-foreground">{pending}</p> : null}
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
        {official ? (
          <ExternalLink href={official} className={`${TAP} underline underline-offset-2`}>
            Official text
          </ExternalLink>
        ) : null}
        <Link href={`/${election}/${contest.id}`} className={`${TAP} underline underline-offset-2`}>
          Open contest page
        </Link>
      </p>
    </div>
  );
}

export function LabTitle({ n, name, subtitle }: { n: number; name: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-sm text-muted-foreground">{subtitle}</h1>
      <Link href="/lab" className="inline-flex min-h-10 items-center text-xs text-muted-foreground underline underline-offset-2">
        Layout lab · option {n}: {name}
      </Link>
    </div>
  );
}
