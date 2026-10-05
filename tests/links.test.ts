import { describe, expect, it } from "vitest";
import { isPlainClick, pickSelected } from "@/lib/links";

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
  it("falls back to the first when none is requested or it is filtered away", () => {
    expect(pickSelected(ids, null)).toBe("prop-a");
    expect(pickSelected(ids, "sup-2")).toBe("prop-a");
  });
  it("nothing to select on an empty ballot", () => {
    expect(pickSelected([], "prop-b")).toBeUndefined();
  });
});
