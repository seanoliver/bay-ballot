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
    if (!ready) return;
    const url = scrubUrl(window.location.href);
    if (url === last.current) return;
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
