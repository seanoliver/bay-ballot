import type { PlaceName } from "./areas";
import type { Row } from "./filters";
import type { Contest } from "./schema";
import { topPicks } from "./display";
import { tally } from "./score";
import { mostPositions } from "./share";

const READ_MORE = "See every guide's endorsement and reasons.";
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function measureLabel(c: Contest): string {
  if (c.title === "Regional Measure RTM") return "Regional Transit Measure";
  return c.title.replace(/^Proposition\b/, "Prop");
}

export function officeName(c: Contest, place: PlaceName): string {
  if (c.kind === "retention") {
    return c.title.replace(/^Supreme Court Associate Justice\b/, "Justice").replace(/\s*\(\d+ justices\)$/, "");
  }
  if (c.kind === "measure") {
    const label = measureLabel(c);
    if (!label.startsWith("Prop")) return label;
    return `${c.jurisdiction.level === "state" ? "CA" : place.short} ${label}`;
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

function measureObject(c: Contest, place: PlaceName, { named = false }: { named?: boolean } = {}): string {
  if (c.kind === "retention") return `retaining ${officeName(c, place).replace(/^1st District Court of Appeal$/, "the 1st District Court of Appeal justices")}`;
  const label = measureLabel(c);
  if (!label.startsWith("Prop")) return `the ${label}`;
  return named && c.jurisdiction.level !== "state" ? officeName(c, place) : label;
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

export function contestTitle(c: Contest, rows: Row[], ballotDate: string, place: PlaceName): string {
  const when = monthYear(ballotDate);
  const t = tally(c, rows.map((r) => r.entry));
  if (t.kind === "measure") {
    const head = [`${officeName(c, place)} endorsements (${when})`];
    if (t.verdict === "none") return fit(head, []);
    if (t.verdict === "split") return fit(head, [`guides split ${t.yes}–${t.no}`]);
    const side = t.verdict === "Y" ? "Yes" : "No";
    const k = Math.max(t.yes, t.no);
    const n = `${k} of ${t.total}`;
    return fit(head, [`${n} ${plural(t.total, "guide", "guides")} ${plural(k, "says", "say")} ${side}`, `${n} ${plural(k, "says", "say")} ${side}`]);
  }
  if (c.seats > 1) {
    const head = [`${place.short} ${officeName(c, place)} endorsements (${when})`, `${officeName(c, place)} endorsements (${when})`];
    if (t.counts.length === 0) return fit(head, []);
    const top = topPicks(t, c.seats).map((x) => familyName(x.name));
    return fit(head, [`${top.join(", ")} lead`, `${top[0]} leads`]);
  }
  const head = [`${officeName(c, place)} endorsements (${place.short}, ${when})`, `${officeName(c, place)} endorsements (${when})`];
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

function answer(
  c: Contest,
  rows: Row[],
  level: 0 | 1 | 2,
  place: PlaceName,
  { short = false, named = false }: { short?: boolean; named?: boolean } = {},
): string {
  const WHO = `${short ? place.short : place.name} voter guides`;
  const office = level === 2 ? "" : ` for ${officeInSentence(c)}`;
  const t = tally(c, rows.map((r) => r.entry));
  const one = WHO.replace(/s$/, "");
  const who = (n: number) => plural(n, one, WHO);
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) return `No ${one} has taken a position yet`;
  if (t.kind === "measure") {
    if (t.verdict === "split") return `${WHO} split ${t.yes}–${t.no} on ${measureObject(c, place, { named })}`;
    const k = Math.max(t.yes, t.no);
    return `${k} of ${t.total} ${who(t.total)} ${plural(k, "recommends", "recommend")} ${t.verdict === "Y" ? "Yes" : "No"} on ${measureObject(c, place, { named })}`;
  }
  if (c.seats > 1) {
    const top = topPicks(t, c.seats);
    if (level === 2) return `Most-endorsed: ${top.map((x, i) => (i === 0 ? `${x.name} (${x.count} of ${t.total} ${plural(t.total, "guide", "guides")})` : `${x.name} (${x.count})`)).join(", ")}`;
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

export function answerSentence(c: Contest, rows: Row[], asOf: string | null, place: PlaceName): string {
  return `${answer(c, rows, 0, place)}${asOf ? `, as of ${asOf}` : ""}.`;
}

export function contestDescription(c: Contest, rows: Row[], place: PlaceName): string {
  for (const level of [0, 1, 2] as const) {
    const d = `${answer(c, rows, level, place, { short: true })}. ${READ_MORE}`;
    if (d.length <= MAX_DESCRIPTION) return d;
  }
  const text = clip(answer(c, rows, 2, place, { short: true }), MAX_DESCRIPTION - READ_MORE.length - 2);
  return `${text}${text.endsWith("…") ? " " : ". "}${READ_MORE}`;
}

const SEE_ALL = "See every contest side by side.";

export function areaTitle(place: PlaceName, ballotDate: string): string {
  return clip(`${place.name} endorsements (${monthYear(ballotDate)})`, MAX_TITLE);
}

export function areaDescription(
  place: PlaceName,
  contests: Contest[],
  rowsFor: (id: string) => Row[],
  { statewideOnly = false }: { statewideOnly?: boolean } = {},
): string {
  const c = mostPositions(statewideOnly ? contests.filter((x) => x.jurisdiction.level === "state") : contests, rowsFor);
  const rows = c ? rowsFor(c.id) : [];
  if (!c || rows.length === 0) return `What ${place.name} voter guides recommend. ${SEE_ALL}`;
  for (const short of [false, true]) {
    const d = `${answer(c, rows, 1, place, { short, named: true })}. ${SEE_ALL}`;
    if (d.length <= MAX_DESCRIPTION) return d;
  }
  return `${clip(answer(c, rows, 2, place, { short: true, named: true }), MAX_DESCRIPTION - SEE_ALL.length - 2)}. ${SEE_ALL}`;
}
