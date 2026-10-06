// Generates the app icons and the social image from the Punch-card B (src/lib/logo.ts).
// Run: npx tsx scripts/icons.ts — then commit the files it writes under src/app/.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { HOLE, HOLE_RADIUS, HOLES, OFF_OPACITY, logoSvg } from "../src/lib/logo";

const APP = path.join(process.cwd(), "src/app");
const INK = "#171717"; // --foreground (light)
const PAPER = "#fafafa";
const MUTED = "#666666"; // --muted-foreground (light)

// Geist ships with Next (the dev overlay's copy); embedding it keeps the social image on-brand offline.
const geist = readFileSync(path.join(process.cwd(), "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2")).toString("base64");

const markOnly = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 0.5 13 15" fill="${color}">${HOLES.map(
    (h) => `<rect x="${h.x}" y="${h.y}" width="${HOLE}" height="${HOLE}" rx="${HOLE_RADIUS}"${h.on ? "" : ` opacity="${OFF_OPACITY}"`}/>`,
  ).join("")}</svg>`;

function ico(png: Buffer, size: number): Buffer {
  // One PNG-compressed image in an ICO container (supported by every current browser).
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset
  return Buffer.concat([header, png]);
}

const ogHtml = `<!doctype html><html><head><style>
@font-face { font-family: Geist; src: url(data:font/woff2;base64,${geist}) format("woff2"); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Geist, sans-serif; background: ${PAPER}; color: ${INK}; display: flex; flex-direction: column; }
.band { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 96px; }
.brand { display: flex; align-items: center; gap: 36px; }
.brand svg { width: 132px; height: 152px; }
.word { font-size: 112px; font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
.line { margin-top: 48px; font-size: 32px; line-height: 1.3; color: ${MUTED}; white-space: nowrap; }
.rule { display: flex; gap: 6px; height: 14px; }
.rule span { background: ${INK}; }
</style></head><body>
<div class="band">
  <div class="brand">${markOnly(INK)}<div class="word">Bay Ballot</div></div>
  <p class="line">Every San Francisco voter guide in one place · November 3, 2026</p>
</div>
<div class="rule"><span style="flex:62"></span><span style="flex:24;opacity:.55"></span><span style="flex:14;opacity:.25"></span></div>
</body></html>`;

async function main() {
  const svgTile = logoSvg({ color: PAPER, tile: INK, size: 32 });
  writeFileSync(path.join(APP, "icon.svg"), `${svgTile}\n`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  // A roomy viewport, clipped to the icon: Chromium won't lay out a 32px-wide window as asked.
  const shoot = async (html: string, w: number, h: number, transparent: boolean) => {
    await page.setViewportSize({ width: 400, height: 400 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${w}px;height:${h}px;line-height:0">${html}</div></body></html>`);
    return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  };

  const png32 = await shoot(logoSvg({ color: PAPER, tile: INK, size: 32 }), 32, 32, true);
  writeFileSync(path.join(APP, "icon1.png"), png32);
  writeFileSync(path.join(APP, "favicon.ico"), ico(png32, 32));

  // Apple touch icon: opaque square (iOS rounds it), mark centered with generous padding.
  const apple = `<div style="width:180px;height:180px;background:${INK};display:flex;align-items:center;justify-content:center">
    <div style="width:104px;height:120px">${markOnly(PAPER).replace("<svg ", '<svg width="104" height="120" ')}</div></div>`;
  writeFileSync(path.join(APP, "apple-icon.png"), await shoot(apple, 180, 180, false));

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(path.join(APP, "opengraph-image.png"), await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));
  writeFileSync(path.join(APP, "opengraph-image.alt.txt"), "Bay Ballot: every San Francisco voter guide in one place, November 3, 2026\n");

  await browser.close();
}

main();
