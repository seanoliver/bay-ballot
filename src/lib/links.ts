export type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };

// A row link may be taken over by JS only on a plain primary click; Cmd/Ctrl/Shift/Alt and
// middle clicks keep the browser's behavior (new tab, new window, download).
export function isPlainClick(e: ClickLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

// The contest to show: the requested one if it is on screen, else the first.
export function pickSelected(ids: string[], requested: string | null): string | undefined {
  return requested !== null && ids.includes(requested) ? requested : ids[0];
}
