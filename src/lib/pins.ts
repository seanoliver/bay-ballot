import { slotTone, surname, type BarTone, type Slots } from "./bar";
import type { Entry } from "./schema";

export type PinPart = { key: string; label: string; tone: BarTone };

/** A pick as chip parts: Yes or No, else each name by surname, numbered only as far as the guide ranked. */
export function pinParts(entry: Entry, slots: Slots): PinPart[] {
  if (entry.pick === "Y") return [{ key: "Y", label: "Yes", tone: "yes" }];
  if (entry.pick === "N") return [{ key: "N", label: "No", tone: "no" }];
  const ranked = entry.ranked ? (entry.rankedCount ?? entry.pick.length) : 0;
  return entry.pick.map((name, i) => ({ key: name, label: i < ranked ? `${i + 1}. ${surname(name)}` : surname(name), tone: slotTone(slots, name) }));
}
