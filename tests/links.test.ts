import { describe, expect, it } from "vitest";
import { isPlainClick, pickSelected, toggleSelection } from "@/lib/links";

const click = (over: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...over,
});

describe("isPlainClick", () => {
  it("a plain primary click may be intercepted", () => {
    expect(isPlainClick(click())).toBe(true);
  });
  it.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["middle button", { button: 1 }],
    ["already handled", { defaultPrevented: true }],
  ])("%s-click is left to the browser", (_, over) => {
    expect(isPlainClick(click(over))).toBe(false);
  });
});

describe("pickSelected", () => {
  const ids = ["prop-a", "prop-b", "sup-8"];
  it("keeps a requested contest that is on screen", () => {
    expect(pickSelected(ids, "prop-b")).toBe("prop-b");
  });
  it("nothing selected when none is requested", () => {
    expect(pickSelected(ids, null)).toBeNull();
  });
  it("nothing selected when the requested contest isn't on the ballot", () => {
    expect(pickSelected(ids, "sup-2")).toBeNull();
    expect(pickSelected([], "prop-b")).toBeNull();
  });
});

describe("toggleSelection", () => {
  it("selects a different contest", () => {
    expect(toggleSelection("prop-a", "prop-b")).toBe("prop-b");
    expect(toggleSelection(null, "prop-b")).toBe("prop-b");
  });
  it("clicking the selected contest again closes it", () => {
    expect(toggleSelection("prop-b", "prop-b")).toBeNull();
  });
});
