import type { ChangelogEntry } from "./schema";
import { monthYear } from "./display";

export function validateChangelog(entries: Pick<ChangelogEntry, "date">[], today: string): string[] {
  const errors: string[] = [];
  entries.forEach((e, i) => {
    if (e.date > today) errors.push(`changelog: entry ${i + 1} (${e.date}) is in the future`);
    if (i > 0 && e.date > entries[i - 1].date) errors.push(`changelog: entry ${i + 1} (${e.date}) is newer than the one before it`);
  });
  return errors;
}

export type ChangelogMonth<E> = { label: string; entries: E[] };

export function changelogMonths<E extends Pick<ChangelogEntry, "date">>(entries: E[]): ChangelogMonth<E>[] {
  const out: ChangelogMonth<E>[] = [];
  for (const e of entries) {
    const label = monthYear(e.date);
    const last = out.at(-1);
    if (last?.label === label) last.entries.push(e);
    else out.push({ label, entries: [e] });
  }
  return out;
}
