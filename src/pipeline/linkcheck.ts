import type { ArchivedSource, EndorsementFile } from "@/lib/schema";
import type { FetchFn } from "./archive";
import { UA } from "./fetch";

export type LinkState = "live" | "gone" | "unknown";

const TIMEOUT_MS = 20_000;
const GONE_STATUS = new Set([404, 410]);

/** Only a missing page, a dead domain or a redirect to the site's home page counts as gone; blocks and outages stay unknown. */
export async function probeLink(url: string, fetchFn: FetchFn = fetch): Promise<LinkState> {
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const code = (e as { cause?: { code?: string } })?.cause?.code;
    return code === "ENOTFOUND" ? "gone" : "unknown";
  }
  await res.body?.cancel().catch(() => {});
  if (GONE_STATUS.has(res.status)) return "gone";
  if (!res.ok) return "unknown";
  const from = new URL(url);
  const to = res.url ? new URL(res.url) : from;
  return from.pathname !== "/" && to.pathname === "/" ? "gone" : "live";
}

export type LinkChange = { source: string; was: "live" | "gone"; now: "live" | "gone" };

/** Marks each archived source gone or live again. Returns null when nothing changed. */
export async function checkLinks(
  file: EndorsementFile,
  { today, probe = probeLink }: { today: string; probe?: (url: string) => Promise<LinkState> },
): Promise<{ file: EndorsementFile; changes: LinkChange[] } | null> {
  if (!file.archived?.length) return null;
  const changes: LinkChange[] = [];
  const archived: ArchivedSource[] = [];
  for (const a of file.archived) {
    const state = await probe(a.source);
    const was = a.gone ? "gone" : "live";
    if (state === "gone" && !a.gone) {
      archived.push({ ...a, gone: today });
      changes.push({ source: a.source, was, now: "gone" });
    } else if (state === "live" && a.gone) {
      archived.push({ source: a.source, snapshot: a.snapshot });
      changes.push({ source: a.source, was, now: "live" });
    } else archived.push(a);
  }
  return changes.length ? { file: { ...file, archived }, changes } : null;
}
