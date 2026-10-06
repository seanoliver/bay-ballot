"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLOSED, sheetStep, type SheetEvent } from "@/lib/sheet-history";
import { CHANGE_EVENT, currentSearch, HISTORY_BUDGET, replaceQuery } from "./useBallotFilters";

export function useHistorySheet(): [boolean, (open: boolean) => void] {
  const state = useRef(CLOSED);
  const [open, setOpenState] = useState(false);

  const step = useCallback((event: SheetEvent) => {
    const { state: next, effect } = sheetStep(state.current, event);
    state.current = next;
    setOpenState(next.open);
    if (effect?.type === "push") {
      HISTORY_BUDGET.note();
      window.history.pushState(null, "", window.location.href);
    }
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
    (next: boolean) => step(next ? { type: "open", search: currentSearch() } : { type: "dismiss" }),
    [step],
  );
  return [open, setOpen];
}
