import type { Headline, PickGroup } from "@/lib/display";

// Verdict badge: tinted background in the tone's color.
export const BADGE_CLASS: Record<Headline["tone"], string> = {
  yes: "bg-yes/10 text-yes",
  no: "bg-no/10 text-no",
  candidate: "bg-muted text-foreground",
  split: "bg-split/10 text-split",
  none: "bg-muted text-muted-foreground",
};

export const DOT_CLASS: Record<PickGroup["tone"], string> = {
  yes: "bg-yes",
  no: "bg-no",
  candidate: "bg-muted-foreground",
};
