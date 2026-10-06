import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-8 pb-2 text-sm font-semibold text-foreground">{children}</h2>;
}
