import { describe, expect, it } from "vitest";
import { isTypingTarget, keyAction, keyPlace, permits, stepSelection } from "@/lib/keyboard";

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
    for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }]) {
      expect(keyAction(key("ArrowDown", mods), body)).toBeNull();
      expect(keyAction(key("j", mods), body)).toBeNull();
    }
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
    expect(keyAction(key("Escape"), body)).toBeNull();
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
      for (const [action, k] of [["next", "j"], ["prev", "ArrowUp"], ["search", "/"], ["help", "?"]] as const) expect(permits(action, k, place)).toBe(false);
    }
  });
  it("j/k and arrows browse from the page or the list only", () => {
    expect(permits("next", "j", "page")).toBe(true);
    expect(permits("next", "ArrowDown", "list")).toBe(true);
    expect(permits("next", "j", "other")).toBe(false);
    expect(permits("prev", "ArrowUp", "other")).toBe(false);
  });
  it("in the detail pane j/k browse but arrows scroll", () => {
    expect(permits("next", "j", "pane")).toBe(true);
    expect(permits("prev", "k", "pane")).toBe(true);
    expect(permits("next", "ArrowDown", "pane")).toBe(false);
    expect(permits("prev", "ArrowUp", "pane")).toBe(false);
  });
  it("/ and ? work anywhere else", () => {
    for (const place of ["page", "list", "pane", "other"] as const) {
      expect(permits("search", "/", place)).toBe(true);
      expect(permits("help", "?", place)).toBe(true);
    }
  });
});
