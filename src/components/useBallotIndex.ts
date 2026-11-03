"use client";

import { useEffect, useState } from "react";
import { SEEN_KEY } from "@/lib/home-redirect";
import type { MyBallotIndex } from "@/lib/my-ballot";

const indexes = new Map<string, Promise<MyBallotIndex>>();
function loadIndex(url: string): Promise<MyBallotIndex> {
  let p = indexes.get(url);
  if (!p) {
    // Not AbortSignal.timeout: Safari added it only in 16.
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 15_000);
    p = fetch(url, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json() as Promise<MyBallotIndex>;
      })
      .finally(() => window.clearTimeout(timer));
    // A failure isn't kept, so Try again fetches again.
    p.catch(() => indexes.delete(url));
    indexes.set(url, p);
  }
  return p;
}

// Its own key: the home page writes "bay-area" to SEEN_KEY, which would forget the voter's area.
export const AREA_KEY = "bb-ballot-area";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Client only: reads localStorage. */
export const storedAreas = () => [read(AREA_KEY), read(SEEN_KEY)];

export const chosenArea = () => read(AREA_KEY);

export const OPEN_BALLOT = "bb-open-ballot";

export function useBallotIndex(url: string, enabled: boolean, { retryKey = "" }: { retryKey?: string } = {}): { index: MyBallotIndex | null; failed: boolean; retry: () => void } {
  const [index, setIndex] = useState<MyBallotIndex | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === retryKey;
  useEffect(() => {
    if (!enabled || index || failed) return;
    let live = true;
    loadIndex(url).then(
      (x) => live && setIndex(x),
      () => live && setFailedFor(retryKey),
    );
    return () => {
      live = false;
    };
  }, [enabled, index, failed, retryKey, url]);
  return { index, failed, retry: () => setFailedFor(null) };
}
