import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { extract, ExtractOutput, keepPrevQuotes, pagesFor, systemPrompt, toEntries, type ExtractClient } from "@/pipeline/extract";
import { loadElection } from "@/lib/data";
import type { Contest, Entry, Guide } from "@/lib/schema";
import type { Page } from "@/pipeline/quotes";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");

describe("systemPrompt", () => {
  const prompt = systemPrompt(ballot);

  it("limits extraction to this election", () => {
    expect(prompt).toContain(
      "Extract only endorsements for the Bay Area General Election on 2026-11-03; ignore every other election.",
    );
  });

  it("lists every contest id", () => {
    for (const c of ballot.contests) expect(prompt).toContain(`"${c.id}"`);
  });

  it("states the same quote rule as the verifier and the runbook", () => {
    for (const part of [
      "Copy two consecutive sentences as one quote only when the second needs the first for its condition or subject",
      "a fact cited as a reason",
      "But, However, And, Moreover, Further, Furthermore, Instead, Additionally, Finally, Still, Yet, So, Plus, Meanwhile, Likewise, Similarly, Thus, Therefore, In addition, As a result, On the other hand, Nevertheless, Nonetheless, Lastly, Second(ly), Third(ly), Besides, Speaking of, That leaves us, Resulting",
      "Summary openers (Overall, In short, Ultimately)",
      "\"this funding\" for the measure's own money",
      "When it names several, They is fine but a He/She quote must also name one of them.",
      "In a two-way race, criticism of or contrast with the named opponent counts.",
    ]) {
      expect(prompt).toContain(part);
    }
  });

  it("is deterministic so the cached prefix is reused", () => {
    expect(systemPrompt(ballot)).toBe(prompt);
  });

  it("limits extraction to the organization's own endorsements", () => {
    expect(prompt).toContain(
      "Extract only this organization's own endorsements; ignore endorsements the pages attribute to other organizations.",
    );
  });

  it("asks for names as printed, not normalized", () => {
    expect(prompt).toContain("Copy candidate names exactly as printed on the page; they are matched to the ballot downstream.");
    expect(prompt).not.toContain("Use the official candidate names");
  });

  it("covers emphatic phrasing, mixed retention, multi-seat and ranked-choice rules", () => {
    expect(prompt).toContain('"Oh Hell Yes!"');
    expect(prompt).toContain('"Strong No"');
    expect(prompt).toContain('"Retain all"');
    expect(prompt).toMatch(/retention contest covering several judges/);
    expect(prompt).toMatch(/up to `seats` names and are never ranked/);
    expect(prompt).toMatch(/Only contests with rankedChoice true can be ranked/);
  });

  it("asks for quotes that give reasons, not announcements", () => {
    expect(prompt).toContain(
      "- Each quote must give a reason for the pick: a policy argument, the candidate's record or qualifications, a consequence of the vote, or a fact cited as a reason.",
    );
  });

  it("explains partial ranking", () => {
    expect(prompt).toContain("If only some names are ranked, list ranked names first and set rankedCount");
  });

  it("asks for quotes that stand alone", () => {
    expect(prompt).toContain(
      "- Each quote must make sense shown alone under its contest and pick:",
    );
  });

  it("uses only schema keywords structured outputs accept (no integer bounds)", () => {
    const json = JSON.stringify(z.toJSONSchema(ExtractOutput));
    expect(json).not.toMatch(/"(minimum|maximum|exclusiveMinimum|exclusiveMaximum)"/);
  });

  it("marks ranked-choice contests in the contest JSON", () => {
    expect(prompt).toContain('"id":"supervisor-8","title":"Board of Supervisors, District 8","kind":"candidate"');
    expect(prompt).toMatch(/"id":"supervisor-8"[^}]*"rankedChoice":true/);
    expect(prompt).toMatch(/"id":"board-of-education"[^}]*"rankedChoice":false/);
  });
});

const contest = (c: Partial<Contest> & Pick<Contest, "id" | "kind">): Contest => ({
  section: "Local",
  title: c.id,
  candidates: [],
  seats: 1,
  rankedChoice: false,
  jurisdiction: { level: "city", name: "San Francisco" },
  ...c,
});

