import fs from "node:fs";
import { parseDocument, stringify } from "yaml";
import type { ChangelogEntry, Contest, EndorsementFile, Entry } from "@/lib/schema";
import { shortTitle } from "@/lib/share";

const SHOWN = 2;

const pickText = (p: Entry["pick"]) => (p === "Y" ? "Yes" : p === "N" ? "No" : p.join(" and "));
const reasons = (n: number) => (n === 1 ? "a reason" : `${n} reasons`);

function changes(before: EndorsementFile, after: EndorsementFile, contests: Contest[]): string[] {
  const held = new Set((after.held ?? []).map((h) => h.contestId));
  const out: string[] = [];
  for (const c of contests) {
    if (held.has(c.id)) continue;
    const name = shortTitle(c.title);
    const b = before.picks[c.id];
    const a = after.picks[c.id];
    if (!a && !b) continue;
    if (!b && a) {
      out.push(Array.isArray(a.pick) ? `endorsed ${pickText(a.pick)} for ${name}` : `endorsed ${pickText(a.pick)} on ${name}`);
      continue;
    }
    if (b && !a) {
      out.push(`removed its endorsement for ${name}`);
      continue;
    }
    if (!a || !b) continue;
    if (pickText(a.pick) !== pickText(b.pick)) out.push(`changed ${name} from ${pickText(b.pick)} to ${pickText(a.pick)}`);
    else if (after.hasReasoning && a.quotes.length > b.quotes.length) out.push(`added ${reasons(a.quotes.length - b.quotes.length)} for ${name}`);
  }
  return out;
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
  const firstPublished = before.status !== "published";
  const count = Object.keys(after.picks).length;
  if (after.status === "published" && firstPublished && count > 0) {
    return { date, type: "data", title: `${guideName} published endorsements for ${count} ${count === 1 ? "contest" : "contests"}` };
  }
  const list = changes(before, after, contests);
  if (list.length === 0) return null;
  let title: string;
  if (list.length <= SHOWN) title = list.join(" and ");
  else {
    const more = list.length - SHOWN;
    title = `${list.slice(0, SHOWN).join(", ")}, and ${more} more ${more === 1 ? "change" : "changes"}`;
  }
  return { date, type: "data", title: `${guideName} ${title}` };
}

export function prependChangelog(file: string, entries: ChangelogEntry[]): void {
  if (entries.length === 0) return;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, stringify(entries));
    return;
  }
  const doc = parseDocument(fs.readFileSync(file, "utf8"));
  const items = (doc.toJS() as ChangelogEntry[] | null) ?? [];
  const next = parseDocument(stringify([...entries, ...items]));
  next.commentBefore = doc.commentBefore;
  fs.writeFileSync(file, next.toString());
}
