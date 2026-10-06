"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createHomeVisit } from "@/lib/home-redirect";

const visit = createHomeVisit();

function storage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

export function useHomeRedirect({ election, area }: { election: string; area: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const target = visit({ local: storage("localStorage"), session: storage("sessionStorage") }, { area, query: window.location.search });
    if (target) router.replace(`/${election}/${target}`);
  }, [election, area, router]);
}
