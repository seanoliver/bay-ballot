import { stringify } from "yaml";
import type { ArchivedSource, EndorsementFile } from "@/lib/schema";
import type { FetchFn } from "./archive";
import { UA } from "./fetch";

export type LinkState = "live" | "gone" | "unknown";

const TIMEOUT_MS = 20_000;
const RECHECK_MS = 60_000;
const GONE_STATUS = new Set([404, 410]);

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
  return res.ok ? "live" : "unknown";
}

export type LinkChange = { source: string; now: "live" | "gone" };

export async function checkLinks(
  file: EndorsementFile,
  {
    today,
    probe = probeLink,
    recheckMs = RECHECK_MS,
  }: { today: string; probe?: (url: string) => Promise<LinkState>; recheckMs?: number },
): Promise<{ archived: ArchivedSource[]; changes: LinkChange[] } | null> {
  if (!file.archived?.length) return null;
  const states = await Promise.all(file.archived.map((a) => probe(a.source)));
  const newlyGone = file.archived.filter((a, i) => states[i] === "gone" && !a.gone);
  if (newlyGone.length) {
    await new Promise((r) => setTimeout(r, recheckMs));
    for (const a of newlyGone) {
      if ((await probe(a.source)) !== "gone") states[file.archived.indexOf(a)] = "unknown";
    }
  }
  const changes: LinkChange[] = [];
  const archived = file.archived.map((a, i): ArchivedSource => {
    if (states[i] === "gone" && !a.gone) {
      changes.push({ source: a.source, now: "gone" });
      return { ...a, gone: today };
    }
    if (states[i] === "live" && a.gone) {
      changes.push({ source: a.source, now: "live" });
      return { source: a.source, snapshot: a.snapshot };
    }
    return a;
  });
  return changes.length ? { archived, changes } : null;
}

export function withArchived(yamlText: string, archived: ArchivedSource[]): string {
  const lines = yamlText.split("\n");
  const start = lines.findIndex((l) => /^archived:\s*$/.test(l));
  if (start < 0) throw new Error("no top-level archived: block");
  let end = start + 1;
  while (end < lines.length && !/^\S/.test(lines[end])) end++;
  while (end > start + 1 && lines[end - 1].trim() === "") end--;
  const block = stringify({ archived }, { lineWidth: 0 }).trimEnd().split("\n");
  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join("\n");
}

export function linkChangeLines(id: string, changes: LinkChange[]): string[] {
  return changes.map((c) => `${id}: ${c.source} is ${c.now === "gone" ? "gone; its quotes now link the Wayback copy" : "back; its quotes link the live page again"}`);
}
