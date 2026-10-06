import type { BarTone } from "@/lib/bar";

// Bar segments, legend dots and candidate group dots. Candidates get four distinct hues by slot.
export const BAR_FILL: Record<BarTone, string> = {
  yes: "bg-yes-fill",
  no: "bg-no-fill",
  c1: "bg-bar-1",
  c2: "bg-bar-2",
  c3: "bg-bar-3",
  c4: "bg-bar-4",
  other: "bg-muted-foreground/40",
  empty: "bg-muted ring-1 ring-inset ring-border",
};
