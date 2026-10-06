"use client";

import { useEffect, useRef } from "react";
import { keyAction, keyPlace, keyTarget, OVERLAY, permits, type KeyAction } from "@/lib/keyboard";

export function useBallotKeys(onAction: (action: KeyAction) => boolean | void, { singleKeys }: { singleKeys: boolean }) {
  const handler = useRef(onAction);
  const single = useRef(singleKeys);
  useEffect(() => {
    handler.current = onAction;
    single.current = singleKeys;
  });
  useEffect(() => {
    let lastPointer: Element | null = null;
    const onPointer = (e: PointerEvent) => {
      lastPointer = e.target instanceof Element ? e.target : null;
    };
    const onFocus = () => {
      lastPointer = null;
    };
    const onKey = (e: KeyboardEvent) => {
      const target = keyTarget(document.activeElement, lastPointer?.isConnected ? lastPointer : null);
      const action = keyAction(e, target as HTMLElement | null);
      if (!action) return;
      const place = keyPlace(action === "close" ? document.activeElement : target, document.querySelector(OVERLAY) !== null);
      if (!permits(action, e.key, place, single.current)) return;
      if (handler.current(action) !== false) e.preventDefault();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
