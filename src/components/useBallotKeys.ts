"use client";

import { useEffect, useRef } from "react";
import { keyAction, type KeyAction } from "@/lib/keyboard";

export function useBallotKeys(onAction: (action: KeyAction) => boolean | void) {
  const handler = useRef(onAction);
  useEffect(() => {
    handler.current = onAction;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e, document.activeElement as HTMLElement | null);
      if (action && handler.current(action) !== false) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
