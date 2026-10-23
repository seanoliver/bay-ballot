import type { BarTone } from "@/lib/bar";

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

export const BORDER: Record<BarTone, string> = {
  yes: "border-yes-fill",
  no: "border-no-fill",
  c1: "border-bar-1",
  c2: "border-bar-2",
  c3: "border-bar-3",
  c4: "border-bar-4",
  other: "border-muted-foreground/40",
  empty: "border-border",
};
