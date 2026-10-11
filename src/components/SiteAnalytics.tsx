"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { beforeSend, scrubUrl } from "@/lib/analytics";
import { CHANGE_EVENT } from "./useBallotFilters";

const AHREFS_KEY = "FJDzMIBsD5gLRi6NhIusfA";
const AHREFS_ID = "ahrefs-analytics";

declare global {
  interface Window {
    AhrefsAnalytics?: { sendEvent: (name: string) => void };
    /** Set by the analytics e2e test to load Ahrefs off Vercel. */
    __bbTestAhrefs?: boolean;
  }
}

// Ahrefs sends each clicked link's resolved href unscrubbed, and "#id" links resolve against this URL.
// Null state, not history.state: Next's history wrapper then copies its own state and moves its router to the new URL.
function scrubAddressBar() {
  const url = scrubUrl(window.location.href);
  if (url !== window.location.href) window.history.replaceState(null, "", url);
}

// A timeout, so the first run comes after Next's app router wraps history in its own effect, which runs after ours.
function scrubSoon(): () => void {
  const timer = setTimeout(scrubAddressBar, 0);
  return () => clearTimeout(timer);
}

function AhrefsAnalytics() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const last = useRef<string | null>(null);

  // Same-path history writes: filter changes, and Back or Forward.
  useEffect(() => {
    let cancel = () => {};
    const onChange = () => {
      cancel();
      cancel = scrubSoon();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      cancel();
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  useEffect(() => {
    const cancel = scrubSoon();
    const url = scrubUrl(window.location.href);
    if (ready && url !== last.current) {
      last.current = url;
      document.getElementById(AHREFS_ID)?.setAttribute("data-page-location", url);
      window.AhrefsAnalytics?.sendEvent("pageview");
    }
    return cancel;
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

const noSubscribe = () => () => {};

/** Off Vercel: Ahrefs alone, and only when an e2e test asks for it, so its privacy wiring can be tested. */
export function TestAnalytics() {
  const on = useSyncExternalStore(noSubscribe, () => window.__bbTestAhrefs === true, () => false);
  return on ? <AhrefsAnalytics /> : null;
}
