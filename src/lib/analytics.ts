import type { BeforeSendEvent } from "@vercel/analytics";

// Query params that could carry where someone lives or what they searched for. None exist today;
// an address or ZIP lookup would add them, and they must never reach analytics.
const PRIVATE_PARAMS = new Set(["addr", "zip", "q"]);

export function scrubUrl(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) {
    if (PRIVATE_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  return u.toString();
}

// Page views only, with private params removed.
export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  return { ...event, url: scrubUrl(event.url) };
}
