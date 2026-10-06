export type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };

// A row link may be taken over by JS only on a plain primary click; Cmd/Ctrl/Shift/Alt and
// middle clicks keep the browser's behavior (new tab, new window, download).
export function isPlainClick(e: ClickLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

// The contest to show in the desktop pane: the requested one if it's on the ballot, else none (pane closed).
export function pickSelected(ids: string[], requested: string | null): string | null {
  return requested !== null && ids.includes(requested) ? requested : null;
}

// Clicking the selected contest again closes the pane.
export function toggleSelection(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}
