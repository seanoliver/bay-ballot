import { z } from "zod";

const HttpUrl = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const NonEmpty = z.string().trim().min(1);
const Election = z.string().regex(/^\d{4}-\d{2}$/);

export const GuideType = z.enum(["newspaper", "party", "club", "union", "advocacy", "civic"]);
export type GuideType = z.infer<typeof GuideType>;

export const Guide = z.object({
  id: Slug,
  name: NonEmpty,
  shortName: NonEmpty.optional(), // used where space is tight; full name everywhere else
  description: z.string(),
  type: GuideType,
  homepage: HttpUrl,
  previousElectionLink: HttpUrl.optional(),
  lean: z.number().min(0).max(100).optional(), // reserved for Trust/Avoid fast-follow
});
export type Guide = z.infer<typeof Guide>;

export const Jurisdiction = z.object({
  level: z.enum(["state", "county", "city", "district"]),
  name: z.string(), // e.g. "California", "San Francisco", "Supervisor", "Assembly"
  district: z.string().optional(), // e.g. "8"
});

export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const Contest = z.object({
  id: Slug,
  section: NonEmpty,
  title: NonEmpty,
  kind: z.enum(["candidate", "measure", "retention"]),
  description: z.string().optional(),
  link: HttpUrl.optional(),
  candidates: z.array(NonEmpty).default([]),
  seats: z.number().int().positive().default(1),
  rankedChoice: z.boolean().default(false), // SF uses RCV for single-seat city and supervisor races
  aliases: z.record(NonEmpty, z.array(NonEmpty).min(1)).optional(), // official name -> spellings guides print
  jurisdiction: Jurisdiction,
}).refine((c) => Object.keys(c.aliases ?? {}).every((name) => c.candidates.includes(name)), {
  message: "every alias key must be one of the contest's candidates",
  path: ["aliases"],
});
export type Contest = z.infer<typeof Contest>;

export const Ballot = z.object({
  election: Election,
  title: NonEmpty,
  date: z.iso.date(),
  contests: z.array(Contest),
});
export type Ballot = z.infer<typeof Ballot>;

// A quote is the guide's own wording, copied from the page it appeared on.
export const Quote = z.object({ text: NonEmpty, source: HttpUrl });
export type Quote = z.infer<typeof Quote>;

export const Entry = z.object({
  pick: z.union([z.enum(["Y", "N"]), z.array(NonEmpty).min(1)]),
  ranked: z.boolean().default(false),
  // Only the first N names are ranked; the rest are unranked co-endorsements ("#1 X, plus Y and Z").
  rankedCount: z.number().int().positive().optional(),
  quotes: z.array(Quote).max(3).default([]),
});
export type Entry = z.infer<typeof Entry>;

export const ArchivedSource = z.object({ source: HttpUrl, snapshot: HttpUrl });
export type ArchivedSource = z.infer<typeof ArchivedSource>;

export const EndorsementFile = z.object({
  guide: Slug,
  election: Election,
  status: z.enum(["published", "pending"]),
  source: HttpUrl.optional(),
  fetchedAt: z.union([z.iso.date(), z.iso.datetime()]),
  hasReasoning: z.boolean(),
  fetchWith: z.enum(["http", "browser"]).optional(), // "browser" when the page needs JS or blocks plain HTTP
  extraSources: z.array(HttpUrl).optional(), // further pages of a multi-page guide
  manual: z.boolean().optional(), // positions are hand-entered (e.g. image-only); `bb extract` skips the guide
  allowForeignSources: z.boolean().optional(), // sources may live off the guide's homepage host (e.g. a PDF on a CDN)
  archived: z.array(ArchivedSource).optional(), // web.archive.org snapshots, one per source that archived
  picks: z.record(Slug, Entry).default({}),
});
export type EndorsementFile = z.infer<typeof EndorsementFile>;
