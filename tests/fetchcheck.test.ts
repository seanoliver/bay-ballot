import { describe, expect, it, vi } from "vitest";
import type { Fetched, FetchOptions } from "@/pipeline/fetch";
import { fetchCheck, formatFetchCheck } from "@/pipeline/fetchcheck";

const root = "data";
const election = "2026-11";

describe("fetchCheck", () => {
  it("fetches each source of the named guides and records every attempt without writing anything", async () => {
    const fetchSource = vi.fn(async (url: string, opts: FetchOptions = {}): Promise<Fetched> => {
      opts.onAttempt?.({ via: "http", status: 403, bytes: 9, blocked: null });
      if (url.includes("sfcadc")) throw new Error(`${url} -> HTTP 403 (browser: HTTP 403)`);
      opts.onAttempt?.({ via: "browser", status: 200, bytes: 5000, blocked: null });
      return { kind: "text", text: "Prop A\nYES" };
    });
    const rows = await fetchCheck({ fetchSource }, { root, election, ids: ["cadc", "spur"] });
    const cadc = rows.filter((r) => r.guide === "cadc");
    expect(cadc).toHaveLength(1);
    expect(cadc[0]).toMatchObject({ ok: false, error: expect.stringContaining("HTTP 403"), attempts: [{ via: "http", status: 403 }] });
    const spur = rows.filter((r) => r.guide === "spur");
    expect(spur.length).toBeGreaterThan(1);
    expect(spur[0]).toMatchObject({ ok: true, textChars: 10, attempts: [{ via: "http" }, { via: "browser", status: 200 }] });
    expect(fetchSource).toHaveBeenCalledWith(expect.stringContaining("sfcadc.org"), expect.objectContaining({ browser: false }));
  });

  it("formats one line per attempt", () => {
    const out = formatFetchCheck([
      { guide: "cadc", url: "https://www.sfcadc.org/endorsements", ok: false, error: "x -> HTTP 403", attempts: [{ via: "http", status: 403, bytes: 9, blocked: null }] },
      { guide: "milk-club", url: "https://www.milkclub.org/endorsements", ok: true, textChars: 4200, preview: "Endorsements", attempts: [{ via: "http", status: 200, bytes: 90000, blocked: "cloudflare challenge" }] },
    ]);
    expect(out).toContain("cadc  https://www.sfcadc.org/endorsements");
    expect(out).toContain("http 403 9B");
    expect(out).toContain("FAILED: x -> HTTP 403");
    expect(out).toContain("http 200 90000B blocked=cloudflare challenge");
    expect(out).toContain("ok 4200 chars");
  });
});
