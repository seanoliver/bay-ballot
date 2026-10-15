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

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklab([r, g, b]: number[]): [number, number, number] {
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const labOf = (hex: string) => oklab(channels(hex).map(linear));
// Machado 2009 deuteranopia matrix, applied in linear RGB.
const DEUTAN = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];
function deutanLab(hex: string) {
  const rgb = channels(hex).map(linear);
  const seen = DEUTAN.map((row) => Math.min(1, Math.max(0, row.reduce((sum, k, i) => sum + k * rgb[i], 0))));
  return oklab(seen);
}
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// OKLCH hue in degrees, or -1 for a near-gray: slate carries no party hue.
function hue(hex: string): number {
  const [, a, b] = labOf(hex);
  if (Math.hypot(a, b) < 0.05) return -1;
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}
// Blue stops at 280: violet slot 1 sits at 284 to 287, so a higher bound would flag the shipped palette.
const isBlueHue = (h: number) => h >= 215 && h <= 280;
const isRedHue = (h: number) => h >= 330 || (h >= 0 && h <= 40);
const isBlue = (hex: string) => isBlueHue(hue(hex));
const isRed = (hex: string) => isRedHue(hue(hex));

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("party hue check", () => {
  it("catches the old party colors and passes slate as gray", () => {
    for (const blue of ["#2a78d6", "#3987e5"]) expect(isBlue(blue)).toBe(true);
    for (const pink of ["#e87ba4", "#d55181"]) expect(isRed(pink)).toBe(true);
    expect(hue("#334155")).toBe(-1);
  });
  it("draws each range's bounds exactly", () => {
    expect([214.9, 215, 280, 280.1].map(isBlueHue)).toEqual([false, true, true, false]);
    expect([329.9, 330, 0, 40, 40.1].map(isRedHue)).toEqual([false, true, true, true, false]);
    expect(isBlueHue(-1) || isRedHue(-1)).toBe(false);
  });
  it("counts a muted navy as blue, so the gray cutoff stays low", () => {
    expect(isBlue("#5b6b8f")).toBe(true);
  });
  it("catches reds and blues near the edges of each range", () => {
    for (const red of ["#ff2200", "#cc2200", "#ff4500"]) expect(isRed(red), red).toBe(true);
    for (const blue of ["#00aacc", "#0ea5e9", "#4a40e0"]) expect(isBlue(blue), blue).toBe(true);
    for (const slot of ["#e08a2a", "#0f8a8a"]) expect(isRed(slot) || isBlue(slot), slot).toBe(false);
  });
});

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
        expect(isBlue(mode[s]), `${s} ${mode[s]} is blue`).toBe(false);
        expect(isRed(mode[s]), `${s} ${mode[s]} is red or pink`).toBe(false);
      }
    }
  });
  it("keeps every pair of slots visibly apart", () => {
    for (const mode of [light, dark]) {
      for (const [i, a] of SLOTS.entries()) {
        for (const b of SLOTS.slice(i + 1)) expect(distance(labOf(mode[a]), labOf(mode[b])), `${a} vs ${b}`).toBeGreaterThanOrEqual(0.1);
      }
    }
  });
  it("keeps slots visibly apart from the Yes and No fills, also for red-green colorblind readers", () => {
    for (const mode of [light, dark]) {
      for (const s of SLOTS) {
        for (const fill of [mode["yes-fill"], mode["no-fill"]]) {
          expect(distance(labOf(mode[s]), labOf(fill)), `${s} vs ${fill}`).toBeGreaterThanOrEqual(0.1);
          expect(distance(deutanLab(mode[s]), deutanLab(fill)), `${s} vs ${fill}, deuteranopia`).toBeGreaterThanOrEqual(0.06);
        }
      }
    }
  });
  it("separates slots 3 and 4 by lightness, so red-green colorblind readers can tell them apart", () => {
    for (const mode of [light, dark]) expect(contrast(mode["bar-3"], mode["bar-4"])).toBeGreaterThanOrEqual(1.5);
  });
});
