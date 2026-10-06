import type { Row } from "./filters";
import type { Contest } from "./schema";
import { topPicks } from "./display";
import { tally } from "./score";

const PAGE_WHO = "San Francisco voter guides";
const SHORT_WHO = "SF voter guides";
const READ_MORE = "See every guide's endorsement and reasons.";
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function measureLabel(c: Contest): string {
  if (c.title === "Regional Measure RTM") return "Regional Transit Measure";
  return c.title.replace(/^Proposition\b/, "Prop");
}

export function officeName(c: Contest): string {
  if (c.kind === "retention") {
    return c.title.replace(/^Supreme Court Associate Justice\b/, "Justice").replace(/\s*\(\d+ justices\)$/, "");
  }
  if (c.kind === "measure") {
    const label = measureLabel(c);
    if (!label.startsWith("Prop")) return label;
    return `${c.jurisdiction.level === "state" ? "CA" : "SF"} ${label}`;
  }
  const t = c.title;
  const sup = t.match(/^Board of Supervisors, District (\d+)$/);
  if (sup) return `District ${sup[1]} Supervisor`;
  return t
    .replace(/^United States Representative, /, "U.S. Rep. ")
    .replace(/^State Assembly, /, "Assembly ")
    .replace(/, District /, " District ");
}

// Everything after the first name, not the last token: "Autumn Brown Garibay" -> "Brown Garibay".
export function familyName(name: string): string {
  const tokens = name
    .replace(/\([^)]*\)|["“”][^"“”]*["“”]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  while (tokens.length > 1 && SUFFIX.test(tokens.at(-1) as string)) tokens.pop();
  const rest = tokens.slice(1).filter((t) => !/^[A-Z]\.$/.test(t));
  return rest.length ? rest.join(" ") : (tokens[0] ?? name);
}

function measureObject(c: Contest): string {
  if (c.kind === "retention") return `retaining ${officeName(c).replace(/^1st District Court of Appeal$/, "the 1st District Court of Appeal justices")}`;
  const label = measureLabel(c);
  return label.startsWith("Prop") ? label : `the ${label}`;
}

const officeInSentence = (c: Contest) => c.title.replace(/^United States /, "U.S. ");

function firstChoice(c: Contest, rows: Row[], name: string): boolean {
  if (!c.rankedChoice || c.seats !== 1) return false;
  const mine = rows.filter((r) => Array.isArray(r.entry.pick) && r.entry.pick.includes(name));
  const counted = mine.filter((r) => (r.entry.ranked ? (r.entry.pick as string[])[0] === name : true));
  return counted.some((r) => r.entry.ranked) && counted.every((r) => r.entry.ranked || (r.entry.pick as string[]).length === 1);
}

const othersNamed = (rows: Row[], name: string) => rows.some((r) => Array.isArray(r.entry.pick) && r.entry.pick.some((n) => n !== name));

export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 160;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,;:·]+$/, "")}…`;
}

const fit = (heads: string[], endings: string[]) => {
  const titles = [...endings.flatMap((e) => heads.map((h) => `${h}: ${e}`)), ...heads];
  return clip(titles.find((t) => t.length <= MAX_TITLE) ?? heads.at(-1)!, MAX_TITLE);
};

const monthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" });

function shortNames(names: string[]): string[] {
  const family = names.map(familyName);
  return family.map((f, i) => (family.indexOf(f) === family.lastIndexOf(f) ? f : names[i]));
}

export function contestTitle(c: Contest, rows: Row[], ballotDate: string): string {
  const when = monthYear(ballotDate);
  const t = tally(c, rows.map((r) => r.entry));
  if (t.kind === "measure") {
    const head = [`${officeName(c)} endorsements (${when})`];
    if (t.verdict === "none") return fit(head, []);
    if (t.verdict === "split") return fit(head, [`guides split ${t.yes}–${t.no}`]);
    const side = t.verdict === "Y" ? "Yes" : "No";
    const k = Math.max(t.yes, t.no);
    const n = `${k} of ${t.total}`;
    return fit(head, [`${n} ${plural(t.total, "guide", "guides")} ${plural(k, "says", "say")} ${side}`, `${n} ${plural(k, "says", "say")} ${side}`]);
  }
  if (c.seats > 1) {
    const head = [`SF ${officeName(c)} endorsements (${when})`, `${officeName(c)} endorsements (${when})`];
    if (t.counts.length === 0) return fit(head, []);
    const names = shortNames(topPicks(t, c.seats).map((x) => x.name));
    const strict = t.counts.length === 1 || t.counts[0].count > t.counts[1].count;
    if (names.length === 1) return fit(head, [`${names[0]} leads`]);
    return fit(head, [`${names.join(", ")} lead`, ...(strict ? [`${names[0]} leads`] : [])]);
  }
  const head = [`${officeName(c)} endorsements (SF, ${when})`, `${officeName(c)} endorsements (${when})`];
  if (t.counts.length === 0) return fit(head, []);
  if (t.counts.length === 1) {
    const { name, count } = t.counts[0];
    return fit(head, [
      `${count} ${plural(count, "guide endorses", "guides endorse")} ${name}`,
      `${name} (${count} ${plural(count, "guide", "guides")})`,
      `${count} ${plural(count, "backs", "back")} ${familyName(name)}`,
    ]);
  }
  if (t.leader === null) return fit(head, ["guides split"]);
  return fit(head, [`${t.leader} leads ${t.count} of ${t.total}`, `${familyName(t.leader)} leads ${t.count} of ${t.total}`, `${familyName(t.leader)} leads`]);
}

function answer(c: Contest, rows: Row[], level: 0 | 1 | 2 = 0, WHO = PAGE_WHO, limit = Infinity): string {
  const office = level === 2 ? "" : ` for ${officeInSentence(c)}`;
  const t = tally(c, rows.map((r) => r.entry));
  const one = WHO.replace(/s$/, "");
  const who = (n: number) => plural(n, one, WHO);
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) return `No ${one} has taken a position yet`;
  if (t.kind === "measure") {
    if (t.verdict === "split") return `${WHO} split ${t.yes}–${t.no} on ${measureObject(c)}`;
    const k = Math.max(t.yes, t.no);
    return `${k} of ${t.total} ${who(t.total)} ${plural(k, "recommends", "recommend")} ${t.verdict === "Y" ? "Yes" : "No"} on ${measureObject(c)}`;
  }
  if (c.seats > 1) {
    const all = topPicks(t, c.seats);
    const top = all.slice(0, limit);
    const more = all.length > top.length ? `, and ${all.length - top.length} more` : "";
    if (level === 2) return `Most-endorsed: ${top.map((x, i) => (i === 0 ? `${x.name} (${x.count} of ${t.total} ${plural(t.total, "guide", "guides")})` : `${x.name} (${x.count})`)).join(", ")}${more}`;
    return `Most-endorsed for ${officeInSentence(c)} by ${t.total} ${who(t.total)}: ${top.map((x) => `${x.name} (${x.count})`).join(", ")}`;
  }
  if (t.counts.length === 1) {
    const only = t.counts[0];
    const first = firstChoice(c, rows, only.name) ? " as first choice" : "";
    const rest = othersNamed(rows, only.name) ? "" : "; none endorse another candidate";
    return `${only.count} ${only.count === 1 ? `${one} endorses` : `${WHO} endorse`} ${only.name}${first}${office}${rest}`;
  }
  if (t.leader === null) {
    const names = t.tied.length === 2 ? t.tied.join(" and ") : `${t.tied.slice(0, -1).join(", ")}, and ${t.tied.at(-1)}`;
    return `${WHO} split between ${names}${office}, with ${t.counts[0].count} each`;
  }
  const first = firstChoice(c, rows, t.leader) ? " as first choice" : "";
  const lead = `${t.count} of ${t.total} ${who(t.total)} ${plural(t.count, "endorses", "endorse")} ${t.leader}${first}${office}`;
  const next = t.counts[1];
  const secondTied = t.counts.filter((x) => x.count === next.count).length > 1;
  return level === 0 && !secondTied ? `${lead}; ${next.count} ${plural(next.count, "endorses", "endorse")} ${next.name}` : lead;
}

export function answerSentence(c: Contest, rows: Row[], asOf: string | null): string {
  return `${answer(c, rows)}${asOf ? `, as of ${asOf}` : ""}.`;
}

export function contestDescription(c: Contest, rows: Row[]): string {
  for (const level of [0, 1, 2] as const) {
    const d = `${answer(c, rows, level, SHORT_WHO)}. ${READ_MORE}`;
    if (d.length <= MAX_DESCRIPTION) return d;
  }
  const multi = c.kind === "candidate" && c.seats > 1;
  if (multi) {
    for (let limit = topPicks(tally(c, rows.map((r) => r.entry)), c.seats).length - 1; limit >= 1; limit--) {
      const d = `${answer(c, rows, 2, SHORT_WHO, limit)}. ${READ_MORE}`;
      if (d.length <= MAX_DESCRIPTION) return d;
    }
  }
  const text = clip(answer(c, rows, 2, SHORT_WHO, multi ? 1 : Infinity), MAX_DESCRIPTION - READ_MORE.length - 2);
  return `${text}${text.endsWith("…") ? " " : ". "}${READ_MORE}`;
}
