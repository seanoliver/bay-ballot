"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSend } from "@/lib/analytics";

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
