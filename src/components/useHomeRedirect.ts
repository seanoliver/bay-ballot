"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createHomeVisit } from "@/lib/home-redirect";

const home = createHomeVisit();

function storage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

const stores = () => ({ local: storage("localStorage"), session: storage("sessionStorage") });

export function markHomeVisit(area: string | null) {
  home.mark(stores(), area);
}

type Switch = (href: string, opts: { replace: boolean }) => boolean;

export function useHomeRedirect({ election, area, onSwitch }: { election: string; area: string | null; onSwitch?: Switch }) {
  const router = useRouter();
  useEffect(() => {
    const target = home.visit(stores(), { area, query: window.location.search });
    if (!target) return;
    const href = `/${election}/${target}`;
    if (!onSwitch?.(href, { replace: true })) router.replace(href);
  }, [election, area, router, onSwitch]);
}
