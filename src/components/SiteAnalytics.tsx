"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSend } from "@/lib/analytics";

// A client wrapper so the root layout (a server component) can pass beforeSend.
export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
