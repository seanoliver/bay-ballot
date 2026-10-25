"use client";

import { useCallback, useSyncExternalStore } from "react";
import { EMPTY_BALLOT, myBallotKey, parseMyBallot, type MyBallot } from "@/lib/my-ballot";

const CHANGE = "bb-ballot-change";

const memory = new Map<string, string | null>();
let blocked = false;
// Parsed once per raw value, so useSyncExternalStore gets the same object until something changes.
const parsed = new Map<string, { raw: string | null; ballot: MyBallot }>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, raw: string | null) {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    blocked = raw !== null;
    memory.set(key, raw);
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(key: string): MyBallot {
  const raw = read(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.ballot;
  const ballot = parseMyBallot(raw);
  parsed.set(key, { raw, ballot });
  return ballot;
}

export type BallotUpdate = (current: MyBallot) => MyBallot | null;

export function useMyBallot(election: string): { ballot: MyBallot | null; update: (change: BallotUpdate) => void; saved: boolean } {
  const key = myBallotKey(election);
  const ballot = useSyncExternalStore(subscribe, () => snapshot(key), () => null);
  const saved = useSyncExternalStore(subscribe, () => !blocked, () => true);
  // Applied to what storage holds now, so a tab that missed another tab's write can't overwrite it.
  const update = useCallback(
    (change: BallotUpdate) => {
      const next = change(snapshot(key));
      write(key, next === null || next === EMPTY_BALLOT ? null : JSON.stringify(next));
    },
    [key],
  );
  return { ballot, update, saved };
}
