// Phone sheets push a history entry on open, so Back closes them. URL changes made while a sheet is
// open (filters) land on that pushed entry, so whichever way the sheet closes, they are copied onto
// the entry it returns to. `latest` is the URL while open; `restore` is what to copy after our own back().
export type SheetState = { open: boolean; pushed: boolean; openedWith?: string; latest?: string; restore?: string | null };
export type SheetEvent = { type: "open"; search: string } | { type: "change"; search: string } | { type: "dismiss" } | { type: "popstate" };
export type SheetEffect = { type: "push" } | { type: "back" } | { type: "replace"; search: string } | null;
export const CLOSED: SheetState = { open: false, pushed: false };

const changed = (s: SheetState) => (s.latest !== undefined && s.latest !== s.openedWith ? s.latest : null);

export function sheetStep(state: SheetState, event: SheetEvent): { state: SheetState; effect: SheetEffect } {
  switch (event.type) {
    case "open":
      if (state.open) return { state, effect: null };
      return { state: { open: true, pushed: true, openedWith: event.search, latest: event.search, restore: null }, effect: { type: "push" } };
    case "change":
      return state.open ? { state: { ...state, latest: event.search }, effect: null } : { state, effect: null };
    case "dismiss":
      if (!state.open) return { state: CLOSED, effect: null };
      if (!state.pushed) return { state: CLOSED, effect: null };
      return { state: { ...CLOSED, ...(changed(state) ? { restore: changed(state) } : {}) }, effect: { type: "back" } };
    case "popstate": {
      // Back pressed with the sheet open, or the popstate from our own back() after a dismiss.
      const search = state.open ? changed(state) : (state.restore ?? null);
      return { state: CLOSED, effect: search === null ? null : { type: "replace", search } };
    }
  }
}
