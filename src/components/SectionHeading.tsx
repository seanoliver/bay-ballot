import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, as: Tag = "h2", id }: { children: ReactNode; as?: "h2" | "h3"; id?: string }) {
  return (
    <Tag id={id} tabIndex={id ? -1 : undefined} className={cn("scroll-mt-16 px-1 text-foreground", Tag === "h2" ? "pt-8 pb-1 text-base font-semibold" : "pt-4 pb-2 text-sm font-semibold text-muted-foreground")}>
      {children}
    </Tag>
  );
}
