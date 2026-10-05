"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pendingNote, sections } from "@/lib/display";
import {
  activeEntries,
  fromQuery,
  hasFilterParams,
  pendingGuides,
  sanitizeFilters,
  toQuery,
  visibleContest,
  type Filters,
} from "@/lib/filters";
import type { Ballot, EndorsementFile, Guide } from "@/lib/schema";
import { ContestCard } from "./ContestCard";
import { FilterPanel } from "./FilterPanel";
import { SectionHeading } from "./SectionHeading";

const STORAGE_KEY = "bb-filters";
const STORAGE_EVENT = "bb-filters-change";

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
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

type Props = {
  election: string;
  ballot: Ballot;
  guides: Guide[];
  endorsements: Record<string, EndorsementFile>;
};

// Filters live in the URL; a URL without filter params falls back to the last filters saved on this device.
export function BallotView({ election, ballot, guides, endorsements }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const raw = hasFilterParams(query) ? query : (stored ?? "");
  const filters = useMemo(() => sanitizeFilters(fromQuery(raw), ballot, guides), [raw, ballot, guides]);

  const setFilters = useCallback(
    (f: Filters) => {
      const q = toQuery(f);
      writeStored(q);
      router.replace(q ? `?${q}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const pending = pendingNote(pendingGuides(guides, endorsements));
  const visible = sections(ballot.contests.filter((c) => visibleContest(c, filters)));

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <FilterPanel filters={filters} onChange={setFilters} ballot={ballot} guides={guides} endorsements={endorsements} />
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
                  rows={activeEntries(c.id, guides, endorsements, filters)}
                  pending={pending}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
