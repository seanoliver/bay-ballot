import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { ExtractClient, ExtractOutput } from "@/pipeline/extract";
import type { Fetched } from "@/pipeline/fetch";
import { normalizePageText, sourceSlug } from "@/pipeline/pagestore";
import { exitCodeFor, runRefresh, seedPages, summarize, type GuideResult } from "@/pipeline/refresh";
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
  for (const g of guides) {
    fs.writeFileSync(path.join(root, "guides", `${g}.yml`), `id: ${g}\nname: ${g.toUpperCase()}\ndescription: d\ntype: club\nhomepage: https://${g}.org/\n`);
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

  it("holds unconfirmed picks and exits 2", async () => {
    const root = setup(["alpha"], { stored: false });
    const { client } = fakeClient(extractOut, { held: true });
    const results = await runRefresh(deps(client, fetcher({ alpha: PAGE("alpha", "x") })), { root, election: ELECTION });
    const r = results[0] as Extract<GuideResult, { status: "changed" }>;
    expect(r.held.map((h) => h.contestId)).toEqual(["prop-c"]);
    expect(exitCodeFor(results)).toBe(2);
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
    expect(md).toContain("Estimated model cost: $3.00"); // 1M in at $2 + 100K out at $10
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
