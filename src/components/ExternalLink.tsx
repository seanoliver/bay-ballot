import type { ReactNode } from "react";

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ?? "underline underline-offset-2"}>
      {children}
    </a>
  );
}
