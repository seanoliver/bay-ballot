export type KeyAction = "next" | "prev" | "search" | "help" | "close" | "jump";
export type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented: boolean };
export type TargetLike = { tagName: string; isContentEditable: boolean } | null;

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(t: TargetLike): boolean {
  return t !== null && (TYPING.has(t.tagName) || t.isContentEditable);
}

const PLAIN: Record<string, KeyAction> = { ArrowDown: "next", j: "next", ArrowUp: "prev", k: "prev", "/": "search", "?": "help", g: "jump", Escape: "close" };
const ARROWS = new Set(["ArrowDown", "ArrowUp"]);

export function keyAction(e: KeyLike, target: TargetLike): KeyAction | null {
  if (e.defaultPrevented || isTypingTarget(target) || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.shiftKey && ARROWS.has(e.key)) return null;
  return PLAIN[e.key] ?? null;
}

export function stepSelection(ids: string[], current: string | null, dir: "next" | "prev"): string | null {
  const i = current === null ? -1 : ids.indexOf(current);
  if (i === -1) return dir === "next" ? (ids[0] ?? null) : null;
  const j = dir === "next" ? i + 1 : i - 1;
  return j >= 0 && j < ids.length ? ids[j] : null;
}

export type KeyPlace = "page" | "list" | "pane" | "filters" | "overlay" | "other";

export const OVERLAY =
  "[role=dialog]:not([data-closed]), [role=alertdialog]:not([data-closed]), [role=menu]:not([data-closed]), [data-slot=popover-content]:not([data-closed])";

const CLOSING = "[role=dialog][data-closed], [role=alertdialog][data-closed], [role=menu][data-closed], [data-slot=popover-content][data-closed]";

type Placeable = { tagName: string; closest(selector: string): unknown };

export function keyPlace(target: Placeable | null, overlayOpen: boolean): KeyPlace {
  if (overlayOpen || target?.closest(OVERLAY)) return "overlay";
  if (!target || target.tagName === "BODY" || target.closest(CLOSING)) return "page";
  if (target.closest("[data-keys=pane]")) return "pane";
  if (target.closest("[data-keys=list]")) return "list";
  if (target.closest("aside[aria-label=Filters]")) return "filters";
  return "other";
}

export function keyTarget<T extends { tagName: string }>(active: T | null, lastPointer: T | null): T | null {
  return (active === null || active.tagName === "BODY") && lastPointer ? lastPointer : active;
}

export function permits(action: KeyAction, key: string, place: KeyPlace, singleKeys: boolean): boolean {
  if (place === "overlay" || place === "filters") return false;
  if (action === "close") return place === "page";
  if (!singleKeys && key.length === 1) return false;
  if (action === "search" || action === "help" || action === "jump") return true;
  if (place === "pane") return !ARROWS.has(key);
  return place === "page" || place === "list";
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const SINGLE_KEYS = "bb-single-keys";

export function readSingleKeys(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(SINGLE_KEYS) !== "off";
  } catch {
    return true;
  }
}

export function writeSingleKeys(storage: StorageLike | null, on: boolean): void {
  try {
    if (on) storage?.removeItem(SINGLE_KEYS);
    else storage?.setItem(SINGLE_KEYS, "off");
  } catch {}
}

type Trailing<T> = { push: (value: T) => void; cancel: () => void; flush: () => void; flushIfDue: () => void };

export function trailing<T>(ms: number, run: (value: T) => void): Trailing<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | null = null;
  let lastWrite = -Infinity;
  const write = () => {
    clearTimeout(timer);
    timer = undefined;
    const p = pending;
    if (!p) return;
    pending = null;
    lastWrite = Date.now();
    run(p.value);
  };
  return {
    push(value) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(write, ms);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      pending = null;
    },
    flush: write,
    flushIfDue() {
      if (pending && Date.now() - lastWrite >= ms) write();
    },
  };
}
