export type SheetState = { open: boolean; pushed: boolean };
export type SheetEvent = "open" | "dismiss" | "popstate";
export const CLOSED: SheetState = { open: false, pushed: false };

export function sheetStep(state: SheetState, event: SheetEvent): { state: SheetState; effect: "push" | "back" | null } {
  if (event === "open") return state.open ? { state, effect: null } : { state: { open: true, pushed: true }, effect: "push" };
  if (!state.open) return { state: CLOSED, effect: null };
  // dismiss: undo our own entry; popstate: the browser already went back.
  return { state: CLOSED, effect: event === "dismiss" && state.pushed ? "back" : null };
}
