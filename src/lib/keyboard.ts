export type KeyAction = "next" | "prev" | "search" | "help";
export type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented: boolean };
export type TargetLike = { tagName: string; isContentEditable: boolean } | null;

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(t: TargetLike): boolean {
  return t !== null && (TYPING.has(t.tagName) || t.isContentEditable);
}

const PLAIN: Record<string, KeyAction> = { ArrowDown: "next", j: "next", ArrowUp: "prev", k: "prev", "/": "search" };

export function keyAction(e: KeyLike, target: TargetLike): KeyAction | null {
  if (e.defaultPrevented || isTypingTarget(target) || e.metaKey || e.ctrlKey || e.altKey) return null;
  // Before the Shift check: "?" is Shift+/ on most layouts.
  if (e.key === "?") return "help";
  if (e.shiftKey) return null;
  return PLAIN[e.key] ?? null;
}

export function stepSelection(ids: string[], current: string | null, dir: "next" | "prev"): string | null {
  const i = current === null ? -1 : ids.indexOf(current);
  if (i === -1) return dir === "next" ? (ids[0] ?? null) : null;
  const j = dir === "next" ? i + 1 : i - 1;
  return j >= 0 && j < ids.length ? ids[j] : null;
}

export type KeyPlace = "page" | "list" | "pane" | "filters" | "overlay" | "other";

export const OVERLAY = "[role=dialog], [role=alertdialog], [data-slot=popover-content]";

type Placeable = { tagName: string; closest(selector: string): unknown };

export function keyPlace(target: Placeable | null, overlayOpen: boolean): KeyPlace {
  if (overlayOpen || target?.closest(OVERLAY)) return "overlay";
  if (!target || target.tagName === "BODY") return "page";
  if (target.closest("[data-keys=pane]")) return "pane";
  if (target.closest("[data-keys=list]")) return "list";
  if (target.closest("aside[aria-label=Filters]")) return "filters";
  return "other";
}

const ARROWS = new Set(["ArrowDown", "ArrowUp"]);

export function permits(action: KeyAction, key: string, place: KeyPlace): boolean {
  if (place === "overlay" || place === "filters") return false;
  if (action === "search" || action === "help") return true;
  if (place === "pane") return !ARROWS.has(key);
  return place === "page" || place === "list";
}
