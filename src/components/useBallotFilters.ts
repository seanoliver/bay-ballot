"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { FILTERS_KEY, initialFilters, toQuery, type Filters, type GuideInfo } from "@/lib/filters";

export const CHANGE_EVENT = "bb-filters-change";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(FILTERS_KEY);
  } catch {
    return null;
  }
}

function writeStored(q: string) {
  try {
    window.localStorage.setItem(FILTERS_KEY, q);
  } catch {
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

// Not router.replace: that refetches from the server and scrolls.
function replaceQuery(q: string) {
  // Safari throws when replaceState is called too often; a throw must not break the caller.
  try {
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useQuery(): string {
  return useSyncExternalStore(subscribe, readQuery, () => "");
}

export function useBallotFilters({ guides, keep = [] }: { guides: GuideInfo[]; keep?: string[] }) {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const filters = useMemo(() => initialFilters({ query, stored, guides }), [query, stored, guides]);
  const keepKey = keep.join(",");

  const setFilters = useCallback(
    (f: Filters) => {
      const q = toQuery(f);
      writeStored(q);
      const p = new URLSearchParams(q);
      const current = new URLSearchParams(window.location.search);
      for (const k of keepKey ? keepKey.split(",") : []) {
        const v = current.get(k);
        if (v !== null) p.set(k, v);
      }
      replaceQuery(p.toString());
    },
    [keepKey],
  );
  return { filters, setFilters };
}

export function useQueryParam(name: string): [string | null, (v: string | null) => void] {
  const query = useQuery();
  const value = new URLSearchParams(query).get(name);
  const set = useCallback(
    (v: string | null) => {
      const p = new URLSearchParams(window.location.search);
      if (v === null) p.delete(name);
      else p.set(name, v);
      replaceQuery(p.toString());
    },
    [name],
  );
  return [value, set];
}
