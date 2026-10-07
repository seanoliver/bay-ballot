import { loadElection } from "@/lib/data";
import type { FetchAttempt, Fetched, FetchOptions } from "./fetch";
import { fetchMode, sourcesFor } from "./sources";

export type FetchCheckRow = {
  guide: string;
  url: string;
  ok: boolean;
  attempts: FetchAttempt[];
  textChars?: number;
  preview?: string;
  error?: string;
};

type Deps = { fetchSource: (url: string, opts?: FetchOptions) => Promise<Fetched> };

export async function fetchCheck(
  deps: Deps,
  { root, election, ids, browser = false }: { root: string; election: string; ids: string[]; browser?: boolean },
): Promise<FetchCheckRow[]> {
  const data = loadElection(root, election);
  const rows: FetchCheckRow[] = [];
  for (const guide of ids) {
    const file = data.endorsements[guide];
    if (!file) {
      rows.push({ guide, url: "", ok: false, attempts: [], error: "no endorsement file" });
      continue;
    }
    for (const url of sourcesFor(file)) {
      const attempts: FetchAttempt[] = [];
      try {
        const f = await deps.fetchSource(url, { browser: fetchMode(file, browser) === "browser", onAttempt: (a) => attempts.push(a) });
        rows.push({ guide, url, ok: true, attempts, textChars: f.text.length, preview: f.text.slice(0, 160).replace(/\s+/g, " ") });
      } catch (e) {
        rows.push({ guide, url, ok: false, attempts, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return rows;
}

export function formatFetchCheck(rows: FetchCheckRow[]): string {
  return rows
    .map((r) => {
      const tries = r.attempts.map((a) => `    ${a.via} ${a.status} ${a.bytes}B${a.blocked ? ` blocked=${a.blocked}` : ""}`);
      const result = r.ok ? `    ok ${r.textChars} chars: ${r.preview}` : `    FAILED: ${r.error}`;
      return [`${r.guide}  ${r.url}`, ...tries, result].join("\n");
    })
    .join("\n");
}
