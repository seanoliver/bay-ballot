import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { ExtractClient, ExtractOutput } from "@/pipeline/extract";
import type { Fetched } from "@/pipeline/fetch";
import { normalizePageText, sourceSlug } from "@/pipeline/pagestore";
import { pagePath } from "@/pipeline/refresh";
import { exitCodeFor, runRefresh, seedPages, summarize, type GuideResult } from "@/pipeline/refresh";
import { resultJson } from "@/pipeline/refresh";
import type { VerifyOutput } from "@/pipeline/verify";

const ELECTION = "2026-11";
const REAL_BALLOT = path.join(__dirname, "..", "data", ELECTION, "ballot.yml");
const url = (g: string) => `https://${g}.org/endorsements`;

const PAGE = (g: string, stamp: string) =>
  [
    `Posted ${stamp}`,
    "3 hours ago",
    `${g} November endorsements`,
    "No on Prop B: the public bank would cost the city hundreds of millions of dollars.",
    "Yes on Prop C: we need more affordable housing in every neighborhood.",
    "We use cookies to improve your experience. Accept all",
  ].join("\n");

function setup(guides: string[], { stored = true }: { stored?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bb-refresh-"));
  fs.mkdirSync(path.join(root, "guides"));
  fs.mkdirSync(path.join(root, ELECTION, "endorsements"), { recursive: true });
  fs.copyFileSync(REAL_BALLOT, path.join(root, ELECTION, "ballot.yml"));
  fs.copyFileSync(path.join(__dirname, "..", "data", "areas.yml"), path.join(root, "areas.yml"));
  for (const g of guides) {
    fs.writeFileSync(path.join(root, "guides", `${g}.yml`), `id: ${g}\nname: ${g.toUpperCase()}\ndescription: d\ntype: club\nhomepage: https://${g}.org/\nareas: [sf]\n`);
    fs.writeFileSync(
      path.join(root, ELECTION, "endorsements", `${g}.yml`),
      `guide: ${g}\nelection: "${ELECTION}"\nstatus: published\nsource: ${url(g)}\nfetchedAt: 2026-10-05\nhasReasoning: true\npicks:\n  prop-b:\n    pick: N\n`,
    );
    if (stored) {
      const dir = path.join(root, ELECTION, "pages", g);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${sourceSlug(url(g))}.txt`), normalizePageText(PAGE(g, "October 1, 2026")));
    }
  }
  return root;
}

const extractOut: ExtractOutput = {
  hasReasoning: true,
  picks: [
    { contestId: "prop-b", vote: "N", candidates: [], ranked: false, rankedCount: null, quotes: [], note: null },
    { contestId: "prop-c", vote: "Y", candidates: [], ranked: false, rankedCount: null, quotes: [], note: null },
  ],
};
const sameOut: ExtractOutput = { hasReasoning: true, picks: [extractOut.picks[0]] };
const verifyOut = (held: boolean): VerifyOutput => ({
  picks: [
    { contestId: "prop-b", verdict: "confirmed", evidence: "No on Prop B" },
    { contestId: "prop-c", verdict: held ? "wrong-pick" : "confirmed", evidence: "Yes on Prop C" },
  ],
  quotes: [],
  missing: [],
});

function fakeClient(out: ExtractOutput = extractOut, { held = false } = {}) {
  const stream = vi.fn((req: { model: string }) => ({
    finalMessage: async () => ({
      stop_reason: "end_turn",
      stop_details: null,
      usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      content: [{ type: "text", text: JSON.stringify(req.model.includes("opus") ? verifyOut(held) : out) }],
    }),
  }));
  return { client: { messages: { stream } } as unknown as ExtractClient, stream };
}

const fetcher = (pages: Record<string, string>) =>
  vi.fn(async (u: string): Promise<Fetched> => {
    const g = new URL(u).hostname.replace(/\.org$/, "");
    return { kind: "text", text: pages[g] };
  });

const deps = (client: ExtractClient, fetchSource: ReturnType<typeof fetcher>) => ({
  client,
  fetchSource,
  today: () => "2026-10-06",
  log: () => {},
});

describe("runRefresh", () => {
  it("makes zero model calls when pages changed only in dates and boilerplate", async () => {
    const root = setup(["alpha", "beta"]);
    const before = fs.readFileSync(path.join(root, ELECTION, "endorsements", "alpha.yml"), "utf8");
    const { client, stream } = fakeClient();
    const pages = {
      alpha: PAGE("alpha", "October 6, 2026").replace("Accept all", "Accept all cookies"),
      beta: PAGE("beta", "October 6, 2026").replace("3 hours ago", "12 minutes ago"),
    };
    const results = await runRefresh(deps(client, fetcher(pages)), { root, election: ELECTION });
    expect(stream).not.toHaveBeenCalled();
    expect(results.map((r) => r.status)).toEqual(["unchanged", "unchanged"]);
    expect(fs.readFileSync(path.join(root, ELECTION, "endorsements", "alpha.yml"), "utf8")).toBe(before);
    expect(exitCodeFor(results)).toBe(0);
  });

  it("extracts and verifies a guide seen for the first time, and stores its page text", async () => {
    const root = setup(["alpha"], { stored: false });
    const { client, stream } = fakeClient();
    const results = await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "October 6, 2026") })), { root, election: ELECTION });
    expect(stream.mock.calls.map((c) => c[0].model)).toEqual(["claude-sonnet-5-5", "claude-opus-5-5"]);
    const r = results[0] as Extract<GuideResult, { status: "changed" }>;
    expect(r.status).toBe("changed");
    expect(r.dataChanged).toBe(true);
    expect(r.diff).toEqual(["+ prop-c: Y"]);
    const file = parse(fs.readFileSync(path.join(root, ELECTION, "endorsements", "alpha.yml"), "utf8"));
    expect(Object.keys(file.picks)).toEqual(["prop-b", "prop-c"]);
    const stored = fs.readFileSync(path.join(root, ELECTION, "pages", "alpha", `${sourceSlug(url("alpha"))}.txt`), "utf8");
    expect(stored).toBe(normalizePageText(PAGE("alpha", "October 6, 2026")));
  });

  it("extracts on a relevant change but skips verify when the picks come back the same", async () => {
    const root = setup(["alpha"]);
    const { client, stream } = fakeClient(sameOut);
    const page = PAGE("alpha", "October 6, 2026").replace("No on Prop B:", "Strong No on Prop B:");
    const results = await runRefresh(deps(client, fetcher({ alpha: page })), { root, election: ELECTION });
    expect(stream.mock.calls.map((c) => c[0].model)).toEqual(["claude-sonnet-5-5"]);
    expect(results[0]).toMatchObject({ status: "changed", dataChanged: false, diff: [] });
  });

  it("without a baseline writes no changelog files, even on a rerun", async () => {
    const root = setup(["alpha"]);
    const page = PAGE("alpha", "October 6, 2026").replace("No on Prop B:", "Strong No on Prop B:");
    await runRefresh(deps(fakeClient(extractOut).client, fetcher({ alpha: page })), { root, election: ELECTION });
    await runRefresh(deps(fakeClient(extractOut).client, fetcher({ alpha: page })), { root, election: ELECTION, ids: ["alpha"] });
    expect(fs.existsSync(path.join(root, "changelog"))).toBe(false);
  });

  it("refuses an unreadable baseline before writing any data", async () => {
    const root = setup(["alpha"]);
    const main = setup(["alpha"]);
    fs.writeFileSync(path.join(main, ELECTION, "ballot.yml"), "contests: [");
    const before = fs.readFileSync(path.join(root, ELECTION, "endorsements", "alpha.yml"), "utf8");
    const page = PAGE("alpha", "October 6, 2026").replace("No on Prop B:", "Strong No on Prop B:");
    const f = fetcher({ alpha: page });
    await expect(runRefresh(deps(fakeClient(extractOut).client, f), { root, election: ELECTION, baseline: main })).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, ELECTION, "endorsements", "alpha.yml"), "utf8")).toBe(before);
  });

  it("writes one changelog file per changed guide, and a rerun changes nothing", async () => {
    const root = setup(["alpha"]);
    const main = setup(["alpha"]);
    const dir = path.join(root, "changelog");
    const { client } = fakeClient(extractOut);
    const page = PAGE("alpha", "October 6, 2026").replace("No on Prop B:", "Strong No on Prop B:");
    await runRefresh(deps(client, fetcher({ alpha: page })), { root, election: ELECTION, baseline: main });
    expect(fs.readdirSync(dir)).toEqual(["2026-10-06-refresh-alpha.yml"]);
    expect(parse(fs.readFileSync(path.join(dir, "2026-10-06-refresh-alpha.yml"), "utf8"))).toEqual({ date: "2026-10-06", type: "data", title: "ALPHA endorsed Yes on Prop C" });
    const before = fs.readFileSync(path.join(dir, "2026-10-06-refresh-alpha.yml"), "utf8");
    await runRefresh(deps(fakeClient(extractOut).client, fetcher({ alpha: page })), { root, election: ELECTION, baseline: main });
    expect(fs.readdirSync(dir)).toEqual(["2026-10-06-refresh-alpha.yml"]);
    expect(fs.readFileSync(path.join(dir, "2026-10-06-refresh-alpha.yml"), "utf8")).toBe(before);
  });

  it("describes changes against main's data while continuing an open refresh", async () => {
    const main = setup(["alpha"]);
    const root = setup(["alpha"]);
    const f = path.join(root, ELECTION, "endorsements", "alpha.yml");
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("pick: N", "pick: Y"));
    fs.mkdirSync(path.join(root, "changelog"));
    fs.writeFileSync(path.join(root, "changelog", "2026-10-05-refresh-alpha.yml"), "date: 2026-10-05\ntype: data\ntitle: ALPHA changed Prop B from No to Yes\n");
    const { client } = fakeClient(extractOut);
    const page = PAGE("alpha", "October 6, 2026").replace("No on Prop B:", "Strong No on Prop B:");
    await runRefresh(deps(client, fetcher({ alpha: page })), { root, election: ELECTION, baseline: main });
    expect(fs.readdirSync(path.join(root, "changelog"))).toEqual(["2026-10-06-refresh-alpha.yml"]);
    expect(parse(fs.readFileSync(path.join(root, "changelog", "2026-10-06-refresh-alpha.yml"), "utf8")).title).toBe("ALPHA endorsed Yes on Prop C");
  });

  it("refuses a missing baseline before fetching anything", async () => {
    const root = setup(["alpha"]);
    const f = fetcher({ alpha: PAGE("alpha", "x") });
    await expect(runRefresh(deps(fakeClient(extractOut).client, f), { root, election: ELECTION, baseline: path.join(root, "nope") })).rejects.toThrow(/baseline/);
    expect(f).not.toHaveBeenCalled();
  });

  it("does not announce a held pick", async () => {
    const root = setup(["alpha"], { stored: false });
    const main = setup(["alpha"], { stored: false });
    const { client } = fakeClient(extractOut, { held: true });
    await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "x") })), { root, election: ELECTION, baseline: main });
    expect(fs.existsSync(path.join(root, "changelog"))).toBe(false);
  });

  it("holds unconfirmed picks and exits 2", async () => {
    const root = setup(["alpha"], { stored: false });
    const { client } = fakeClient(extractOut, { held: true });
    const results = await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "x") })), { root, election: ELECTION });
    const r = results[0] as Extract<GuideResult, { status: "changed" }>;
    expect(r.held.map((h) => h.contestId)).toEqual(["prop-c"]);
    expect(exitCodeFor(results)).toBe(2);
  });

  it("exits 2 when the verifier skips a pick (held as unverified)", async () => {
    const root = setup(["alpha"], { stored: false });
    const skip = { messages: { stream: vi.fn((req: { model: string }) => ({
      finalMessage: async () => ({
        stop_reason: "end_turn", stop_details: null,
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        content: [{ type: "text", text: JSON.stringify(req.model.includes("opus") ? { ...verifyOut(false), picks: [verifyOut(false).picks[0]] } : extractOut) }],
      }),
    })) } } as unknown as ExtractClient;
    const results = await runRefresh(deps(skip, fetcher({ alpha: PAGE("alpha", "x") })), { root, election: ELECTION });
    const r = results[0] as Extract<GuideResult, { status: "changed" }>;
    expect(r.held).toEqual([expect.objectContaining({ contestId: "prop-c", reason: "unverified" })]);
    expect(exitCodeFor(results)).toBe(2);
  });

  it("re-verifies a guide with held picks even when the extracted picks didn't change", async () => {
    const root = setup(["alpha"]);
    const f = path.join(root, ELECTION, "endorsements", "alpha.yml");
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("picks:\n", "held:\n  - contestId: prop-c\n    pick: Y\n    reason: unverified\n    evidence: no verdict\npicks:\n"));
    const { client, stream } = fakeClient(extractOut);
    const page = PAGE("alpha", "x").replace("No on Prop B:", "Strong No on Prop B:");
    const results = await runRefresh(deps(client, fetcher({ alpha: page })), { root, election: ELECTION });
    expect(stream.mock.calls.map((c) => c[0].model)).toEqual(["claude-sonnet-5-5", "claude-opus-5-5"]);
    const file = parse(fs.readFileSync(f, "utf8"));
    expect(file.held).toBeUndefined();
    expect(Object.keys(file.picks)).toEqual(["prop-b", "prop-c"]);
    expect(exitCodeFor(results)).toBe(0);
  });

  it("stops extracting after the budget and defers the rest without storing their pages", async () => {
    const root = setup(["alpha", "beta"], { stored: false });
    const { client } = fakeClient();
    const results = await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "x"), beta: PAGE("beta", "x") })), {
      root,
      election: ELECTION,
      maxChanged: 1,
    });
    expect(results.map((r) => r.status)).toEqual(["changed", "deferred"]);
    expect(fs.existsSync(path.join(root, ELECTION, "pages", "beta"))).toBe(false);
    expect(exitCodeFor(results)).toBe(0);
  });

  it("re-extracts unchanged pages with forceExtract", async () => {
    const root = setup(["alpha"]);
    const { client, stream } = fakeClient(sameOut);
    await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "October 1, 2026") })), { root, election: ELECTION, forceExtract: true });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("reports a fetch failure and exits 1", async () => {
    const root = setup(["alpha"]);
    const { client } = fakeClient();
    const fetchSource = vi.fn(async () => {
      throw new Error("HTTP 503");
    });
    const results = await runRefresh({ client, fetchSource, today: () => "2026-10-06", log: () => {} }, { root, election: ELECTION });
    expect(results[0]).toMatchObject({ status: "failed" });
    expect(exitCodeFor(results)).toBe(1);
  });
});

describe("summarize", () => {
  it("lists changed, held, deferred and unchanged guides with totals and cost", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as Anthropic.Messages.Usage;
    const results: GuideResult[] = [
      { id: "alpha", status: "unchanged" },
      {
        id: "beta",
        status: "changed",
        dataChanged: true,
        diff: ["+ prop-c: Y"],
        notes: [],
        held: [{ contestId: "prop-d", pick: "Y", reason: "wrong-pick", evidence: "page says No on D" }],
        droppedByVerifier: 1,
        missing: [],
        usage: { extract: usage },
      },
      { id: "gamma", status: "deferred" },
    ];
    const md = summarize(results, { date: "2026-10-06" });
    expect(md).toContain("# Data refresh 2026-10-06");
    expect(md).toContain("needs review");
    expect(md).toContain("### beta");
    expect(md).toContain("+ prop-c: Y");
    expect(md).toContain("HELD prop-d: Y — wrong-pick: page says No on D");
    expect(md).toContain("Deferred (budget): gamma");
    expect(md).toContain("Unchanged: alpha");
    expect(md).toContain("Estimated model cost: $3.00");
  });
});

describe("seedPages", () => {
  it("stores every source's page text without calling a model, so the next run sees no change", async () => {
    const root = setup(["alpha", "beta"], { stored: false });
    const { client, stream } = fakeClient();
    const pages = { alpha: PAGE("alpha", "x"), beta: PAGE("beta", "x") };
    const seeded = await seedPages(deps(client, fetcher(pages)), { root, election: ELECTION });
    expect(seeded.map((s) => [s.id, s.stored])).toEqual([["alpha", 1], ["beta", 1]]);
    expect(stream).not.toHaveBeenCalled();
    const results = await runRefresh(deps(client, fetcher(pages)), { root, election: ELECTION });
    expect(results.map((r) => r.status)).toEqual(["unchanged", "unchanged"]);
    expect(stream).not.toHaveBeenCalled();
  });
});

describe("shrunk guides", () => {
  const fivePicks = (root: string) => {
    const p = path.join(root, ELECTION, "endorsements", "alpha.yml");
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("picks:\n", "picks:\n  prop-c:\n    pick: Y\n  prop-d:\n    pick: Y\n  prop-e:\n    pick: Y\n  prop-f:\n    pick: Y\n"));
  };
  const page = PAGE("alpha", "x").replace("No on Prop B", "Strong No on Prop B");

  it("reports a shrunk guide with its page hash, stores no page text, and exits 2", async () => {
    const root = setup(["alpha"]);
    fivePicks(root);
    const before = fs.readFileSync(pagePath(root, ELECTION, "alpha", url("alpha")), "utf8");
    const { client } = fakeClient(sameOut);
    const results = await runRefresh(deps(client, fetcher({ alpha: page })), { root, election: ELECTION });
    expect(results[0]).toMatchObject({ status: "shrunk", pageHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(fs.readFileSync(pagePath(root, ELECTION, "alpha", url("alpha")), "utf8")).toBe(before);
    expect(exitCodeFor(results)).toBe(2);
    expect(resultJson(results, 2).shrunk).toEqual([{ id: "alpha", pageHash: (results[0] as { pageHash: string }).pageHash }]);
  });

  it("skips re-extracting a shrunk guide whose pages haven't changed since it was reported", async () => {
    const root = setup(["alpha"]);
    fivePicks(root);
    const first = fakeClient(sameOut);
    const [r1] = await runRefresh(deps(first.client, fetcher({ alpha: page })), { root, election: ELECTION });
    const hash = (r1 as { pageHash: string }).pageHash;
    const second = fakeClient(sameOut);
    const results = await runRefresh(deps(second.client, fetcher({ alpha: page })), { root, election: ELECTION, shrunkSkip: { alpha: hash } });
    expect(second.stream).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ status: "shrunk-skipped", pageHash: hash });
    expect(exitCodeFor(results)).toBe(2);
    expect(summarize(results, { date: "2026-10-07" })).toContain("alpha: shrunk earlier, pages unchanged since; not re-extracted");
  });

  it("re-extracts a shrunk guide once its pages change again", async () => {
    const root = setup(["alpha"]);
    fivePicks(root);
    const { client, stream } = fakeClient(sameOut);
    await runRefresh(deps(client, fetcher({ alpha: `${page}\nYes on Prop H: Muni` })), { root, election: ELECTION, shrunkSkip: { alpha: "0".repeat(64) } });
    expect(stream).toHaveBeenCalledTimes(1);
  });
});

describe("resultJson", () => {
  it("lists extracted, deferred, failed and shrunk guides", () => {
    const results: GuideResult[] = [
      { id: "a", status: "failed", error: "HTTP 503" },
      { id: "b", status: "deferred" },
      { id: "c", status: "shrunk-skipped", pageHash: "f".repeat(64) },
    ];
    expect(resultJson(results, 1)).toEqual({
      exitCode: 1,
      extracted: [],
      deferred: ["b"],
      failed: [{ id: "a", error: "HTTP 503" }],
      shrunk: [{ id: "c", pageHash: "f".repeat(64) }],
    });
  });
});
