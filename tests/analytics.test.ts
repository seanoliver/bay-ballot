import { describe, expect, it } from "vitest";
import { beforeSend, scrubUrl } from "@/lib/analytics";

describe("scrubUrl", () => {
  it("drops address, ZIP and search params and keeps the rest", () => {
    expect(scrubUrl("https://bayballot.com/2026-11?addr=1+Main+St&zip=94110&q=prop&c=prop-b&why=1")).toBe(
      "https://bayballot.com/2026-11?c=prop-b&why=1",
    );
  });
  it("matches param names case-insensitively", () => {
    expect(scrubUrl("https://bayballot.com/2026-11?ZIP=94110&Addr=x")).toBe("https://bayballot.com/2026-11");
  });
  it("leaves URLs without those params alone, hash included", () => {
    expect(scrubUrl("https://bayballot.com/2026-11?c=prop-b#top")).toBe("https://bayballot.com/2026-11?c=prop-b#top");
    expect(scrubUrl("https://bayballot.com/about")).toBe("https://bayballot.com/about");
  });
});

describe("beforeSend", () => {
  it("scrubs page views", () => {
    expect(beforeSend({ type: "pageview", url: "https://bayballot.com/?zip=94110" })).toEqual({ type: "pageview", url: "https://bayballot.com/" });
  });
  it("drops custom events (page views only)", () => {
    expect(beforeSend({ type: "event", url: "https://bayballot.com/" })).toBeNull();
  });
});
