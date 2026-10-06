import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { monthYear } from "./display";
import { ChangelogEntry } from "./schema";

export type ChangelogItem = ChangelogEntry & { file: string };

const NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.yml$/i;

export function readChangelog(root: string): { entries: ChangelogItem[]; errors: string[] } {
  const dir = path.join(root, "changelog");
  if (!fs.existsSync(dir)) return { entries: [], errors: [] };
  const entries: ChangelogItem[] = [];
  const errors: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yml"))) {
    let raw: unknown;
    try {
      raw = parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      errors.push(`changelog/${file}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      continue;
    }
    const r = ChangelogEntry.safeParse(raw);
    if (r.success) entries.push({ ...r.data, file });
    else errors.push(`changelog/${file}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.file.localeCompare(a.file));
  return { entries, errors };
}

export function validateChangelog(entries: Pick<ChangelogItem, "date" | "file">[], today: string): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const e of entries) {
    const where = `changelog/${e.file}`;
    const m = e.file.match(NAME);
    if (!m) errors.push(`${where}: name must be <YYYY-MM-DD>-<slug>.yml`);
    else if (m[1] !== e.date) errors.push(`${where}: name date differs from entry date ${e.date}`);
    if (e.date > today) errors.push(`${where}: dated ${e.date}, in the future`);
    const key = e.file.toLowerCase();
    const first = seen.get(key);
    if (first) errors.push(`${where}: duplicates ${first}`);
    else seen.set(key, e.file);
  }
  return errors;
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

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
