"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DISTRICTS_KEY, homeRedirect, SEEN_KEY } from "@/lib/home-redirect";
import { FILTERS_KEY } from "./useBallotFilters";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useHomeRedirect({ election, area }: { election: string; area: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const target =
      area === null
        ? homeRedirect({ query: window.location.search, storedFilters: read(FILTERS_KEY), storedDistricts: read(DISTRICTS_KEY), seen: read(SEEN_KEY) })
        : null;
    try {
      window.localStorage.setItem(SEEN_KEY, area ?? "bay-area");
    } catch {
    }
    if (target) router.replace(`/${election}/${target}`);
  }, [election, area, router]);
}
