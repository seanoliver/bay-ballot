"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useCarriedQuery } from "./useBallotFilters";

// A link from a static page that keeps the visitor's filter query, which only the client knows.
export function CarriedLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const carry = useCarriedQuery();
  return <Link href={`${href}${carry}`} {...props} />;
}
