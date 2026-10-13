import type { BeforeSendEvent } from "@vercel/analytics";

// An address or ZIP filter must never reach analytics: add its params here.
// `mine` (the ZIP ballot flag) is allowed: it says a ZIP is saved, never which one.
// `pin` is allowed too: it names public guides, like `off`, and nothing about where the reader lives.
const PRIVATE_PARAMS = new Set(["addr", "zip", "q"]);

export function scrubUrl(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) {
    if (PRIVATE_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  return u.toString();
}

export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  return { ...event, url: scrubUrl(event.url) };
}
