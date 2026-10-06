import { describe, expect, it } from "vitest";
import { isTypingTarget, keyAction, stepSelection } from "@/lib/keyboard";

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
