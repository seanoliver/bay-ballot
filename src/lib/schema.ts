import { z } from "zod";

export const GuideType = z.enum(["newspaper", "party", "dem-club", "union", "advocacy", "civic"]);
export type GuideType = z.infer<typeof GuideType>;

export const Guide = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  type: GuideType,
  homepage: z.url(),
  previousElectionLink: z.url().optional(),
  lean: z.number().min(0).max(100).optional(), // reserved for Trust/Avoid fast-follow
});
export type Guide = z.infer<typeof Guide>;

export const Jurisdiction = z.object({
  level: z.enum(["state", "county", "city", "district"]),
  name: z.string(), // e.g. "California", "San Francisco", "Supervisor", "Assembly"
  district: z.string().optional(), // e.g. "8"
});

export const Contest = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  section: z.string(),
  title: z.string(),
  kind: z.enum(["candidate", "measure", "retention"]),
  description: z.string().optional(),
  link: z.url().optional(),
  candidates: z.array(z.string()).default([]),
  seats: z.number().int().positive().default(1),
  jurisdiction: Jurisdiction,
});
export type Contest = z.infer<typeof Contest>;

export const Ballot = z.object({
  election: z.string().regex(/^\d{4}-\d{2}$/),
  title: z.string(),
  date: z.coerce.string(),
  contests: z.array(Contest),
});
export type Ballot = z.infer<typeof Ballot>;

export const Entry = z.object({
  pick: z.union([z.enum(["Y", "N"]), z.array(z.string()).min(1)]),
  ranked: z.boolean().default(false),
  quotes: z.array(z.string()).max(3).default([]),
});
export type Entry = z.infer<typeof Entry>;

export const EndorsementFile = z.object({
  guide: z.string(),
  election: z.coerce.string(),
  status: z.enum(["published", "pending"]),
  source: z.url().optional(),
  fetchedAt: z.coerce.string(),
  hasReasoning: z.boolean(),
  picks: z.record(z.string(), Entry).default({}),
});
export type EndorsementFile = z.infer<typeof EndorsementFile>;
