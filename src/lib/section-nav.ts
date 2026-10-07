import type { PlaceGroup } from "./areas";

export type NavSection = { id: string; name: string; place: string; count: number; contestIds: string[] };
export type NavPlace = { id: string; heading: string; count: number; sections: NavSection[] };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function navModel(groups: PlaceGroup[]): NavPlace[] {
  return groups.map((g) => {
    const sections = g.sections.map((s) => ({
      id: `section-${slug(g.key)}-${slug(s.name)}`,
      name: s.name,
      place: g.heading,
      count: s.contests.length,
      contestIds: s.contests.map((c) => c.id),
    }));
    return { id: `place-${slug(g.key)}`, heading: g.heading, count: sections.reduce((n, s) => n + s.count, 0), sections };
  });
}

export function sectionOf(places: NavPlace[], contestId: string): string | null {
  for (const p of places) for (const s of p.sections) if (s.contestIds.includes(contestId)) return s.id;
  return null;
}

export function spySection(
  headings: { id: string; top: number }[],
  { line, atBottom, viewport }: { line: number; atBottom: boolean; viewport: number },
): string | null {
  if (headings.length === 0) return null;
  let current = headings[0].id;
  for (const h of headings) {
    if (h.top <= line) current = h.id;
    else break;
  }
  if (atBottom) {
    const onScreen = headings.filter((h) => h.top < viewport);
    const last = onScreen.at(-1);
    if (last && last.top > line) current = last.id;
  }
  return current;
}

export function stepFrom(places: NavPlace[], anchor: string, ids: string[], dir: "next" | "prev"): string | null {
  const place = places.find((p) => p.id === anchor);
  const section = place?.sections[0] ?? places.flatMap((p) => p.sections).find((s) => s.id === anchor);
  const first = section?.contestIds[0];
  const i = first === undefined ? -1 : ids.indexOf(first);
  if (i === -1) return null;
  return dir === "next" ? ids[i] : (ids[i - 1] ?? null);
}

export const countLabel = (name: string, count: number) => `${name}, ${count} ${count === 1 ? "contest" : "contests"}`;
