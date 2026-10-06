import type { ReactNode } from "react";

export function ExternalLink({
  href,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={className ?? "underline underline-offset-2"}>
      {children}
    </a>
  );
}
