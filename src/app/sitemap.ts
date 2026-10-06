import type { MetadataRoute } from "next";
import { latestFetchDay, sitemapEntries } from "@/lib/seo";
import { election, elections, latestElection } from "@/lib/site-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const all = elections().map((id) => ({ id, contests: election(id)?.ballot.contests.map((c) => c.id) ?? [] }));
  const current = election(latestElection());
  return sitemapEntries({
    elections: all,
    guides: current?.guides.map((g) => g.id) ?? [],
    lastModified: latestFetchDay(current?.endorsements ?? {}) ?? new Date().toISOString().slice(0, 10),
  });
}
