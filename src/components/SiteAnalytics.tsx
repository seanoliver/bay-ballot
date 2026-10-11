"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { beforeSend, scrubUrl } from "@/lib/analytics";

const AHREFS_KEY = "FJDzMIBsD5gLRi6NhIusfA";
const AHREFS_ID = "ahrefs-analytics";

declare global {
  interface Window {
    AhrefsAnalytics?: { sendEvent: (name: string) => void };
  }
}

function AhrefsAnalytics() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const url = scrubUrl(window.location.href);
    // Ahrefs sends each clicked link's resolved href unscrubbed, and "#id" links resolve against this URL.
    if (url !== window.location.href) window.history.replaceState(window.history.state, "", url);
    if (!ready || url === last.current) return;
    last.current = url;
    document.getElementById(AHREFS_ID)?.setAttribute("data-page-location", url);
    window.AhrefsAnalytics?.sendEvent("pageview");
  }, [pathname, ready]);

  return (
    <Script
      id={AHREFS_ID}
      src="https://analytics.ahrefs.com/analytics.js"
      data-key={AHREFS_KEY}
      data-no-pageview-auto=""
      data-page-location={typeof window === "undefined" ? undefined : scrubUrl(window.location.href)}
      onReady={() => setReady(true)}
    />
  );
}

export function SiteAnalytics({ ahrefs }: { ahrefs: boolean }) {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      {ahrefs ? <AhrefsAnalytics /> : null}
    </>
  );
}
