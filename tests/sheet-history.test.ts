import { describe, expect, it } from "vitest";
import { CLOSED, sheetStep } from "@/lib/sheet-history";

const OPEN = { open: true, pushed: true };

describe("sheetStep", () => {
  it("opening pushes a history entry", () => {
    expect(sheetStep(CLOSED, "open")).toEqual({ state: OPEN, effect: "push" });
  });
  it("opening an open sheet does nothing", () => {
    expect(sheetStep(OPEN, "open")).toEqual({ state: OPEN, effect: null });
  });
  it("closing from the UI (X, Escape, backdrop) goes back over the pushed entry", () => {
    expect(sheetStep(OPEN, "dismiss")).toEqual({ state: CLOSED, effect: "back" });
  });
  it("Back (popstate) closes without navigating again", () => {
    expect(sheetStep(OPEN, "popstate")).toEqual({ state: CLOSED, effect: null });
  });
  it("the popstate that follows our own back() is a no-op (no double navigation)", () => {
    const { state } = sheetStep(OPEN, "dismiss");
    expect(sheetStep(state, "popstate")).toEqual({ state: CLOSED, effect: null });
  });
  it("dismissing a sheet that never pushed just closes", () => {
    expect(sheetStep({ open: true, pushed: false }, "dismiss")).toEqual({ state: CLOSED, effect: null });
  });
  it("dismissing a closed sheet does nothing", () => {
    expect(sheetStep(CLOSED, "dismiss")).toEqual({ state: CLOSED, effect: null });
  });
});
