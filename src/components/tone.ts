import type { Headline } from "@/lib/display";

// One place for headline colors; candidate names use the body color so they never read as links.
export const TONE_CLASS: Record<Headline["tone"], string> = {
  yes: "text-yes",
  no: "text-no",
  candidate: "text-foreground",
  split: "text-split",
  none: "text-muted-foreground",
};
