import type { Row } from "./filters";
import type { Contest } from "./schema";
import { tally } from "./score";

// Search titles, descriptions and the answer sentence on contest pages. Every count comes from
// tally() over all published guides; the visitor's filters never reach these strings.

const PAGE_WHO = "San Francisco voter guides";
// Descriptions have 160 characters; the short form keeps room for the runner-up.
const SHORT_WHO = "SF voter guides";
const READ_MORE = "See every guide's endorsement and reasons.";
const MAX_DESCRIPTION = 160;
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// "Prop B" / "Prop 1" for propositions, otherwise the ballot title.
function measureLabel(c: Contest): string {
  if (c.title === "Regional Measure RTM") return "Regional Transit Measure";
  return c.title.replace(/^Proposition\b/, "Prop");
}

// The name people search for. Measures carry their place (SF or CA); offices put the district first.
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

// Everything after the first name, minus nicknames, initials and suffixes: "Autumn Brown Garibay" -> "Brown Garibay".
export function familyName(name: string): string {
  const tokens = name
    .replace(/\([^)]*\)|["“”][^"“”]*["“”]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  while (tokens.length > 1 && SUFFIX.test(tokens.at(-1) as string)) tokens.pop();
  const rest = tokens.slice(1).filter((t) => !/^[A-Z]\.$/.test(t));
  return rest.length ? rest.join(" ") : (tokens[0] ?? name);
}

// The measure as a sentence names it: "Prop B", "the Regional Transit Measure", "retaining Justice …".
function measureObject(c: Contest): string {
  if (c.kind === "retention") return `retaining ${officeName(c).replace(/^1st District Court of Appeal$/, "the 1st District Court of Appeal justices")}`;
  const label = measureLabel(c);
  return label.startsWith("Prop") ? label : `the ${label}`;
}

// The office as a sentence names it: the ballot title, with "U.S." for "United States".
const officeInSentence = (c: Contest) => c.title.replace(/^United States /, "U.S. ");

const ranked = (c: Contest, rows: Row[]) => c.rankedChoice && c.seats === 1 && rows.some((r) => r.entry.ranked);

// Titles aim for MAX_TITLE characters: an ending is shortened only when the full one runs past it.
const MAX_TITLE = 80;
const fit = (head: string, endings: string[]) => {
  const titles = endings.map((e) => `${head}: ${e}`);
  return titles.find((t) => t.length <= MAX_TITLE) ?? titles.at(-1)!;
};

export function contestTitle(c: Contest, rows: Row[]): string {
  const t = tally(c, rows.map((r) => r.entry));
  if (t.kind === "measure") {
    const head = `${officeName(c)} endorsements (Nov 2026)`;
    if (t.verdict === "none") return head;
    if (t.verdict === "split") return `${head}: guides split ${t.yes}–${t.no}`;
    const side = t.verdict === "Y" ? "Yes" : "No";
    const n = `${Math.max(t.yes, t.no)} of ${t.total}`;
    return fit(head, [`${n} guides say ${side}`, `${n} say ${side}`]);
  }
  if (c.seats > 1) {
    const head = `SF ${officeName(c)} endorsements (Nov 2026)`;
    if (t.counts.length === 0) return head;
    return `${head}: ${t.counts.slice(0, c.seats).map((x) => familyName(x.name)).join(", ")} lead`;
  }
  const head = `${officeName(c)} endorsements (SF, Nov 2026)`;
  if (t.counts.length === 0) return head;
  if (t.counts.length === 1) {
    const { name, count } = t.counts[0];
    return fit(head, [`${count} ${plural(count, "guide endorses", "guides endorse")} ${name}`, name]);
  }
  if (t.leader === null) return `${head}: guides split`;
  return fit(head, [`${t.leader} leads ${t.count} of ${t.total}`, `${t.leader} leads`]);
}

// The plain answer, without the date. Shorter levels drop the runner-up (1), then the office (2).
function answer(c: Contest, rows: Row[], level: 0 | 1 | 2 = 0, WHO = PAGE_WHO): string {
  const office = level === 2 ? "" : ` for ${officeInSentence(c)}`;
  const t = tally(c, rows.map((r) => r.entry));
  if (t.total === 0 || (t.kind === "candidate" && t.counts.length === 0)) return `No ${WHO.replace(/s$/, "")} has taken a position yet`;
  if (t.kind === "measure") {
    if (t.verdict === "split") return `${WHO} split ${t.yes}–${t.no} on ${measureObject(c)}`;
    return `${Math.max(t.yes, t.no)} of ${t.total} ${WHO} recommend ${t.verdict === "Y" ? "Yes" : "No"} on ${measureObject(c)}`;
  }
  if (c.seats > 1) {
    const top = t.counts.slice(0, c.seats);
    return `Most-endorsed: ${top.map((x, i) => (i === 0 ? `${x.name} (${x.count} of ${t.total} guides)` : `${x.name} (${x.count})`)).join(", ")}`;
  }
  const first = ranked(c, rows) ? " as first choice" : "";
  if (t.counts.length === 1) {
    const only = t.counts[0];
    return `${only.count} ${only.count === 1 ? `${WHO.replace(/s$/, "")} endorses` : `${WHO} endorse`} ${only.name}${first}${office}; none endorse another candidate`;
  }
  if (t.leader === null) {
    const names = t.tied.length === 2 ? t.tied.join(" and ") : `${t.tied.slice(0, -1).join(", ")}, and ${t.tied.at(-1)}`;
    return `${WHO} split between ${names}${office}, with ${t.counts[0].count} each`;
  }
  const lead = `${t.count} of ${t.total} ${WHO} endorse ${t.leader}${first}${office}`;
  const next = t.counts[1];
  return level === 0 ? `${lead}; ${next.count} ${next.count === 1 ? "endorses" : "endorse"} ${next.name}` : lead;
}

// The sentence at the top of a contest page.
export function answerSentence(c: Contest, rows: Row[], asOf: string | null): string {
  return `${answer(c, rows)}${asOf ? `, as of ${asOf}` : ""}.`;
}

export function contestDescription(c: Contest, rows: Row[]): string {
  for (const level of [0, 1] as const) {
    const d = `${answer(c, rows, level, SHORT_WHO)}. ${READ_MORE}`;
    if (d.length <= MAX_DESCRIPTION) return d;
  }
  return `${answer(c, rows, 2, SHORT_WHO)}. ${READ_MORE}`;
}
