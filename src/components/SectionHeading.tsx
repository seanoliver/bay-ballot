import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return (
    <Tag className={cn("px-1 text-foreground", Tag === "h2" ? "pt-8 pb-1 text-base font-semibold" : "pt-4 pb-2 text-sm font-semibold text-muted-foreground")}>
      {children}
    </Tag>
  );
}
