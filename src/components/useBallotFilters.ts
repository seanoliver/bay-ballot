"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { COUNTIES_PARAM } from "@/lib/counties";
import { carryQuery, FILTERS_KEY, filterQuery, initialFilters, reconcileQuery, toQuery, type FilterGuide, type Filters } from "@/lib/filters";
import { historyBudget } from "@/lib/history-budget";

export const CHANGE_EVENT = "bb-filters-change";

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
  }
}

// Counted in browser history calls, which throw past 100 in 10 seconds: Next adds a replaceState after each of our writes and after every popstate.
export const HISTORY_BUDGET = historyBudget({ max: 90, windowMs: 10_000 });
const WRITE_COST = 2;
let pending: { path: string; search: string } | null = null;
// Back/Forward can land on older filters than storage's latest; deferred so a sheet's own popstate write lands first.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    HISTORY_BUDGET.note(1);
    setTimeout(() => {
      const q = reconcileQuery(currentSearch(), readKey(FILTERS_KEY));
      if (q !== null) replaceQuery(q);
    }, 0);
  });
}

export function currentSearch(): string {
  return pending && pending.path === window.location.pathname ? pending.search : window.location.search;
}

const readQuery = currentSearch;

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

function writePending() {
  const p = pending;
  pending = null;
  if (!p || p.path !== window.location.pathname) return;
  try {
    window.history.replaceState(null, "", p.search || p.path);
  } catch {}
}

// Not router.replace: that refetches from the server and scrolls.
export function replaceQuery(q: string): void {
  pending = { path: window.location.pathname, search: q ? `?${q}` : "" };
  HISTORY_BUDGET.run(writePending, WRITE_COST);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useQuery(): string {
  return useSyncExternalStore(subscribe, readQuery, () => "");
}

export function useBallotFilters({ guides, keep = [] }: { guides: FilterGuide[]; keep?: string[] }) {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, () => readKey(FILTERS_KEY), () => null);
  const keepKey = keep.join(",");
  const relevant = filterQuery(query, keepKey ? keepKey.split(",") : []);
  const filters = useMemo(() => initialFilters({ query: relevant, stored, guides }), [relevant, stored, guides]);

  const setFilters = useCallback(
    (f: Filters) => {
      const q = toQuery(f);
      writeKey(FILTERS_KEY, q);
      const p = new URLSearchParams(q);
      const current = new URLSearchParams(currentSearch());
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
      const p = new URLSearchParams(currentSearch());
      if (v === null) p.delete(name);
      else p.set(name, v);
      replaceQuery(p.toString());
    },
    [name],
  );
  return [value, set];
}

export function useStoredParam(name: string, storageKey: string): [string | null, (v: string) => void] {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, () => readKey(storageKey), () => null);
  const p = new URLSearchParams(query);
  const value = p.has(name) ? p.get(name) : stored;
  const set = useCallback(
    (v: string) => {
      writeKey(storageKey, v);
      const q = new URLSearchParams(currentSearch());
      if (v) q.set(name, v);
      else q.delete(name);
      replaceQuery(q.toString());
    },
    [name, storageKey],
  );
  return [value, set];
}

const CARRIED = ["off", "offtypes", "why", COUNTIES_PARAM];

export function useCarriedQuery(): string {
  return carryQuery(useQuery(), CARRIED);
}
