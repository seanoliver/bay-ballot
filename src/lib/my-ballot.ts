import { contestPlace, inArea, placeGroups, placeName } from "./areas";
import { surname } from "./bar";
import type { Area, Contest } from "./schema";

// Client-safe: no zod, fs or path.

export type MyPick = "Y" | "N" | "blank" | string[];
export type MyBallot = { started: boolean; picks: Record<string, MyPick> };

export const EMPTY_BALLOT: MyBallot = { started: false, picks: {} };
export const myBallotKey = (election: string) => `bb-ballot-${election}`;

const isPick = (v: unknown): v is MyPick =>
  v === "Y" || v === "N" || v === "blank" || (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x !== ""));

export function parseMyBallot(raw: string | null): MyBallot {
  if (!raw) return EMPTY_BALLOT;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return EMPTY_BALLOT;
    const { started, picks } = v as Record<string, unknown>;
    const kept = typeof picks === "object" && picks !== null ? Object.entries(picks).filter(([, p]) => isPick(p)) : [];
    return { started: started === true, picks: Object.fromEntries(kept) as Record<string, MyPick> };
  } catch {
    return EMPTY_BALLOT;
  }
}

export function setPick(b: MyBallot, contestId: string, pick: MyPick | null): MyBallot {
  const rest = Object.fromEntries(Object.entries(b.picks).filter(([id]) => id !== contestId));
  return { ...b, picks: pick === null || (Array.isArray(pick) && pick.length === 0) ? rest : { ...rest, [contestId]: pick } };
}

export type CandidateRule = Pick<Contest, "seats" | "rankedChoice">;

export function tapCandidate(current: MyPick | undefined, name: string, rule: CandidateRule): string[] {
  const names = Array.isArray(current) ? current : [];
  if (names.includes(name)) return names.filter((n) => n !== name);
  if (rule.rankedChoice) return [...names, name];
  if (rule.seats > 1) return names.length >= rule.seats ? names : [...names, name];
  return [name];
}

export function myPickLabel(pick: MyPick, { ranked = false, short = true }: { ranked?: boolean; short?: boolean } = {}): string {
  if (pick === "Y") return "Yes";
  if (pick === "N") return "No";
  if (pick === "blank") return "Leaving blank";
  const name = (n: string) => (short ? surname(n) : n);
  return ranked ? pick.map((n, i) => `${i + 1}. ${name(n)}`).join(" · ") : pick.map(name).join(", ");
}

export type MyBallotGroup = { heading: string; sections: { name: string; ids: string[] }[] };
export type MyBallotIndex = {
  contests: Record<string, { title: string; ranked: boolean; area?: string }>;
  areas: Record<string, { name: string; groups: MyBallotGroup[] }>;
};

export function myBallotText(b: MyBallot, index: MyBallotIndex, groups: MyBallotGroup[] | null, heading: string): string {
  const line = (id: string) => {
    const c = index.contests[id];
    const pick = b.picks[id];
    return c && pick ? `${c.title}: ${myPickLabel(pick, { ranked: c.ranked, short: false })}` : null;
  };
  const listed = new Set(groups?.flatMap((g) => g.sections.flatMap((s) => s.ids)) ?? []);
  const blocks = (groups ?? []).map((g) => [g.heading, ...g.sections.flatMap((s) => s.ids.map(line))].filter((x): x is string => x !== null));
  const other = Object.keys(b.picks).filter((id) => !listed.has(id)).map(line).filter((x): x is string => x !== null);
  if (other.length) blocks.push([groups ? "Other" : "Your picks", ...other]);
  return [heading, ...blocks.filter((bl) => bl.length > 1).map((bl) => bl.join("\n"))].join("\n\n");
}

export function myBallotIndex(contests: Contest[], areas: Area[]): MyBallotIndex {
  return {
    contests: Object.fromEntries(
      contests.map((c) => {
        const area = contestPlace(c, areas).area?.id;
        return [c.id, { title: c.title, ranked: c.kind === "candidate" && c.rankedChoice, ...(area ? { area } : {}) }];
      }),
    ),
    areas: Object.fromEntries(
      areas.map((a) => [
        a.id,
        {
          name: placeName(a).name,
          groups: placeGroups(contests.filter((c) => inArea(c, a)), areas).map((g) => ({
            heading: g.heading,
            sections: g.sections.map((s) => ({ name: s.name, ids: s.contests.map((c) => c.id) })),
          })),
        },
      ]),
    ),
  };
}

export function pageSlug(election: string, pathname: string): string | null {
  const [first, slug, ...rest] = pathname.split("/").filter(Boolean);
  return first === election && slug && rest.length === 0 ? slug : null;
}

export function pickArea(index: MyBallotIndex, slug: string | null, stored: (string | null)[]): { area: string | null; here: string | null } {
  const has = (o: object, k: string | null): k is string => k !== null && Object.hasOwn(o, k);
  const here = has(index.contests, slug) ? slug : null;
  const area = stored.find((k) => has(index.areas, k)) ?? (has(index.areas, slug) ? slug : null) ?? (here ? (index.contests[here].area ?? null) : null);
  return { area, here };
}
