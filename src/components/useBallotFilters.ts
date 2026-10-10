"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { carryQuery, FILTERS_KEY, filterQuery, initialFilters, toQuery, type FilterGuide, type Filters } from "@/lib/filters";
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

// The Counties filter's saved choice, from before the area chips replaced it.
if (typeof window !== "undefined")
  try {
    window.localStorage.removeItem("bb-counties");
  } catch {
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

/** Moves to another list page without a navigation; false when the history budget is spent. */
export function pushPath(href: string): boolean {
  if (!HISTORY_BUDGET.tryNote(WRITE_COST)) return false;
  try {
    window.history.pushState(null, "", href);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

// Read from location, since usePathname updates in a transition a frame after the query. Subscribing to it still
// re-renders on router navigations, whose history writes fire no event.
export function useLocationPath(serverPath: string): string {
  usePathname();
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => serverPath);
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

// Holds choices the browser won't store; registered before any subscriber so another tab's write clears it first.
const memo = new Map<string, string>();
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === null) memo.clear();
    else memo.delete(e.key);
  });

export function useStoredKey(storageKey: string): [string | null, (v: string) => void] {
  const value = useSyncExternalStore(subscribe, () => memo.get(storageKey) ?? readKey(storageKey), () => null);
  const set = useCallback(
    (v: string) => {
      memo.set(storageKey, v);
      writeKey(storageKey, v);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storageKey],
  );
  return [value, set];
}

export const CARRIED = ["off", "offtypes", "why"];

export function useCarriedQuery(): string {
  return carryQuery(useQuery(), CARRIED);
}
