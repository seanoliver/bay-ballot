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
  shortName: NonEmpty.optional(),
  description: z.string(),
  type: GuideType,
  homepage: HttpUrl,
  previousElectionLink: HttpUrl.optional(),
  lean: z.number().min(0).max(100).optional(),
  areas: z.array(Slug).min(1),
});
export type Guide = z.infer<typeof Guide>;

export const Place = z.object({ level: z.enum(["county", "city"]), name: NonEmpty });
export type Place = z.infer<typeof Place>;

export const Jurisdiction = z.object({
  level: z.enum(["state", "region", "county", "city", "district"]),
  name: z.string(),
  district: z.string().optional(),
  within: z.array(Place).min(1).optional(),
});

export type Jurisdiction = z.infer<typeof Jurisdiction>;

export const Area = z.object({
  id: Slug,
  name: NonEmpty,
  shortName: NonEmpty.optional(),
  kind: z.enum(["city", "county"]),
  jurisdictions: z.array(z.object({ level: z.enum(["state", "county", "city"]), name: NonEmpty })).min(1),
});
export type Area = z.infer<typeof Area>;

export const AreaFile = Area.extend({ order: z.number() });

export const Contest = z.object({
  id: Slug,
  section: NonEmpty,
  title: NonEmpty,
  kind: z.enum(["candidate", "measure", "retention"]),
  description: z.string().optional(),
  link: HttpUrl.optional(),
  summary: z.object({ text: NonEmpty, yes: NonEmpty, no: NonEmpty }).optional(),
  candidates: z.array(NonEmpty).default([]),
  seats: z.number().int().positive().default(1),
  rankedChoice: z.boolean().default(false),
  aliases: z.record(NonEmpty, z.array(NonEmpty).min(1)).optional(),
  jurisdiction: Jurisdiction,
}).refine((c) => Object.keys(c.aliases ?? {}).every((name) => c.candidates.includes(name)), {
  message: "every alias key must be one of the contest's candidates",
  path: ["aliases"],
}).refine((c) => !c.summary || c.kind === "measure", { message: "only a measure has a Yes/No summary", path: ["summary"] });
// linkShared is set by loadBallot, never read from YAML: another contest links to the same official page.
export type Contest = z.infer<typeof Contest> & { linkShared?: true };

export const Ballot = z.object({
  election: Election,
  title: NonEmpty,
  date: z.iso.date(),
  contests: z.array(Contest),
});
export type Ballot = z.infer<typeof Ballot>;

export const CountyBallot = z.object({
  placement: z.record(NonEmpty, NonEmpty).optional(),
  contests: z.array(Contest).min(1),
});

export const Quote = z.object({
  text: NonEmpty,
  source: HttpUrl,
  // The picked candidates the quote is about, when it is about some of a multi-name pick. Omitted means the whole pick.
  about: z.array(NonEmpty).min(1).optional(),
});
export type Quote = z.infer<typeof Quote>;

export const Entry = z.object({
  pick: z.union([z.enum(["Y", "N"]), z.array(NonEmpty).min(1)]),
  ranked: z.boolean().default(false),
  rankedCount: z.number().int().positive().optional(),
  quotes: z.array(Quote).max(3).default([]),
});
export type Entry = z.infer<typeof Entry>;

export const ArchivedSource = z.object({ source: HttpUrl, snapshot: HttpUrl });
export type ArchivedSource = z.infer<typeof ArchivedSource>;

export const HeldPick = z.object({
  contestId: Slug,
  pick: Entry.shape.pick,
  // `unclear-match`: a person decided the guide's text may not mean this contest. No extract or verifier run releases it.
  reason: z.enum(["wrong-pick", "wrong-rank", "not-found", "old-election", "unverified", "unclear-match", "name-mismatch"]),
  evidence: z.string(),
  ranked: z.boolean().optional(),
  rankedCount: z.number().int().positive().optional(),
  quotes: z.array(Quote).max(3).optional(),
});
export type HeldPick = z.infer<typeof HeldPick>;

/** Holds only a person releases, so the verifier neither re-checks nor releases them. */
export const isPersonHold = (h: HeldPick) => h.reason === "unclear-match" || h.reason === "name-mismatch";

/** A person's decision on one contest. `pick: null` means the guide takes no position there. */
export const PinnedPick = z.object({
  contestId: Slug,
  pick: Entry.shape.pick.nullable(),
  ranked: z.boolean().optional(),
  reason: NonEmpty,
}).strict();
export type PinnedPick = z.infer<typeof PinnedPick>;

export const EndorsementFile = z.object({
  guide: Slug,
  election: Election,
  status: z.enum(["published", "pending"]),
  source: HttpUrl.optional(),
  fetchedAt: z.union([z.iso.date(), z.iso.datetime()]),
  hasReasoning: z.boolean(),
  fetchWith: z.enum(["http", "browser"]).optional(),
  fetchFrom: z.literal("local").optional(),
  contentSelector: NonEmpty.optional(),
  contentExclude: NonEmpty.optional(),
  contentSelectors: z.record(HttpUrl, NonEmpty).optional(),
  extraSources: z.array(HttpUrl).optional(),
  manual: z.boolean().optional(),
  allowForeignSources: z.boolean().optional(),
  archived: z.array(ArchivedSource).optional(),
  held: z.array(HeldPick).optional(),
  pinned: z.array(PinnedPick).optional(),
  rejectedQuotes: z.array(z.object({ text: NonEmpty, reason: NonEmpty, contestId: Slug.optional() })).optional(),
  picks: z.record(Slug, Entry).default({}),
}).strict().superRefine((f, ctx) => {
  const sources = new Set([f.source, ...(f.extraSources ?? [])]);
  for (const url of Object.keys(f.contentSelectors ?? {})) {
    if (!sources.has(url)) ctx.addIssue({ code: "custom", path: ["contentSelectors", url], message: `${url} is not one of this guide's sources` });
  }
});
export type EndorsementFile = z.infer<typeof EndorsementFile>;

export const ChangelogEntry = z.object({
  date: z.iso.date(),
  type: z.enum(["new", "data", "fix"]),
  guide: Slug.optional(),
  title: NonEmpty,
  details: NonEmpty.optional(),
  pr: z.number().int().positive().optional(),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntry>;
