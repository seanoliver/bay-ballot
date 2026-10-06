export type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };

export function isPlainClick(e: ClickLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

export function pickSelected(ids: string[], requested: string | null): string | null {
  return requested !== null && ids.includes(requested) ? requested : null;
}

export function toggleSelection(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}
