import { countyPages } from "./areas";
import { publishedFiles } from "./filters";
import type { ElectionData } from "./data";

export type Badge = { schemaVersion: 1; label: string; message: string; color: string };

export const BADGE_NAMES = ["guides", "counties"] as const;
export type BadgeName = (typeof BADGE_NAMES)[number];

export function badge(d: ElectionData, name: BadgeName): Badge {
  const message = name === "guides" ? Object.keys(publishedFiles(d.endorsements)).length : countyPages(d.areas).length;
  return { schemaVersion: 1, label: name === "guides" ? "voter guides" : "counties", message: String(message), color: "blue" };
}
