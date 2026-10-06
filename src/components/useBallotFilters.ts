"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { FILTERS_KEY, initialFilters, toQuery, type Filters, type GuideInfo } from "@/lib/filters";
import { historyBudget } from "@/lib/history-budget";

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

// Counted in browser history calls, which throw past 100 in 10 seconds: Next adds a replaceState after each of our writes and after every popstate.
export const HISTORY_BUDGET = historyBudget({ max: 90, windowMs: 10_000 });
const WRITE_COST = 2;
if (typeof window !== "undefined") window.addEventListener("popstate", () => HISTORY_BUDGET.note(1));
let pending: { path: string; search: string } | null = null;

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
