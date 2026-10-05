"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { sections, showHint } from "@/lib/display";
import {
  activeEntries,
  initialFilters,
  toQuery,
  visibleContest,
  type Filters,
  type GuideInfo,
  type PickFile,
} from "@/lib/filters";
import type { Ballot } from "@/lib/schema";
import { ContestCard } from "./ContestCard";
import { FilterPanel } from "./FilterPanel";
import { SectionHeading } from "./SectionHeading";

const STORAGE_KEY = "bb-filters";
const CHANGE_EVENT = "bb-filters-change";

// Storage can throw (private mode, blocked site data); every access falls back to "nothing stored".
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(q: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, q);
  } catch {
    // Not persisting is fine; the URL still carries the filters.
  }
}

const readQuery = () => window.location.search;

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

type Props = {
  election: string;
  ballot: Ballot;
  guides: GuideInfo[];
  files: Record<string, PickFile>;
  pending: string | null;
};

// Filters live in the URL, falling back to the last filters saved on this device. The server (and
// hydration) render with no filters; the client applies URL/stored filters right after, so the
// prerendered page is the full ballot and nothing above the cards moves.
export function BallotView({ election, ballot, guides, files, pending }: Props) {
  const query = useSyncExternalStore(subscribe, readQuery, () => "");
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const filters = useMemo(() => initialFilters({ query, stored, ballot, guides }), [query, stored, ballot, guides]);
  const [opened, setOpened] = useState(false);

  const setFilters = useCallback((f: Filters) => {
    const q = toQuery(f);
    writeStored(q);
    // Native replaceState syncs with the Next router without a server round trip or scroll.
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const markOpened = useCallback(() => setOpened(true), []);

  const visible = sections(ballot.contests.filter((c) => visibleContest(c, filters)));
  let index = 0;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <FilterPanel filters={filters} onChange={setFilters} ballot={ballot} guides={guides} files={files} />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-3 pb-10 sm:px-4">
        {visible.map((s) => (
          <section key={s.name}>
            <SectionHeading>{s.name}</SectionHeading>
            <div className="flex flex-col gap-3">
              {s.contests.map((c) => (
                <ContestCard
                  key={c.id}
                  election={election}
                  contest={c}
                  rows={activeEntries(c.id, guides, files, filters)}
                  pending={pending}
                  hint={showHint({ index: index++, opened })}
                  onOpen={markOpened}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
