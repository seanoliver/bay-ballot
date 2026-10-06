import { describe, expect, it, vi } from "vitest";
import { archiveUrl } from "@/pipeline/archive";

const SRC = "https://growsf.org/voter-guide/nov-2026/";
const SNAP = `https://web.archive.org/web/20261005123456/${SRC}`;

const respond = (init: { status?: number; headers?: Record<string, string>; url?: string }) => {
  const res = new Response(null, { status: init.status ?? 200, headers: init.headers });
  if (init.url) Object.defineProperty(res, "url", { value: init.url });
  return res;
};

describe("archiveUrl", () => {
  it("asks the Wayback Machine to save the url", async () => {
    const fetchFn = vi.fn(async () => respond({ headers: { "content-location": `/web/20261005123456/${SRC}` } }));
    await archiveUrl(SRC, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String((fetchFn.mock.calls[0] as unknown[])[0])).toBe(`https://web.archive.org/save/${SRC}`);
  });

  it("reads a relative Content-Location", async () => {
    const fetchFn = async () => respond({ headers: { "content-location": `/web/20261005123456/${SRC}` } });
    expect(await archiveUrl(SRC, fetchFn)).toBe(SNAP);
  });

  it("reads an absolute Location", async () => {
    const fetchFn = async () => respond({ status: 302, headers: { location: SNAP } });
    expect(await archiveUrl(SRC, fetchFn)).toBe(SNAP);
  });

  it("falls back to the final response url", async () => {
    const fetchFn = async () => respond({ url: SNAP });
    expect(await archiveUrl(SRC, fetchFn)).toBe(SNAP);
  });

  it("returns null when no snapshot url comes back", async () => {
    const fetchFn = async () => respond({ url: `https://web.archive.org/save/${SRC}` });
    expect(await archiveUrl(SRC, fetchFn)).toBeNull();
  });

  it("returns null on an error status", async () => {
    const fetchFn = async () => respond({ status: 523, headers: { "content-location": `/web/20261005123456/${SRC}` } });
    expect(await archiveUrl(SRC, fetchFn)).toBeNull();
  });

  it("returns null instead of throwing when fetch fails", async () => {
    const fetchFn = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await archiveUrl(SRC, fetchFn)).toBeNull();
  });

  it("ignores a Location that points off the archive", async () => {
    const fetchFn = async () => respond({ status: 302, headers: { location: "https://evil.example/web/1/x" } });
    expect(await archiveUrl(SRC, fetchFn)).toBeNull();
  });
});
