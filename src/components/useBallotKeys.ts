"use client";

import { useEffect, useRef } from "react";
import { keyAction, keyPlace, OVERLAY, permits, type KeyAction } from "@/lib/keyboard";

export function useBallotKeys(onAction: (action: KeyAction) => boolean | void) {
  const handler = useRef(onAction);
  useEffect(() => {
    handler.current = onAction;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null;
      const action = keyAction(e, target);
      if (!action || !permits(action, e.key, keyPlace(target, document.querySelector(OVERLAY) !== null))) return;
      if (handler.current(action) !== false) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
