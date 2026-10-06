// The Punch-card B: a pixel-grid B made of square ballot holes, on a 16×16 grid.
// Punched holes are solid; unpunched ones are a faint tint so the card grid still reads.
const ROWS = ["1110", "1001", "1110", "1001", "1110"];

export type Hole = { x: number; y: number; on: boolean };

export const LOGO_VIEWBOX = 16;
export const HOLE = 2;
export const HOLE_RADIUS = 0.35;
export const OFF_OPACITY = 0.14;

export const HOLES: Hole[] = ROWS.flatMap((row, r) => [...row].map((c, k) => ({ x: 2 + k * 3, y: 1 + r * 3, on: c === "1" })));

// Standalone SVG markup (icons, scripts). `tile` draws a rounded background behind the mark.
export function logoSvg({ color, tile, size = 16 }: { color: string; tile?: string; size?: number }): string {
  const rects = HOLES.map(
    (h) => `<rect x="${h.x}" y="${h.y}" width="${HOLE}" height="${HOLE}" rx="${HOLE_RADIUS}"${h.on ? "" : ` opacity="${OFF_OPACITY}"`}/>`,
  ).join("");
  const bg = tile ? `<rect width="16" height="16" rx="3.5" fill="${tile}"/>` : "";
  // A tile shifts the (left-weighted) mark half a unit right so it sits centered in the square.
  const mark = tile ? `<g transform="translate(0.5 0)">${rects}</g>` : rects;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" fill="${color}" shape-rendering="crispEdges">${bg}${mark}</svg>`;
}
