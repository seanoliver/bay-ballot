"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { initialFilters, toQuery, type Filters, type GuideInfo } from "@/lib/filters";
import type { Ballot } from "@/lib/schema";

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

// Native replaceState syncs with the Next router without a server round trip or scroll.
function replaceQuery(q: string) {
  window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The URL's search string; "" on the server and during hydration.
export function useQuery(): string {
  return useSyncExternalStore(subscribe, readQuery, () => "");
}

// Filters live in the URL, falling back to the last filters saved on this device. `keep` names
// non-filter params (like a selected contest) that survive a filter change.
export function useBallotFilters({ ballot, guides, keep = [] }: { ballot: Ballot; guides: GuideInfo[]; keep?: string[] }) {
  const query = useQuery();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const filters = useMemo(() => initialFilters({ query, stored, ballot, guides }), [query, stored, ballot, guides]);
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

// A single non-filter URL param (e.g. ?c=prop-b) and its setter; null removes it.
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
