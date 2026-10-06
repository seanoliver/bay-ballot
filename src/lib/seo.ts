import type { EndorsementFile } from "./schema";

export const SITE = "https://bayballot.com";

export function latestFetchDay(ends: Record<string, Pick<EndorsementFile, "fetchedAt" | "status">>): string | null {
  const days = Object.values(ends)
    .filter((e) => e.status === "published")
    .map((e) => e.fetchedAt.slice(0, 10))
    .sort();
  return days.at(-1) ?? null;
}

// Not "/": it is a temporary redirect, and redirects don't belong in a sitemap.
export function sitemapEntries({
  elections,
  guides,
  lastModified,
}: {
  elections: { id: string; contests: string[] }[];
  guides: string[];
  lastModified: string;
}): { url: string; lastModified: string }[] {
  const paths = [
    ...elections.flatMap((e) => [`/${e.id}`, ...e.contests.map((c) => `/${e.id}/${c}`)]),
    ...guides.map((g) => `/guides/${g}`),
    "/about",
    "/changelog",
  ];
  return paths.map((p) => ({ url: `${SITE}${p}`, lastModified }));
}
