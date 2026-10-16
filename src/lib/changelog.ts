import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { pacificDate } from "./election-day";
import { ChangelogEntry } from "./schema";

export type ChangelogItem = ChangelogEntry & { file: string };

const NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*(?:--\d+)?\.yml$/i;
const suffix = (file: string) => Number(file.match(/--(\d+)\.yml$/)?.[1] ?? 1);

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
  entries.sort((a, b) => b.date.localeCompare(a.date) || suffix(b.file) - suffix(a.file) || b.file.localeCompare(a.file));
  return { entries, errors };
}

export function validateChangelog(
  entries: Pick<ChangelogItem, "date" | "file" | "guide">[],
  today: string,
  { guides }: { guides?: ReadonlySet<string> } = {},
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const e of entries) {
    const where = `changelog/${e.file}`;
    const m = e.file.match(NAME);
    if (!m) errors.push(`${where}: name must be <YYYY-MM-DD>-<slug>.yml`);
    else if (m[1] !== e.date) errors.push(`${where}: name date differs from entry date ${e.date}`);
    if (e.date > today) errors.push(`${where}: dated ${e.date}, in the future`);
    if (guides && e.guide && !guides.has(e.guide)) errors.push(`${where}: no guide '${e.guide}'`);
    const key = e.file.toLowerCase();
    const first = seen.get(key);
    if (first) errors.push(`${where}: duplicates ${first}`);
    else seen.set(key, e.file);
  }
  return errors;
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export const pacificDay = (now = new Date()) => pacificDate(now);

export function latestDay(now = new Date()): string {
  const a = utcDay(now);
  const b = pacificDay(now);
  return a > b ? a : b;
}

// Guide ids are the file names in guides/, so a guide file that fails to parse doesn't flag every entry naming it.
export function changelogErrors(root: string, today: string): string[] {
  const { entries, errors } = readChangelog(root);
  const dir = path.join(root, "guides");
  const guides = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".yml")).map((f) => f.slice(0, -4)) : []);
  return [...errors, ...validateChangelog(entries, today, { guides })];
}
