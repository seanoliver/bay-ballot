"use client";

import Link from "next/link";
import { useCarriedQuery } from "./useBallotFilters";

export function BackLink({ href, label }: { href: string; label: string }) {
  const carry = useCarriedQuery();
  return (
    <Link href={`${href}${carry}`} className="inline-block py-2.5 -my-2.5 text-sm text-muted-foreground underline underline-offset-2">
      {label}
    </Link>
  );
}
