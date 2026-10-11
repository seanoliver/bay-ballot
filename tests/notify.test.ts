import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notify, pushFor } from "@/pipeline/notify";
import type { GuideResult } from "@/pipeline/refresh";
import { reportJson } from "@/pipeline/report";

const API = { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const changed = (extra: Partial<Extract<GuideResult, { status: "changed" }>> = {}): GuideResult =>
  ({ id: "a", status: "changed", dataChanged: true, diff: [], notes: [], held: [], droppedByVerifier: 0, missing: [], usage: { extract: API }, ...extra }) as GuideResult;
const CLEAN = reportJson([{ id: "a", status: "unchanged" }, { id: "b", status: "failed", error: "HTTP 403" }], 1);
const REVIEW = reportJson([{ id: "a", status: "shrunk-skipped", pageHash: "1".repeat(64) }], 2);
const HIGH = reportJson([changed()], 0);

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});
function resultFile(content: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bb-notify-"));
  dirs.push(dir);
  const file = path.join(dir, "result.json");
  if (content !== undefined) fs.writeFileSync(file, JSON.stringify(content));
  return file;
}

function run(content: unknown, opts: Partial<Parameters<typeof notify>[0]> = {}) {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
  const log = vi.fn();
  const done = notify({ resultPath: resultFile(content), scope: "cloud", env: { BAYBALLOT_NTFY_TOPIC: "bb-topic" }, fetch, log, ...opts });
  return { done, fetch, log, headers: () => fetch.mock.calls[0][1].headers as Record<string, string> };
}

describe("pushFor", () => {
  it("is low priority and quiet on a clean run, even with fetch failures", () => {
    expect(pushFor(CLEAN, { scope: "cloud" })).toEqual({
      title: "Bay Ballot refresh: clean", priority: 2, tags: "white_check_mark", body: CLEAN.digest,
    });
  });

  it("is default priority when something needs review, with the alert below the digest", () => {
    expect(pushFor(REVIEW, { scope: "cloud" })).toEqual({
      title: "Bay Ballot refresh: needs review", priority: 3, tags: "eyes", body: `${REVIEW.digest}\n\nreview: 1 item needs review`,
    });
  });

  it("is urgent and names the first high alert in the title", () => {
    const p = pushFor(HIGH, { scope: "local" });
    expect(p).toMatchObject({ title: "Local ALERT: Used the API: 1 call, about $2.00", priority: 5, tags: "rotating_light" });
    expect(p.body).toBe(`${HIGH.digest}\n\nhigh: Used the API: 1 call, about $2.00`);
  });

  it("is urgent when the refresh crashed", () => {
    expect(pushFor(null, { scope: "cloud" })).toMatchObject({ title: "ALERT: Refresh crashed before writing a result", priority: 5 });
  });

  it("asks for review when the refresh branch conflicts with main", () => {
    const p = pushFor(null, { scope: "cloud", conflict: true });
    expect(p).toMatchObject({ title: "Bay Ballot refresh: needs review", priority: 3, tags: "eyes" });
    expect(p.body).toContain("conflicts with main");
  });
});

describe("notify", () => {
  it("sends nothing and says so when no topic is set", async () => {
    const t = run(CLEAN, { env: {} });
    expect(await t.done).toBe("off");
    expect(t.fetch).not.toHaveBeenCalled();
    expect(t.log).toHaveBeenCalledWith(expect.stringContaining("notifications are off"));
  });

  it("posts the digest to the topic on ntfy.sh with low priority on a clean run", async () => {
    const t = run(CLEAN, { click: "https://github.com/o/r/actions/runs/1" });
    expect(await t.done).toBe("sent");
    const [url, init] = t.fetch.mock.calls[0];
    expect(url).toBe("https://ntfy.sh/bb-topic");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(CLEAN.digest);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(t.headers()).toEqual({
      Title: "Bay Ballot refresh: clean", Priority: "2", Tags: "white_check_mark", Click: "https://github.com/o/r/actions/runs/1",
    });
  });

  it("uses BAYBALLOT_NTFY_SERVER when set, and leaves Click out when not given", async () => {
    const t = run(REVIEW, { env: { BAYBALLOT_NTFY_TOPIC: "bb-topic", BAYBALLOT_NTFY_SERVER: "https://ntfy.example.org/" } });
    await t.done;
    expect(t.fetch.mock.calls[0][0]).toBe("https://ntfy.example.org/bb-topic");
    expect(t.headers().Priority).toBe("3");
    expect(t.headers()).not.toHaveProperty("Click");
  });

  it("sends priority 5 for a high alert", async () => {
    const t = run(HIGH);
    await t.done;
    expect(t.headers().Priority).toBe("5");
  });

  it("sends a crashed alert when the result is missing, unreadable, or --crashed is passed", async () => {
    for (const [content, crashed] of [[undefined, false], ["{", false], [CLEAN, true]] as const) {
      const t = run(content, { crashed, click: "https://github.com/o/r/actions/runs/1" });
      await t.done;
      expect(t.headers()).toMatchObject({ Title: "ALERT: Refresh crashed before writing a result", Priority: "5", Click: "https://github.com/o/r/actions/runs/1" });
    }
  });

  it("warns and carries on when the post throws or the server refuses it", async () => {
    const thrown = run(CLEAN, { fetch: vi.fn(async () => { throw new Error("getaddrinfo ENOTFOUND ntfy.sh"); }) });
    expect(await thrown.done).toBe("failed");
    expect(thrown.log).toHaveBeenCalledWith(expect.stringContaining("ENOTFOUND"));
    const refused = run(CLEAN, { fetch: vi.fn(async () => new Response("slow down", { status: 429 })) });
    expect(await refused.done).toBe("failed");
    expect(refused.log).toHaveBeenCalledWith(expect.stringContaining("429"));
  });

  it("encodes a title that is not plain ASCII, as ntfy accepts", async () => {
    const t = run(reportJson([{ id: "a", status: "failed", error: "claude-code naïve (m): x" }], 1));
    await t.done;
    const title = t.headers().Title;
    expect(title).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(Buffer.from(title.slice(10, -2), "base64").toString("utf8")).toBe("ALERT: 1 guide failed in Claude Code: naïve");
  });
});
