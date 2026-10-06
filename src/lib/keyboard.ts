// Desktop shortcuts for the ballot list. Pure: the DOM wiring is useBallotKeys.

export type KeyAction = "next" | "prev" | "search" | "help";
export type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented: boolean };
export type TargetLike = { tagName: string; isContentEditable: boolean } | null;

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(t: TargetLike): boolean {
  return t !== null && (TYPING.has(t.tagName) || t.isContentEditable);
}

const PLAIN: Record<string, KeyAction> = { ArrowDown: "next", j: "next", ArrowUp: "prev", k: "prev", "/": "search" };

// Nothing while typing, with a modifier held, or for a key another handler already took.
// "?" is Shift+/ on most layouts, so Shift is allowed for it alone.
export function keyAction(e: KeyLike, target: TargetLike): KeyAction | null {
  if (e.defaultPrevented || isTypingTarget(target) || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === "?") return "help";
  if (e.shiftKey) return null;
  return PLAIN[e.key] ?? null;
}

// The contest to select next, or null to stay put (no wrap at the ends).
export function stepSelection(ids: string[], current: string | null, dir: "next" | "prev"): string | null {
  const i = current === null ? -1 : ids.indexOf(current);
  if (i === -1) return dir === "next" ? (ids[0] ?? null) : null;
  const j = dir === "next" ? i + 1 : i - 1;
  return j >= 0 && j < ids.length ? ids[j] : null;
}
