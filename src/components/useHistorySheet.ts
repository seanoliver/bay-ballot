"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLOSED, sheetStep, type SheetEvent } from "@/lib/sheet-history";
import { CHANGE_EVENT, currentSearch, HISTORY_BUDGET, replaceQuery } from "./useBallotFilters";

/** `leave` closes without stepping back, for a navigation away; it returns whether the sheet had pushed a history entry. */
export function useHistorySheet(): [boolean, (open: boolean) => void, () => boolean] {
  const state = useRef(CLOSED);
  const [open, setOpenState] = useState(false);

  const step = useCallback((event: SheetEvent) => {
    const { state: next, effect } = sheetStep(state.current, event);
    state.current = next;
    setOpenState(next.open);
    if (effect?.type === "push") window.history.pushState(null, "", window.location.href);
    if (effect?.type === "back") window.history.back();
    if (effect?.type === "replace") replaceQuery(effect.search.replace(/^\?/, ""));
  }, []);

  useEffect(() => {
    const onPop = () => step({ type: "popstate" });
    const onChange = () => step({ type: "change", search: currentSearch() });
    window.addEventListener("popstate", onPop);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [step]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) return step({ type: "dismiss" });
      const push = !state.current.open && HISTORY_BUDGET.tryNote(2);
      step({ type: "open", search: window.location.search, latest: currentSearch(), push });
    },
    [step],
  );
  const leave = useCallback(() => {
    const pushed = state.current.open && state.current.pushed;
    state.current = CLOSED;
    setOpenState(false);
    return pushed;
  }, []);
  return [open, setOpen, leave];
}
