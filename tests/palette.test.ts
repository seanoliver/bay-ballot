import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FILL } from "@/components/share/ShareFrame";

const css = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
const darkAt = css.indexOf("\n@media (prefers-color-scheme: dark) {");
const tokens = (block: string) =>
  Object.fromEntries([...block.matchAll(/--(bar-[1-4]|yes-fill|no-fill):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2].toLowerCase()]));
const light = tokens(css.slice(0, darkAt));
const dark = tokens(css.slice(darkAt));
const SLOTS = ["bar-1", "bar-2", "bar-3", "bar-4"] as const;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
// HSL hue in degrees, or -1 for a gray: slate and other low-saturation colors carry no party hue.
function hue(hex: string): number {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const saturation = d === 0 ? 0 : d / (1 - Math.abs(max + min - 1));
  if (saturation < 0.35) return -1;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("candidate slot palette", () => {
  it("reads every slot token in light and dark mode", () => {
    for (const mode of [light, dark]) for (const s of SLOTS) expect(mode[s]).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("matches the share images to the light theme", () => {
    expect([FILL.c1, FILL.c2, FILL.c3, FILL.c4].map((c) => c.toLowerCase())).toEqual(SLOTS.map((s) => light[s]));
  });
  it("never uses a blue or red hue, which read as party colors", () => {
    for (const mode of [light, dark]) {
      for (const s of SLOTS) {
        const h = hue(mode[s]);
        expect(h >= 190 && h <= 240, `${s} ${mode[s]} is blue`).toBe(false);
        expect(h >= 330 || (h >= 0 && h <= 20), `${s} ${mode[s]} is red or pink`).toBe(false);
      }
    }
  });
  it("keeps slots apart from the Yes and No fills", () => {
    for (const mode of [light, dark]) for (const s of SLOTS) expect([mode["yes-fill"], mode["no-fill"]]).not.toContain(mode[s]);
  });
  it("separates slots 3 and 4 by lightness, so red-green colorblind readers can tell them apart", () => {
    for (const mode of [light, dark]) expect(contrast(mode["bar-3"], mode["bar-4"])).toBeGreaterThanOrEqual(1.5);
  });
});
