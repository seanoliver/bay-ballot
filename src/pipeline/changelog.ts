import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import type { ChangelogEntry, Contest, EndorsementFile, Entry } from "@/lib/schema";
import { shortTitle } from "@/lib/share";

const SHOWN = 2;

function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}
const pickText = (p: Entry["pick"]) => (p === "Y" ? "Yes" : p === "N" ? "No" : names(p));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const reasons = (n: number) => (n === 1 ? "a reason" : `${n} reasons`);

function change(name: string, b: Entry | undefined, a: Entry | undefined, hasReasoning: boolean): string | null {
  if (!a && !b) return null;
  if (!b && a) return Array.isArray(a.pick) ? `endorsed ${pickText(a.pick)} for ${name}` : `endorsed ${pickText(a.pick)} on ${name}`;
  if (b && !a) return `removed its endorsement for ${name}`;
  if (!a || !b) return null;
  if (Array.isArray(a.pick) && Array.isArray(b.pick) && sameSet(a.pick, b.pick)) {
    const order = a.pick.join("\n") !== b.pick.join("\n") || a.ranked !== b.ranked || a.rankedCount !== b.rankedCount;
    if (order && (a.ranked || b.ranked)) return `changed its ranking for ${name}`;
  } else if (pickText(a.pick) !== pickText(b.pick)) {
    return `changed ${name} from ${pickText(b.pick)} to ${pickText(a.pick)}`;
  }
  if (hasReasoning && a.quotes.length > b.quotes.length) return `added ${reasons(a.quotes.length - b.quotes.length)} for ${name}`;
  return null;
}

export function guideChangelogEntry({
  guideName,
  before,
  after,
  contests,
  date,
}: {
  guideName: string;
  before: EndorsementFile;
  after: EndorsementFile;
  contests: Contest[];
  date: string;
}): ChangelogEntry | null {
  const count = Object.keys(after.picks).length;
  if (after.status === "published" && before.status !== "published" && count > 0) {
    return { date, type: "data", title: `${guideName} published endorsements for ${count} ${count === 1 ? "contest" : "contests"}` };
  }
  const held = new Set((after.held ?? []).map((h) => h.contestId));
  const list = contests
    .filter((c) => !held.has(c.id))
    .map((c) => change(shortTitle(c.title), before.picks[c.id], after.picks[c.id], after.hasReasoning))
    .filter((x): x is string => x !== null);
  if (list.length === 0) return null;
  const more = list.length - SHOWN;
  const title = more > 0 ? `${list.slice(0, SHOWN).join("; ")}; and ${more} more ${more === 1 ? "change" : "changes"}` : list.join("; ");
  return { date, type: "data", title: `${guideName} ${title}` };
}

export const refreshEntryFile = (date: string, guideId: string, n = 1) => `${date}-refresh-${guideId}${n > 1 ? `-${n}` : ""}.yml`;

// `keep`: files already on main, never rewritten. This guide's other refresh files are from the open refresh PR and are replaced.
export function writeRefreshEntry(
  dir: string,
  guideId: string,
  entry: ChangelogEntry | null,
  { date, keep }: { date: string; keep: Set<string> },
): void {
  fs.mkdirSync(dir, { recursive: true });
  let n = 1;
  while (keep.has(refreshEntryFile(date, guideId, n))) n += 1;
  const target = refreshEntryFile(date, guideId, n);
  const ours = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-refresh-${guideId}(-\\d+)?\\.yml$`);
  for (const f of fs.readdirSync(dir)) {
    if (ours.test(f) && !keep.has(f) && !(entry && f === target)) fs.rmSync(path.join(dir, f));
  }
  if (!entry) return;
  const text = stringify(entry);
  const p = path.join(dir, target);
  if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== text) fs.writeFileSync(p, text);
}
