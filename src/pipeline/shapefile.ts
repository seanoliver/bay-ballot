import { inflateRawSync } from "node:zlib";
import type { Shape } from "./zips";

export function unzip(buf: Buffer): Record<string, Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a ZIP archive");
  const out: Record<string, Buffer> = {};
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad ZIP central directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = inflateRawSync(data);
    else throw new Error(`${name}: ZIP compression method ${method} is not supported`);
  }
  return out;
}

function dbfColumn(dbf: Buffer, field: string): (string | null)[] {
  const rows = dbf.readUInt32LE(4);
  const headerLen = dbf.readUInt16LE(8);
  const rowLen = dbf.readUInt16LE(10);
  let offset = 1; // each row starts with a deleted flag
  let width = 0;
  for (let p = 32; p + 32 <= headerLen && dbf[p] !== 0x0d; p += 32) {
    const name = dbf.toString("latin1", p, p + 11).split("\0")[0];
    if (name === field) {
      width = dbf[p + 16];
      break;
    }
    offset += dbf[p + 16];
  }
  if (!width) throw new Error(`no ${field} column`);
  return Array.from({ length: rows }, (_, i) => {
    const row = headerLen + i * rowLen;
    return dbf[row] === 0x2a ? null : dbf.toString("latin1", row + offset, row + offset + width).trim();
  });
}

const R = 6378137;
const fromMercator = ([x, y]: [number, number]): [number, number] => [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];

export function shapefileById(zip: Buffer, field: string, what: string): Record<string, Shape> {
  const files = unzip(zip);
  const file = (ext: string) => {
    const names = Object.keys(files).filter((n) => n.toLowerCase().endsWith(ext) && !n.startsWith("__MACOSX/"));
    if (names.length !== 1) throw new Error(`${what}: expected one ${ext} file, found ${names.length}`);
    return files[names[0]];
  };
  const prj = file(".prj").toString("latin1").trim();
  const project = /^PROJCS\["WGS_1984_Web_Mercator(_Auxiliary_Sphere)?",GEOGCS\["GCS_WGS_1984"/.test(prj)
    ? fromMercator
    : /^GEOGCS\["(GCS_WGS_1984|GCS_North_American_1983)"/.test(prj)
      ? null
      : undefined;
  if (project === undefined) throw new Error(`${what}: unknown projection ${prj.slice(0, 80)}`);
  const ids = dbfColumn(file(".dbf"), field);
  const shp = file(".shp");
  const out: Record<string, Shape> = {};
  let p = 100;
  for (const id of ids) {
    const len = shp.readInt32BE(p + 4) * 2;
    const c = p + 8;
    p = c + len;
    if (id === null) continue;
    if (!id) throw new Error(`${what}: a feature has no ${field}`);
    const type = shp.readInt32LE(c);
    if (type !== 5 && type !== 15 && type !== 25) throw new Error(`${what}: ${field} ${id} has no polygon`);
    const parts = shp.readInt32LE(c + 36);
    const points = shp.readInt32LE(c + 40);
    const pts = c + 44 + parts * 4;
    const rings: [number, number][][] = [];
    for (let i = 0; i < parts; i++) {
      const from = shp.readInt32LE(c + 44 + i * 4);
      const to = i + 1 < parts ? shp.readInt32LE(c + 48 + i * 4) : points;
      const ring: [number, number][] = [];
      for (let k = from; k < to; k++) {
        const xy: [number, number] = [shp.readDoubleLE(pts + k * 16), shp.readDoubleLE(pts + k * 16 + 8)];
        ring.push(project ? project(xy) : xy);
      }
      rings.push(ring);
    }
    if (out[id]) throw new Error(`${what}: ${field} ${id} appears twice`);
    out[id] = { type: "Polygon", coordinates: rings };
  }
  return out;
}
