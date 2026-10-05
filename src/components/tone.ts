import type { BarTone } from "@/lib/bar";
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

// Bar segments, legend dots and candidate group dots. Candidates get four distinct hues by slot.
export const BAR_FILL: Record<BarTone, string> = {
  yes: "bg-yes",
  no: "bg-no",
  c1: "bg-bar-1",
  c2: "bg-bar-2",
  c3: "bg-bar-3",
  c4: "bg-bar-4",
  other: "bg-muted-foreground/40",
  empty: "bg-muted ring-1 ring-inset ring-border",
};
