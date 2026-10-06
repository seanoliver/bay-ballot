import type { EndorsementFile } from "./schema";

// The production origin. Sitemaps, canonical URLs and share images always use it, never a preview host.
export const SITE = "https://bayballot.com";

// The newest fetch date (YYYY-MM-DD) among published guides.
export function latestFetchDay(ends: Record<string, Pick<EndorsementFile, "fetchedAt" | "status">>): string | null {
  const days = Object.values(ends)
    .filter((e) => e.status === "published")
    .map((e) => e.fetchedAt.slice(0, 10))
    .sort();
  return days.at(-1) ?? null;
}

// Every page that renders: each election and its contests, each guide, and /about.
// The root redirects to the current election, so it is left out.
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
  ];
  return paths.map((p) => ({ url: `${SITE}${p}`, lastModified }));
}