const contests: Contest[] = [
  contest({ id: "prop-b", kind: "measure" }),
  contest({ id: "retain-smith", kind: "retention" }),
  contest({ id: "assessor", kind: "candidate", candidates: ["Joaquín Torres", "Jane Doe"] }),
  contest({ id: "supervisor-d8", kind: "candidate", rankedChoice: true, candidates: ["Gary McCoy", "Michael T. Nguyen", "Rafael Mandelman"] }),
  contest({ id: "assessor-plain", kind: "candidate", candidates: ["Jane Doe", "John Roe"] }),
  contest({ id: "school-board", kind: "candidate", seats: 3, rankedChoice: true, candidates: ["A One", "B Two", "C Three"] }),
  contest({ id: "public-defender", kind: "candidate", candidates: ["Mano Raju"], aliases: { "Mano Raju": ["Manohar Raju"] } }),
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
  rankedCount: null,
  quotes: [],
  note: null,
  ...p,
});
const run = (...picks: ModelPick[]) => toEntries({ hasReasoning: true, picks }, contests, pages);

describe("toEntries", () => {
  it("resolves a contest alias to the official name and notes it", () => {
    const r = run(pick({ contestId: "public-defender", candidates: ["Manohar Raju"] }));
    expect(r.picks["public-defender"]).toEqual({ pick: ["Mano Raju"], ranked: false, quotes: [] });
    expect(r.notes).toEqual(["public-defender: 'Manohar Raju' -> 'Mano Raju'"]);
  });

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

  it("drops the whole pick when any name is unknown, since a partial pick changes its meaning", () => {
    const r = run(
      pick({ contestId: "assessor", candidates: ["Nobody Here", "Jane Doe"] }),
      pick({ contestId: "supervisor-d8", candidates: ["Someone Else"] }),
    );
    expect(r.picks.assessor).toBeUndefined();
    expect(r.picks["supervisor-d8"]).toBeUndefined();
    expect(r.notes).toContain(
      "assessor: PICK DROPPED — unknown candidate 'Nobody Here' (would change the pick's meaning)",
    );
    expect(r.notes).toContain(
      "supervisor-d8: PICK DROPPED — unknown candidate 'Someone Else' (would change the pick's meaning)",
    );
  });

  it("holds a pick whose name is close to one candidate's, with that candidate and the page's spelling", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyan"] }));
    expect(r.picks["supervisor-d8"]).toBeUndefined();
    expect(r.held).toEqual([
      expect.objectContaining({ contestId: "supervisor-d8", pick: ["Gary McCoy", "Michael T. Nguyen"], reason: "name-mismatch", evidence: expect.stringContaining("`Michael T. Nguyan`") }),
    ]);
    expect(r.notes.some((n) => n.includes("PICK DROPPED"))).toBe(false);
  });

  it("keeps the ranking on a held pick", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyan"], ranked: true, rankedCount: 1 }));
    expect(r.held[0]).toMatchObject({ ranked: true, rankedCount: 1 });
  });

  it("keeps the first of a contest returned twice when the first is held", () => {
    const r = run(
      pick({ contestId: "supervisor-d8", candidates: ["Michael T. Nguyan"] }),
      pick({ contestId: "supervisor-d8", candidates: ["Michael T. Nguyen"] }),
    );
    expect(r.held).toHaveLength(1);
    expect(r.picks["supervisor-d8"]).toBeUndefined();
    expect(r.notes).toContain("supervisor-d8: duplicate pick, kept first");
    expect(r.notes.some((n) => n.startsWith("supervisor-d8: PICK HELD"))).toBe(true);
  });

  it("shows the page's spelling on one line as code, so it can't add links or mentions", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary\nMcCoyy `[x](https://e.example) @someone`"] }));
    expect(r.held).toHaveLength(0);
    const near = run(pick({ contestId: "supervisor-d8", candidates: ["Michael T.\nNguyan`"] }));
    expect(near.held[0].evidence).toMatch(/^the page names `Michael T\. Nguyan`, not on the ballot; closest `Michael T\. Nguyen`/);
  });

  it("passes the guide's own names to quote verification", () => {
    const q = "SPUR believes the bank is a smart investment in housing.";
    const pg = [{ url: "https://a.org/g", text: `Critics say the bank is costly. ${q}`, kind: "html" as const }];
    const out = { hasReasoning: true, picks: [pick({ contestId: "prop-b", vote: "Y", quotes: [q] })] };
    expect(toEntries(out, contests, pg).picks["prop-b"].quotes).toEqual([]);
    expect(toEntries(out, contests, pg, { ownNames: ["SPUR"] }).picks["prop-b"].quotes).toEqual([
      { text: q, source: "https://a.org/g" },
    ]);
  });

  it("keeps a partial ranking reported by the model", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyen", "Rafael Mandelman"], ranked: true, rankedCount: 1 }));
    expect(r.picks["supervisor-d8"]).toEqual({
      pick: ["Gary McCoy", "Michael T. Nguyen", "Rafael Mandelman"], ranked: true, rankedCount: 1, quotes: [],
    });
  });
  it("drops a rankedCount that covers every name or is out of range", () => {
    const all = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, rankedCount: 2 }));
    expect(all.picks["supervisor-d8"]).toEqual({ pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, quotes: [] });
    const zero = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, rankedCount: 0 }));
    expect(zero.picks["supervisor-d8"].rankedCount).toBeUndefined();
    const frac = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Michael T. Nguyen", "Rafael Mandelman"], ranked: true, rankedCount: 1.5 }));
    expect(frac.picks["supervisor-d8"].rankedCount).toBeUndefined();
  });

  it("never ranks a single-name pick", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy"], ranked: true }));
    expect(r.picks["supervisor-d8"]).toEqual({ pick: ["Gary McCoy"], ranked: false, quotes: [] });
    expect(r.notes).toEqual([]);
  });

  it("drops quotes that sit under another contest's heading", () => {
    const pg: Page[] = [{
      url: "https://g.org/",
      kind: "html",
      text: "Yes on RTM\nTransit funding keeps the whole region moving every day.\nNo on Prop G\nReopening the road would increase congestion on the west side and hurt local businesses.",
    }];
    const q1 = "Transit funding keeps the whole region moving every day.";
    const q2 = "Reopening the road would increase congestion on the west side and hurt local businesses.";
    const out = { hasReasoning: true, picks: [pick({ contestId: "rtm", vote: "Y", quotes: [q1, q2] })] };
    const r = toEntries(out, ballot.contests, pg);
    expect(r.picks.rtm.quotes).toEqual([{ text: q1, source: "https://g.org/" }]);
    expect(r.notes).toContain(`rtm: dropped quote (wrong-contest, under prop-g): "${q2.slice(0, 80)}…"`);
  });

  it("drops quotes that lean on an earlier sentence", () => {
    const pg: Page[] = [{ url: "https://g.org/", kind: "html", text: "Prop B\nWe oppose Prop B. This will only make the deficit worse for years." }];
    const out = { hasReasoning: true, picks: [pick({ contestId: "prop-b", vote: "N", quotes: ["This will only make the deficit worse for years."] })] };
    const r = toEntries(out, contests, pg);
    expect(r.picks["prop-b"].quotes).toEqual([]);
    expect(r.notes).toContain(`prop-b: dropped quote (not-standalone: opens with "This" pointing back): "This will only make the deficit worse for years."`);
  });

  it("keeps a two-sentence quote whose first sentence gives the second its condition, judged as a unit", () => {
    const pair = "If Prop B fails, the city will have no way to close the gap. Services will be cut by a third across every department.";
    const back = "This will only make the deficit worse for years. Services will be cut by a third across every department.";
    const pg: Page[] = [{ url: "https://g.org/", kind: "html", text: `Prop B\nWe support Prop B. ${pair}\nProp B again\nWe support Prop B. ${back}` }];
    const out = { hasReasoning: true, picks: [pick({ contestId: "prop-b", vote: "Y", quotes: [pair, back] })] };
    const r = toEntries(out, contests, pg);
    expect(r.picks["prop-b"].quotes).toEqual([{ text: pair, source: "https://g.org/" }]);
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
    expect(r.notes).toContain('prop-b: dropped quote (not-found): "Banks are bad and expensive overall for the city."');
  });

  it("only checks the first three quotes", () => {
    const q = "A public bank would cost the city hundreds of millions of dollars.";
    const r = run(pick({ contestId: "prop-b", vote: "N", quotes: ["x1 x2 x3 x4 x5 x6", "y1 y2 y3 y4 y5 y6", "z1 z2 z3 z4 z5 z6", q] }));
    expect(r.picks["prop-b"].quotes).toEqual([]);
    expect(r.notes.filter((n) => n.startsWith("prop-b: dropped quote"))).toHaveLength(3);
  });

  it("truncates long dropped quotes to 80 characters in the note", () => {
    const long = "This sentence is made up and long enough that the note must cut it short somewhere past eighty characters.";
    const r = run(pick({ contestId: "prop-b", vote: "N", quotes: [long] }));
    expect(r.notes).toEqual([`prop-b: dropped quote (not-found): "${long.slice(0, 80)}…"`]);
  });

  it("notes a candidate pick that lists no candidates", () => {
    const r = run(pick({ contestId: "assessor" }));
    expect(r.picks).toEqual({});
    expect(r.notes).toEqual(["assessor: pick lists no candidates"]);
  });

  it("keeps the first of duplicate picks for a contest", () => {
    const r = run(pick({ contestId: "prop-b", vote: "N" }), pick({ contestId: "prop-b", vote: "Y" }));
    expect(r.picks["prop-b"].pick).toBe("N");
    expect(r.notes).toEqual(["prop-b: duplicate pick, kept first"]);
  });

  it("passes the model's note through, even when the pick is skipped", () => {
    const r = run(
      pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy"], note: "Only endorses for the first round." }),
      pick({ contestId: "retain-smith", note: "Retain all except Justice Banke." }),
    );
    expect(r.picks["supervisor-d8"].pick).toEqual(["Gary McCoy"]);
    expect(r.picks["retain-smith"]).toBeUndefined();
    expect(r.notes).toContain("supervisor-d8: model note: Only endorses for the first round.");
    expect(r.notes).toContain("retain-smith: model note: Retain all except Justice Banke.");
  });

  it("keeps a dual unranked endorsement", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Gary McCoy", "Rafael Mandelman"] }));
    expect(r.picks["supervisor-d8"]).toEqual({ pick: ["Gary McCoy", "Rafael Mandelman"], ranked: false, quotes: [] });
  });

  it("preserves ranked order", () => {
    const r = run(pick({ contestId: "supervisor-d8", candidates: ["Michael T. Nguyen", "Gary McCoy"], ranked: true }));
    expect(r.picks["supervisor-d8"]).toEqual({ pick: ["Michael T. Nguyen", "Gary McCoy"], ranked: true, quotes: [] });
  });

  it("unranks a pick on a contest without ranked-choice voting", () => {
    const r = run(pick({ contestId: "assessor-plain", candidates: ["Jane Doe", "John Roe"], ranked: true }));
    expect(r.picks["assessor-plain"]).toEqual({ pick: ["Jane Doe", "John Roe"], ranked: false, quotes: [] });
    expect(r.notes).toEqual(["assessor-plain: ranked ignored (not a ranked-choice contest)"]);
  });

  it("unranks a pick on a multi-seat contest", () => {
    const r = run(pick({ contestId: "school-board", candidates: ["A One", "B Two"], ranked: true }));
    expect(r.picks["school-board"].ranked).toBe(false);
    expect(r.notes).toEqual(["school-board: ranked ignored (not a ranked-choice contest)"]);
  });

  it("does not note an unranked pick on a non-RCV contest", () => {
    expect(run(pick({ contestId: "assessor-plain", candidates: ["Jane Doe"] })).notes).toEqual([]);
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
  const guide: Guide = { id: "growsf", name: "GrowSF", description: "", type: "advocacy", homepage: "https://growsf.org/", areas: ["sf"] };
  const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 };
  const fakeClient = (response: { text?: string; [k: string]: unknown }) => {
    const { text = JSON.stringify(output), ...rest } = response;
    const finalMessage = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      stop_details: null,
      usage,
      content: [{ type: "text", text }],
      ...rest,
    });
    const stream = vi.fn().mockReturnValue({ finalMessage });
    return { client: { messages: { stream } } as unknown as ExtractClient, stream, finalMessage };
  };
  const sources = [
    { url: "https://guide.org/slate.pdf", fetched: { kind: "pdf" as const, base64: "JVBERi0=", text: "" } },
    { url: "https://guide.org/why", fetched: { kind: "text" as const, text: "We support Prop B." } },
  ];

  it("sends the cached ballot prompt, PDF before its marker, and the output format", async () => {
    const { client, stream, finalMessage } = fakeClient({});
    const r = await extract(client, ballot, guide, sources);
    expect(r).toEqual({ output, usage });
    expect(stream).toHaveBeenCalledTimes(1);
    expect(finalMessage).toHaveBeenCalledTimes(1);

    const req = stream.mock.calls[0][0];
    expect(req.model).toBe("claude-sonnet-5-5");
    expect(req.max_tokens).toBe(64000);
    expect(req.system[0]).toEqual({ type: "text", text: systemPrompt(ballot), cache_control: { type: "ephemeral" } });
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.output_config.format.schema).toBeDefined();
    expect(req.thinking).toBeUndefined();
    expect(req.temperature).toBeUndefined();
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    expect(req.messages[0].content).toEqual([
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" },
        title: "https://guide.org/slate.pdf",
      },
      { type: "text", text: "--- https://guide.org/why ---\nWe support Prop B." },
      { type: "text", text: "Organization: GrowSF (https://growsf.org/)\nExtract this organization's endorsements." },
    ]);
    expect(req.system[0].text).not.toContain("GrowSF");
  });

  it("sends a JSON schema that enforces the Y/N vote and closed objects", async () => {
    const { client, stream } = fakeClient({});
    await extract(client, ballot, guide, sources);
    const schema = stream.mock.calls[0][0].output_config.format.schema;
    const deref = (node: Record<string, unknown>): Record<string, unknown> => {
      const ref = node.$ref as string | undefined;
      if (!ref) return node;
      const target = ref.replace("#/", "").split("/").reduce<Record<string, unknown>>((n, k) => n[k] as Record<string, unknown>, schema);
      return deref(target);
    };
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["hasReasoning", "picks"]);
    const pickObj = deref(schema.properties.picks.items);
    expect(pickObj.additionalProperties).toBe(false);
    expect(pickObj.required).toEqual(expect.arrayContaining(["contestId", "vote", "candidates", "ranked", "quotes"]));
    const vote = (pickObj.properties as Record<string, { anyOf: Record<string, unknown>[] }>).vote;
    const enums = vote.anyOf.map(deref).map((v) => v.enum).filter(Boolean);
    expect(enums).toEqual([["Y", "N"]]);
  });

  it("throws refused with the category, even when the text isn't JSON", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "general_harms", explanation: null },
      text: "I can't help with that.",
    });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow("refused (category: general_harms)");
  });

  it("says none when a refusal has no category", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", stop_details: null, text: "" });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow("refused (category: none)");
  });

  it("throws the max_tokens message when the JSON was cut off", async () => {
    const { client } = fakeClient({ stop_reason: "max_tokens", text: '{"hasReasoning": true, "picks": [{"contestId": "pro' });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow(/hit max_tokens/);
  });

  it("throws the schema message when the text isn't JSON", async () => {
    const { client } = fakeClient({ text: "not json" });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow(/^model output did not match the schema: /);
  });

  it("throws the schema message with the first issue when JSON fails the schema", async () => {
    const { client } = fakeClient({ text: JSON.stringify({ hasReasoning: "yes", picks: [] }) });
    await expect(extract(client, ballot, guide, sources)).rejects.toThrow(/^model output did not match the schema: hasReasoning: /);
  });

  it("joins multiple text blocks before parsing", async () => {
    const json = JSON.stringify(output);
    const { client } = fakeClient({
      content: [
        { type: "text", text: json.slice(0, 10) },
        { type: "text", text: json.slice(10) },
      ],
    });
    expect((await extract(client, ballot, guide, sources)).output).toEqual(output);
  });
});

