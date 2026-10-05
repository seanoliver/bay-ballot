const ARCHIVE = "https://web.archive.org";
const SNAPSHOT_PREFIX = `${ARCHIVE}/web/`;
const TIMEOUT_MS = 120_000; // a Wayback capture can take a minute or more

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function snapshot(candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    const u = new URL(candidate, ARCHIVE).toString();
    return u.startsWith(SNAPSHOT_PREFIX) ? u : null;
  } catch {
    return null;
  }
}

/**
 * Ask the Wayback Machine to capture `url` and return the snapshot URL, or null on any
 * failure. Never throws: archiving is best-effort and must not fail an extraction.
 */
export async function archiveUrl(url: string, fetchFn: FetchFn = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(`${ARCHIVE}/save/${url}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 400) return null;
    return (
      snapshot(res.headers.get("content-location")) ??
      snapshot(res.headers.get("location")) ??
      snapshot(res.url || null)
    );
  } catch {
    return null;
  }
}
