import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extract, pagesFor, systemPrompt, toEntries, type ExtractClient, type ExtractOutput } from "@/pipeline/extract";
import { loadElection } from "@/lib/data";
import type { Contest } from "@/lib/schema";
import type { Page } from "@/pipeline/quotes";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");

describe("systemPrompt", () => {
  const prompt = systemPrompt(ballot);

  it("limits extraction to this election", () => {
    expect(prompt).toContain(
      "Extract only endorsements for the San Francisco General Election on 2026-11-03; ignore every other election.",
    );
  });

  it("lists every contest id", () => {
    for (const c of ballot.contests) expect(prompt).toContain(`"${c.id}"`);
  });

  it("is deterministic so the cached prefix is reused", () => {
    expect(systemPrompt(ballot)).toBe(prompt);
  });
});

const contest = (c: Partial<Contest> & Pick<Contest, "id" | "kind">): Contest => ({
  section: "Local",
  title: c.id,
  candidates: [],
  seats: 1,
  jurisdiction: { level: "city", name: "San Francisco" },
  ...c,
});

const contests: Contest[] = [
  contest({ id: "prop-b", kind: "measure" }),
  contest({ id: "retain-smith", kind: "retention" }),
  contest({ id: "assessor", kind: "candidate", candidates: ["Joaquín Torres", "Jane Doe"] }),
  contest({ id: "supervisor-d8", kind: "candidate", candidates: ["Gary McCoy", "Michael T. Nguyen", "Rafael Mandelman"] }),
];

const pages: Page[] = [
  { url: "https://guide.org/", kind: "html", text: "Prop B\nWe oppose Prop B. A public bank would cost the city hundreds of millions of dollars." },
  { url: "https://guide.org/d8", kind: "html", text: "District 8\nGary McCoy has spent a decade fixing our parks and streets." },
];

type ModelPick = ExtractOutput["picks"][number];
const pick = (p: Partial<ModelPick> & Pick<ModelPick, "contestId">): ModelPick => ({
  vote: null,
  candidates: [],
  ranked: false,
  quotes: [],
  ...p,
});
const run = (...picks: ModelPick[]) => toEntries({ hasReasoning: true, picks }, contests, pages);

describe("toEntries", () => {
  it("maps a measure pick", () => {
    const r = run(pick({ contestId: "prop-b", vote: "N" }));
    expect(r.picks["prop-b"]).toEqual({ pick: "N", ranked: false, quotes: [] });
    expect(r.notes).toEqual([]);
  });

  it("forces ranked false on measures", () => {
    expect(run(pick({ contestId: "retain-smith", vote: "Y", ranked: true })).picks["retain-smith"].ranked).toBe(false);
  });

  it("maps a candidate pick with an exact name", () => {
    const r = run(pick({ contestId: "assessor", candidates: ["Jane Doe"] }));
    expect(r.picks.assessor).toEqual({ pick: ["Jane Doe"], ranked: false, quotes: [] });
    expect(r.notes).toEqual([]);
  });

  it("normalizes a fuzzy name to the official one and notes it", () => {
    const r = run(pick({ contestId: "assessor", candidates: ["Joaquin Torres"] }));
    expect(r.picks.assessor.pick).toEqual(["Joaquín Torres"]);
    expect(r.notes).toContain("assessor: 'Joaquin Torres' -> 'Joaquín Torres'");
  });

  it("notes and skips unknown candidates; skips the pick when none remain", () => {
    const r = run(
      pick({ contestId: "assessor", candidates: ["Nobody Here", "Jane Doe"] }),
      pick({ contestId: "supervisor-d8", candidates: ["Someone Else"] }),
    );
    expect(r.picks.assessor.pick).toEqual(["Jane Doe"]);
    expect(r.notes).toContain("assessor: unknown candidate 'Nobody Here'");
    expect(r.notes).toContain("supervisor-d8: unknown candidate 'Someone Else'");
    expect(r.picks["supervisor-d8"]).toBeUndefined();
  });

  it("notes and skips unknown contests", () => {
    const r = run(pick({ contestId: "prop-zz", vote: "Y" }));
    expect(r.picks).toEqual({});
    expect(r.notes).toContain("unknown contest prop-zz");
  });

  it("notes and skips picks that don't match the contest kind", () => {
    const r = run(
      pick({ contestId: "assessor", vote: "Y", candidates: ["Jane Doe"] }),
      pick({ contestId: "prop-b", vote: "Y", candidates: ["Jane Doe"] }),
    );
    expect(r.picks).toEqual({});
    expect(r.notes).toContain("assessor: pick doesn't match contest kind");
    expect(r.notes).toContain("prop-b: pick doesn't match contest kind");
  });

  it("notes and skips a measure pick without a vote", () => {
    const r = run(pick({ contestId: "prop-b" }));
    expect(r.picks).toEqual({});
    expect(r.notes).toEqual(["prop-b: measure pick has no vote"]);
  });

  it("keeps verified quotes with their source page and drops paraphrases with a reason", () => {
    const r = run(
      pick({
        contestId: "prop-b",
        vote: "N",
        quotes: [
          "A public bank would cost the city hundreds of millions of dollars.",
          "Banks are bad and expensive overall for the city.",
        ],
      }),
      pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy"], quotes: ["Gary McCoy has spent a decade fixing our parks and streets."] }),
    );
    expect(r.picks["prop-b"].quotes).toEqual([
      { text: "A public bank would cost the city hundreds of millions of dollars.", source: "https://guide.org/" },
    ]);
    expect(r.picks["supervisor-d8"].quotes).toEqual([
      { text: "Gary McCoy has spent a decade fixing our parks and streets.", source: "https://guide.org/d8" },
    ]);
    expect(r.notes).toContain("prop-b: dropped quote (not-found)");
  });

  it("only checks the first three quotes", () => {
    const q = "A public bank would cost the city hundreds of millions of dollars.";
    const r = run(pick({ contestId: "prop-b", vote: "N", quotes: ["x1 x2 x3 x4 x5 x6", "y1 y2 y3 y4 y5 y6", "z1 z2 z3 z4 z5 z6", q] }));
    expect(r.picks["prop-b"].quotes).toEqual([]);
    expect(r.notes.filter((n) => n.startsWith("prop-b: dropped quote"))).toHaveLength(3);
  });

  it("keeps a dual unranked endorsement", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Rafael Mandelman"] }));
    expect(r.picks["supervisor-d8"]).toEqual({ pick: ["Gary McCoy", "Rafael Mandelman"], ranked: false, quotes: [] });
  });

  it("preserves ranked order", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Michael T. Nguyen", "Gary McCoy"], ranked: true }));
    expect(r.picks["supervisor-d8"]).toEqual({ pick: ["Michael T. Nguyen", "Gary McCoy"], ranked: true, quotes: [] });
  });

  it("dedupes names, including fuzzy matches of the same candidate", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael Nguyen", "Gary McCoy", "Michael T. Nguyen"], ranked: true }));
    expect(r.picks["supervisor-d8"].pick).toEqual(["Gary McCoy", "Michael T. Nguyen"]);
  });
});

