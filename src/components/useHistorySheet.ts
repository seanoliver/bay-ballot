"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLOSED, sheetStep, type SheetEvent } from "@/lib/sheet-history";

// Open/close state for a phone sheet that the Back button closes (see lib/sheet-history).
export function useHistorySheet(): [boolean, (open: boolean) => void] {
  const state = useRef(CLOSED);
  const [open, setOpenState] = useState(false);

  const step = useCallback((event: SheetEvent) => {
    const { state: next, effect } = sheetStep(state.current, event);
    state.current = next;
    setOpenState(next.open);
    // Native pushState syncs with the Next router; the entry keeps the current URL.
    if (effect === "push") window.history.pushState(null, "", window.location.href);
    if (effect === "back") window.history.back();
  }, []);

  useEffect(() => {
    const onPop = () => step("popstate");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step]);

  const setOpen = useCallback((next: boolean) => step(next ? "open" : "dismiss"), [step]);
  return [open, setOpen];
}
