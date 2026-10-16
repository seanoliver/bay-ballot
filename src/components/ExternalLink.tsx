import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

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

// The last word and the arrow never part.
export function CardLink({ href, label }: { href: string; label: string }) {
  const cut = label.lastIndexOf(" ");
  return (
    <ExternalLink href={href} className="inline-block py-2 text-base font-semibold underline underline-offset-4">
      {label.slice(0, cut + 1)}
      <span className="whitespace-nowrap">
        {label.slice(cut + 1)}
        <ArrowUpRight aria-hidden="true" className="ml-1 inline size-4 align-[-2px]" />
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </ExternalLink>
  );
}