describe("pagesFor", () => {
  it("turns fetched sources into pages for quote verification", () => {
    expect(
      pagesFor([
        { url: "https://a.org/", fetched: { kind: "text", text: "Hello" } },
        { url: "https://a.org/g.pdf", fetched: { kind: "pdf", base64: "QUJD", text: "PDF text" } },
      ]),
    ).toEqual([
      { url: "https://a.org/", text: "Hello", kind: "html" },
      { url: "https://a.org/g.pdf", text: "PDF text", kind: "pdf" },
    ]);
  });
});

describe("extract", () => {
  const output: ExtractOutput = { hasReasoning: false, picks: [pick({ contestId: "prop-b", vote: "Y" })] };
  const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 };
  const fakeClient = (response: { text?: string; [k: string]: unknown }) => {
    const { text = JSON.stringify(output), ...rest } = response;
    const create = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      stop_details: null,
      usage,
      content: [{ type: "text", text }],
      ...rest,
    });
    return { client: { messages: { create } } as unknown as ExtractClient, create };
  };
  const sources = [
    { url: "https://guide.org/slate.pdf", fetched: { kind: "pdf" as const, base64: "JVBERi0=", text: "" } },
    { url: "https://guide.org/why", fetched: { kind: "text" as const, text: "We support Prop B." } },
  ];

  it("sends the cached ballot prompt, PDF before its marker, and the output format", async () => {
    const { client, create } = fakeClient({});
    const r = await extract(client, ballot, sources);
    expect(r).toEqual({ output, usage });

    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-sonnet-5-5");
    expect(req.max_tokens).toBe(16000);
    expect(req.system[0]).toEqual({ type: "text", text: systemPrompt(ballot), cache_control: { type: "ephemeral" } });
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.output_config.format.schema).toBeDefined();
    expect(req.thinking).toBeUndefined();
    expect(req.temperature).toBeUndefined();
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    expect(req.messages[0].content).toEqual([
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" } },
      { type: "text", text: "--- https://guide.org/slate.pdf ---" },
      { type: "text", text: "--- https://guide.org/why ---\nWe support Prop B." },
      { type: "text", text: "Extract this organization's endorsements." },
    ]);
  });

  it("throws refused with the category, even when the text isn't JSON", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "general_harms", explanation: null },
      text: "I can't help with that.",
    });
    await expect(extract(client, ballot, sources)).rejects.toThrow("refused: general_harms");
  });

  it("throws the max_tokens message when the JSON was cut off", async () => {
    const { client } = fakeClient({ stop_reason: "max_tokens", text: '{"hasReasoning": true, "picks": [{"contestId": "pro' });
    await expect(extract(client, ballot, sources)).rejects.toThrow(/hit max_tokens/);
  });

  it("throws the schema message when the text isn't JSON", async () => {
    const { client } = fakeClient({ text: "not json" });
    await expect(extract(client, ballot, sources)).rejects.toThrow(/^model output did not match the schema: /);
  });

  it("throws the schema message with the first issue when JSON fails the schema", async () => {
    const { client } = fakeClient({ text: JSON.stringify({ hasReasoning: "yes", picks: [] }) });
    await expect(extract(client, ballot, sources)).rejects.toThrow(/^model output did not match the schema: hasReasoning: /);
  });

  it("joins multiple text blocks before parsing", async () => {
    const json = JSON.stringify(output);
    const { client } = fakeClient({
      content: [
        { type: "text", text: json.slice(0, 10) },
        { type: "text", text: json.slice(10) },
      ],
    });
    expect((await extract(client, ballot, sources)).output).toEqual(output);
  });
});
