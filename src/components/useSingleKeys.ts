"use client";

import { useSyncExternalStore } from "react";
import { readSingleKeys, writeSingleKeys } from "@/lib/keyboard";

const CHANGE = "bb-single-keys-change";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSingleKeys(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => readSingleKeys(storage()), () => true);
  const set = (next: boolean) => {
    writeSingleKeys(storage(), next);
    window.dispatchEvent(new Event(CHANGE));
  };
  return [on, set];
}
