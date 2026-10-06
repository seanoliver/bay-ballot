import { describe, expect, it } from "vitest";
import { isTypingTarget, keyAction, keyPlace, keyTarget, OVERLAY, permits, readSingleKeys, stepSelection, writeSingleKeys } from "@/lib/keyboard";

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  defaultPrevented: false,
  ...mods,
});
const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable });
const body = el("BODY");

describe("keyAction", () => {
  it.each([
    ["ArrowDown", "next"],
    ["j", "next"],
    ["ArrowUp", "prev"],
    ["k", "prev"],
    ["/", "search"],
  ])("%s -> %s", (k, action) => {
    expect(keyAction(key(k), body)).toBe(action);
  });
  it("? (Shift+/) opens help", () => {
    expect(keyAction(key("?", { shiftKey: true }), body)).toBe("help");
  });
  it("ignores keys held with a modifier", () => {
    for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      expect(keyAction(key("ArrowDown", mods), body)).toBeNull();
      expect(keyAction(key("j", mods), body)).toBeNull();
    }
    expect(keyAction(key("J", { shiftKey: true }), body)).toBeNull();
    expect(keyAction(key("?", { shiftKey: true, metaKey: true }), body)).toBeNull();
  });
  it("ignores keys another handler already took", () => {
    expect(keyAction(key("ArrowDown", { defaultPrevented: true }), body)).toBeNull();
  });
  it("ignores everything while typing", () => {
    for (const t of [el("INPUT"), el("TEXTAREA"), el("SELECT"), el("DIV", true)]) {
      expect(keyAction(key("j"), t)).toBeNull();
      expect(keyAction(key("/"), t)).toBeNull();
      expect(keyAction(key("ArrowDown"), t)).toBeNull();
    }
  });
  it("other keys do nothing", () => {
    expect(keyAction(key("a"), body)).toBeNull();
    expect(keyAction(key("Tab"), body)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for form fields and editable content only", () => {
    expect(isTypingTarget(el("INPUT"))).toBe(true);
    expect(isTypingTarget(el("DIV", true))).toBe(true);
    expect(isTypingTarget(el("A"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("stepSelection", () => {
  const ids = ["a", "b", "c"];
  it("with nothing selected, next picks the first and prev does nothing", () => {
    expect(stepSelection(ids, null, "next")).toBe("a");
    expect(stepSelection(ids, null, "prev")).toBeNull();
  });
  it("moves one step and stops at the ends", () => {
    expect(stepSelection(ids, "a", "next")).toBe("b");
    expect(stepSelection(ids, "b", "prev")).toBe("a");
    expect(stepSelection(ids, "c", "next")).toBeNull();
    expect(stepSelection(ids, "a", "prev")).toBeNull();
  });
  it("a selection that isn't listed starts over from the top", () => {
    expect(stepSelection(ids, "gone", "next")).toBe("a");
  });
});

describe("keyPlace", () => {
  const at = (tagName: string, inside: string[] = []) => ({ tagName, closest: (sel: string) => (inside.some((s) => sel.includes(s)) ? {} : null) });
  it("an open overlay or a target inside one wins", () => {
    expect(keyPlace(at("BODY"), true)).toBe("overlay");
    expect(keyPlace(at("BUTTON", ["role=dialog"]), false)).toBe("overlay");
    expect(keyPlace(at("BUTTON", ["role=alertdialog"]), false)).toBe("overlay");
    expect(keyPlace(at("BUTTON", ["data-slot=popover-content"]), false)).toBe("overlay");
  });
  it("places body, the list, the detail pane, the filters and anything else", () => {
    expect(keyPlace(at("BODY"), false)).toBe("page");
    expect(keyPlace(null, false)).toBe("page");
    expect(keyPlace(at("A", ["data-keys=list"]), false)).toBe("list");
    expect(keyPlace(at("A", ["data-keys=pane", "data-keys=list"]), false)).toBe("pane");
    expect(keyPlace(at("BUTTON", ["aria-label=Filters"]), false)).toBe("filters");
    expect(keyPlace(at("A"), false)).toBe("other");
  });
});

describe("permits", () => {
  it("nothing works in an overlay or the filters", () => {
    for (const place of ["overlay", "filters"] as const) {
      for (const [action, k] of [["next", "j"], ["prev", "ArrowUp"], ["search", "/"], ["help", "?"]] as const) expect(permits(action, k, place, true)).toBe(false);
    }
  });
  it("j/k and arrows browse from the page or the list only", () => {
    expect(permits("next", "j", "page", true)).toBe(true);
    expect(permits("next", "ArrowDown", "list", true)).toBe(true);
    expect(permits("next", "j", "other", true)).toBe(false);
    expect(permits("prev", "ArrowUp", "other", true)).toBe(false);
  });
  it("in the detail pane j/k browse but arrows scroll", () => {
    expect(permits("next", "j", "pane", true)).toBe(true);
    expect(permits("prev", "k", "pane", true)).toBe(true);
    expect(permits("next", "ArrowDown", "pane", true)).toBe(false);
    expect(permits("prev", "ArrowUp", "pane", true)).toBe(false);
  });
  it("/ and ? work anywhere else", () => {
    for (const place of ["page", "list", "pane", "other"] as const) {
      expect(permits("search", "/", place, true)).toBe(true);
      expect(permits("help", "?", place, true)).toBe(true);
    }
  });
});

describe("round 2", () => {
  it("/ with Shift still searches; Shift only blocks arrows", () => {
    expect(keyAction(key("/", { shiftKey: true }), body)).toBe("search");
    expect(keyAction(key("ArrowDown", { shiftKey: true }), body)).toBeNull();
  });
  it("Escape is a close action", () => {
    expect(keyAction(key("Escape"), body)).toBe("close");
  });
  it("Escape closes from the page only; the list and pane handle their own", () => {
    expect(permits("close", "Escape", "page", true)).toBe(true);
    for (const place of ["list", "pane", "filters", "overlay", "other"] as const) expect(permits("close", "Escape", place, true)).toBe(false);
  });
  it("with single-key shortcuts off, j, k, / and ? do nothing but arrows and Escape still work", () => {
    expect(permits("next", "j", "page", false)).toBe(false);
    expect(permits("prev", "k", "list", false)).toBe(false);
    expect(permits("search", "/", "page", false)).toBe(false);
    expect(permits("help", "?", "page", false)).toBe(false);
    expect(permits("next", "ArrowDown", "list", false)).toBe(true);
    expect(permits("close", "Escape", "page", false)).toBe(true);
  });
  it("focus left behind in a closing overlay counts as the page", () => {
    const at = (inside: string) => ({ tagName: "BUTTON", closest: (sel: string) => (sel.includes(inside) ? {} : null) });
    expect(keyPlace(at("[role=dialog][data-closed]"), false)).toBe("page");
    expect(keyPlace(at("[data-slot=popover-content][data-closed]"), false)).toBe("page");
  });
  it("matches only open overlays", () => {
    for (const part of OVERLAY.split(",")) expect(part).toContain(":not([data-closed])");
  });
  it("after a click on plain text, the clicked element stands in for the body", () => {
    const b = { tagName: "BODY" };
    const p = { tagName: "P" };
    const a = { tagName: "A" };
    expect(keyTarget(b, p)).toBe(p);
    expect(keyTarget(null, p)).toBe(p);
    expect(keyTarget(a, p)).toBe(a);
    expect(keyTarget(b, null)).toBe(b);
  });
  it("reads and writes the single-key setting, defaulting to on and surviving a broken storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    expect(readSingleKeys(storage)).toBe(true);
    writeSingleKeys(storage, false);
    expect(readSingleKeys(storage)).toBe(false);
    writeSingleKeys(storage, true);
    expect(readSingleKeys(storage)).toBe(true);
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } };
    expect(readSingleKeys(broken)).toBe(true);
    expect(() => writeSingleKeys(broken, false)).not.toThrow();
    expect(readSingleKeys(null)).toBe(true);
  });
});
