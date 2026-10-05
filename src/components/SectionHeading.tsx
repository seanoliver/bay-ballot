import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-6 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h2>;
}
