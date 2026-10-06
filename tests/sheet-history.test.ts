import { describe, expect, it } from "vitest";
import { CLOSED, sheetStep, type SheetState } from "@/lib/sheet-history";

const opened = (search = "?off=a"): SheetState => sheetStep(CLOSED, { type: "open", search }).state;

describe("sheetStep", () => {
  it("opening pushes a history entry and remembers the URL it opened on", () => {
    expect(sheetStep(CLOSED, { type: "open", search: "?off=a" })).toEqual({
      state: { open: true, pushed: true, openedWith: "?off=a", latest: "?off=a", restore: null },
      effect: { type: "push" },
    });
  });
  it("opening an open sheet does nothing", () => {
    const s = opened();
    expect(sheetStep(s, { type: "open", search: "?x" })).toEqual({ state: s, effect: null });
  });
  it("closing from the UI goes back over the pushed entry", () => {
    expect(sheetStep(opened(), { type: "dismiss" })).toEqual({ state: CLOSED, effect: { type: "back" } });
  });
  it("Back (popstate) closes without navigating again", () => {
    expect(sheetStep(opened(), { type: "popstate" })).toEqual({ state: CLOSED, effect: null });
  });
  it("the popstate that follows our own back() is a no-op when nothing changed", () => {
    const { state } = sheetStep(opened(), { type: "dismiss" });
    expect(sheetStep(state, { type: "popstate" })).toEqual({ state: CLOSED, effect: null });
  });
  it("dismissing a closed sheet does nothing", () => {
    expect(sheetStep(CLOSED, { type: "dismiss" })).toEqual({ state: CLOSED, effect: null });
  });

  describe("URL changes made while the sheet is open", () => {
    const changed = () => sheetStep(opened("?off=a"), { type: "change", search: "?off=a&why=1" }).state;
    it("are tracked while open and ignored while closed", () => {
      expect(changed().latest).toBe("?off=a&why=1");
      expect(sheetStep(CLOSED, { type: "change", search: "?x" })).toEqual({ state: CLOSED, effect: null });
    });
    it("survive closing from the UI: back, then put them on the entry back() lands on", () => {
      const { state, effect } = sheetStep(changed(), { type: "dismiss" });
      expect(effect).toEqual({ type: "back" });
      expect(sheetStep(state, { type: "popstate" })).toEqual({ state: CLOSED, effect: { type: "replace", search: "?off=a&why=1" } });
    });
    it("survive the Back button", () => {
      expect(sheetStep(changed(), { type: "popstate" })).toEqual({ state: CLOSED, effect: { type: "replace", search: "?off=a&why=1" } });
    });
    it("changes undone before closing leave the URL alone", () => {
      const back = sheetStep(changed(), { type: "change", search: "?off=a" }).state;
      expect(sheetStep(back, { type: "popstate" })).toEqual({ state: CLOSED, effect: null });
    });
  });
});

describe("sheetStep with the history budget", () => {
  it("opens without a history entry when the budget can't take a push", () => {
    expect(sheetStep(CLOSED, { type: "open", search: "?off=a", push: false })).toEqual({
      state: { open: true, pushed: false, openedWith: "?off=a", latest: "?off=a", restore: null },
      effect: null,
    });
    const s = sheetStep(CLOSED, { type: "open", search: "?off=a", push: false }).state;
    expect(sheetStep(s, { type: "dismiss" })).toEqual({ state: CLOSED, effect: null });
  });
  it("opened while a write is pending, dismissing replays the pending query on the entry back() reveals", () => {
    const { state } = sheetStep(CLOSED, { type: "open", search: "?off=a", latest: "?off=a&why=1" });
    const { state: closed, effect } = sheetStep(state, { type: "dismiss" });
    expect(effect).toEqual({ type: "back" });
    expect(sheetStep(closed, { type: "popstate" }).effect).toEqual({ type: "replace", search: "?off=a&why=1" });
  });
});