describe("keepPrevQuotes", () => {
  const src = "https://g.org/";
  const q1 = "Reopening the road would increase congestion on the west side and hurt local businesses.";
  const q2 = "The road closure created a park that thousands of families use every weekend.";
  const q3 = "Prop G would undo a decision voters already made at the ballot box.";
  const transit = "Transit funding keeps the whole region moving every day.";
  const pg: Page[] = [{ url: src, kind: "html", text: `No on Prop G\n${q1} ${q2} ${q3}\nYes on RTM\n${transit}` }];
  const quote = (text: string, source = src) => ({ text, source });
  const entry = (pick: Entry["pick"], ...texts: string[]): Entry => ({ pick, ranked: false, quotes: texts.map((t) => quote(t)) });
  const keep = (prev: Record<string, Entry>, picks: Record<string, Entry>, rejected: { text: string; contestId?: string }[] = []) =>
    keepPrevQuotes(prev, picks, ballot.contests, pg, { rejected });

  it("keeps a previous quote the model omitted when it is still on the page under the same contest", () => {
    const r = keep({ "prop-g": entry("N", q1, q2) }, { "prop-g": entry("N", q2) });
    expect(r.picks["prop-g"].quotes).toEqual([quote(q1), quote(q2)]);
    expect(r.notes).toEqual([`prop-g: kept previous quote the model omitted: "${q1.slice(0, 80)}…"`]);
  });

  it("puts restored quotes back in their original positions", () => {
    expect(keep({ "prop-g": entry("N", q1, q2, q3) }, { "prop-g": entry("N", q3) }).picks["prop-g"].quotes).toEqual([quote(q1), quote(q2), quote(q3)]);
    expect(keep({ "prop-g": entry("N", q1, q2, q3) }, { "prop-g": entry("N", q2) }).picks["prop-g"].quotes).toEqual([quote(q1), quote(q2), quote(q3)]);
  });

  it("drops the model's new quotes first when restoring would pass the limit of 3", () => {
    const r = keep({ "prop-g": entry("N", q1, q2, q3) }, { "prop-g": entry("N", "A brand new reason the model found today on the page.", q2) });
    expect(r.picks["prop-g"].quotes).toEqual([quote(q1), quote(q2), quote(q3)]);
    expect(r.notes[0]).toMatch(/^prop-g: dropped new quote to keep the previous ones \(limit 3\)/);
  });

  it("does not keep a quote that is no longer on the page", () => {
    const gone = "The old page said the closure saved the city money on road repairs.";
    const r = keep({ "prop-g": entry("N", gone, q2) }, { "prop-g": entry("N", q2) });
    expect(r.picks["prop-g"].quotes).toEqual([quote(q2)]);
    expect(r.notes).toEqual([`prop-g: previous quote not kept (not-found): "${gone}"`]);
  });

  it("does not repeat a note for a previous quote toEntries already dropped in this run", () => {
    const but = "But the closure cost nothing and the park is already full every weekend.";
    const p: Page[] = [{ url: src, kind: "html", text: `No on Prop G\n${q2} ${but}` }];
    const r = keepPrevQuotes({ "prop-g": entry("N", but, q2) }, { "prop-g": entry("N", q2) }, ballot.contests, p, {
      noted: [{ contestId: "prop-g", text: but }],
    });
    expect(r.notes).toEqual([]);
  });

  it("notes why a previously published quote that now fails the quote rule is not kept", () => {
    const but = "But the closure cost nothing and the park is already full every weekend.";
    const p: Page[] = [{ url: src, kind: "html", text: `No on Prop G
${q2} ${but}` }];
    const r = keepPrevQuotes({ "prop-g": entry("N", but, q2) }, { "prop-g": entry("N", q2) }, ballot.contests, p);
    expect(r.picks["prop-g"].quotes).toEqual([quote(q2)]);
    expect(r.notes).toEqual([`prop-g: previous quote not kept (not-standalone: opens with "But"): "${but}"`]);
  });

  it("does not keep a quote whose source page is no longer one of the guide's pages", () => {
    const prev = { "prop-g": { pick: "N" as const, ranked: false, quotes: [quote(q1, "https://g.org/old"), quote(q2)] } };
    expect(keep(prev, { "prop-g": entry("N", q2) }).picks["prop-g"].quotes).toEqual([quote(q2)]);
  });

  it("does not keep a quote listed in rejectedQuotes", () => {
    const r = keep({ "prop-g": entry("N", q1, q2) }, { "prop-g": entry("N", q2) }, [{ text: q1, contestId: "prop-g" }]);
    expect(r.picks["prop-g"].quotes).toEqual([quote(q2)]);
  });

  it("does not keep quotes when the pick changed", () => {
    expect(keep({ "prop-g": entry("Y", q1) }, { "prop-g": entry("N") }).picks["prop-g"].quotes).toEqual([]);
    const sup = { pick: ["Gary McCoy"], ranked: false, quotes: [quote(q1)] };
    expect(keep({ "supervisor-8": sup }, { "supervisor-8": { ...sup, pick: ["Rafael Mandelman"], quotes: [] } }).picks["supervisor-8"].quotes).toEqual([]);
  });

  it("does not keep a quote that now sits under another contest's heading", () => {
    expect(keep({ rtm: entry("Y", q1, transit) }, { rtm: entry("Y", transit) }).picks.rtm.quotes).toEqual([quote(transit)]);
  });

  it("does not bring back picks the model no longer returns", () => {
    const r = keep({ "prop-g": entry("N", q1), rtm: entry("Y", transit) }, { "prop-g": entry("N") });
    expect(Object.keys(r.picks)).toEqual(["prop-g"]);
  });

  const dashed = "Closing the road was a mistake - a costly one - for every west side family.";
  const d8 = "Gary McCoy has spent a decade fixing parks and streets across the district.";
  const pg2: Page[] = [{ url: src, kind: "html", text: `No on Prop G\n${q1} ${q2} ${dashed}\nDistrict 8\n${d8}` }];
  const keep2 = (prev: Record<string, Entry>, picks: Record<string, Entry>) => keepPrevQuotes(prev, picks, ballot.contests, pg2);

  it("does not restore a quote the model returned with a different dash style", () => {
    const em = dashed.replace(/ - /g, " — ");
    expect(keep2({ "prop-g": entry("N", em) }, { "prop-g": entry("N", dashed) }).picks["prop-g"].quotes).toEqual([quote(dashed)]);
  });

  it("does not restore a quote that overlaps one the model returned", () => {
    const joined = `${q1} ${q2}`;
    expect(keep2({ "prop-g": entry("N", q1) }, { "prop-g": entry("N", joined) }).picks["prop-g"].quotes).toEqual([quote(joined)]);
  });

  it("matches an unranked multi-name pick in any order, and a ranked one only in the same order", () => {
    const names = ["Gary McCoy", "Darshini Patel"];
    const sup = (pick: string[], ranked: boolean, ...texts: string[]): Entry => ({ pick, ranked, quotes: texts.map((t) => quote(t)) });
    const swapped = [...names].reverse();
    expect(keep2({ "supervisor-8": sup(names, false, d8) }, { "supervisor-8": sup(swapped, false) }).picks["supervisor-8"].quotes).toEqual([quote(d8)]);
    expect(keep2({ "supervisor-8": sup(names, true, d8) }, { "supervisor-8": sup(swapped, true) }).picks["supervisor-8"].quotes).toEqual([]);
  });
});
