import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { loadElection } from "@/lib/data";
import type { EndorsementFile, Guide } from "@/lib/schema";
import { systemPrompt, type ExtractClient } from "@/pipeline/extract";
import {
  applyVerdicts,
  hasVerifiable,
  verify,
  VERIFY_MODEL,
  verifierPrompt,
  VerifyOutput,
  type VerifyOutput as VerifyOutputT,
} from "@/pipeline/verify";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");
const guide: Guide = { id: "growsf", name: "GrowSF", description: "", type: "advocacy", homepage: "https://growsf.org/", areas: ["sf"] };
const src = "https://growsf.org/guide";
const q = (text: string) => ({ text, source: src });

const file: EndorsementFile = {
  guide: "growsf",
  election: "2026-11",
  status: "published",
  source: src,
  fetchedAt: "2026-10-05",
  hasReasoning: true,
  picks: {
    "prop-b": { pick: "N", ranked: false, quotes: [q("A public bank would cost the city hundreds of millions."), q("This will only make it worse.")] },
    "prop-c": { pick: "Y", ranked: false, quotes: [] },
    "supervisor-8": { pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, quotes: [] },
  },
};

const allConfirmed: VerifyOutputT = {
  picks: [
    { contestId: "prop-b", verdict: "confirmed", evidence: "No on Prop B" },
    { contestId: "prop-c", verdict: "confirmed", evidence: "Yes on C" },
    { contestId: "supervisor-8", verdict: "confirmed", evidence: "#1 McCoy #2 Nguyen" },
  ],
  quotes: [
    { contestId: "prop-b", index: 1, verdict: "confirmed", evidence: "" },
    { contestId: "prop-b", index: 2, verdict: "confirmed", evidence: "" },
  ],
  missing: [],
};

describe("applyVerdicts", () => {
  it("leaves a fully confirmed file unchanged", () => {
    const r = applyVerdicts(file, allConfirmed);
    expect(r.file).toEqual(file);
    expect(r.held).toEqual([]);
    expect(r.droppedQuotes).toEqual([]);
    expect(r.confirmed).toBe(3);
  });

  it("keeps a pinned pick whatever the verifier says, and drops it from missing", () => {
    const pinned = { ...file, pinned: [{ contestId: "prop-c", pick: "Y" as const, reason: "x" }, { contestId: "prop-d", pick: null, reason: "x" }] };
    const out: VerifyOutputT = {
      ...allConfirmed,
      picks: [allConfirmed.picks[0], allConfirmed.picks[2], { contestId: "prop-c", verdict: "wrong-pick", evidence: "No on C." }],
      missing: [{ contestId: "prop-d", pick: "N", evidence: "No on D." }],
    };
    const r = applyVerdicts(pinned, out);
    expect(r.file.picks["prop-c"]).toEqual(file.picks["prop-c"]);
    expect(r.held).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.notes).toEqual(["prop-c: kept the pinned pick; verifier said wrong-pick: No on C."]);
    expect(applyVerdicts(pinned, { ...out, picks: [allConfirmed.picks[0], allConfirmed.picks[2]] }).file.picks["prop-c"]).toBeDefined();
  });

  it("holds unconfirmed picks and removes them from the published picks", () => {
    const out: VerifyOutputT = {
      ...allConfirmed,
      picks: [
        allConfirmed.picks[0],
        { contestId: "prop-c", verdict: "wrong-pick", evidence: "The page says No on C." },
        { contestId: "supervisor-8", verdict: "wrong-rank", evidence: "Dual endorsement, not ranked." },
      ],
    };
    const r = applyVerdicts(file, out);
    expect(Object.keys(r.file.picks)).toEqual(["prop-b"]);
    expect(r.file.held).toEqual([
      { contestId: "prop-c", pick: "Y", reason: "wrong-pick", evidence: "The page says No on C." },
      { contestId: "supervisor-8", pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, reason: "wrong-rank", evidence: "Dual endorsement, not ranked." },
    ]);
    expect(r.held).toHaveLength(2);
    expect(r.confirmed).toBe(1);
    expect(r.file.status).toBe("published");
  });

  it("marks the file pending when every pick is held, and keeps earlier holds", () => {
    const earlier = { contestId: "prop-d", pick: "Y" as const, reason: "not-found" as const, evidence: "x" };
    const one: EndorsementFile = { ...file, held: [earlier], picks: { "prop-c": file.picks["prop-c"] } };
    const r = applyVerdicts(one, { picks: [{ contestId: "prop-c", verdict: "old-election", evidence: "June 2026 slate" }], quotes: [], missing: [] });
    expect(r.file.picks).toEqual({});
    expect(r.file.status).toBe("pending");
    expect(r.file.held?.map((h) => h.contestId)).toEqual(["prop-d", "prop-c"]);
  });

  it("drops quotes that are not confirmed and notes why", () => {
    const out: VerifyOutputT = {
      ...allConfirmed,
      quotes: [
        { contestId: "prop-b", index: 1, verdict: "confirmed", evidence: "" },
        { contestId: "prop-b", index: 2, verdict: "not-standalone", evidence: "'This' refers to the deficit." },
      ],
    };
    const r = applyVerdicts(file, out);
    expect(r.file.picks["prop-b"].quotes).toEqual([q("A public bank would cost the city hundreds of millions.")]);
    expect(r.droppedQuotes).toEqual([
      { contestId: "prop-b", text: "This will only make it worse.", reason: "not-standalone", evidence: "'This' refers to the deficit." },
    ]);
  });

  it("holds a pick the verifier gave no verdict for", () => {
    const r = applyVerdicts(file, { ...allConfirmed, picks: allConfirmed.picks.slice(0, 2) });
    expect(r.file.picks["supervisor-8"]).toBeUndefined();
    expect(r.held).toEqual([
      { contestId: "supervisor-8", pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, reason: "unverified", evidence: "The verifier returned no verdict for this pick." },
    ]);
  });

  it("drops a quote the verifier gave no verdict for", () => {
    const r = applyVerdicts(file, { ...allConfirmed, quotes: [allConfirmed.quotes[0]] });
    expect(r.file.picks["prop-b"].quotes).toEqual([q("A public bank would cost the city hundreds of millions.")]);
    expect(r.droppedQuotes).toEqual([
      { contestId: "prop-b", text: "This will only make it worse.", reason: "unverified", evidence: "The verifier returned no verdict for this quote." },
    ]);
  });

  it("ignores verdicts for contests or quotes that aren't in the file", () => {
    const r = applyVerdicts(file, {
      picks: [...allConfirmed.picks, { contestId: "prop-z", verdict: "wrong-pick", evidence: "" }],
      quotes: [...allConfirmed.quotes, { contestId: "prop-b", index: 9, verdict: "not-found", evidence: "" }],
      missing: [],
    });
    expect(r.file).toEqual(file);
  });

  describe("re-checking held picks", () => {
    const heldD8 = {
      contestId: "supervisor-8", pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true,
      quotes: [q("McCoy has fixed our parks for a decade.")], reason: "unverified" as const, evidence: "no verdict",
    };
    const withHeld: EndorsementFile = { ...file, picks: { "prop-b": file.picks["prop-b"] }, held: [heldD8] };
    const base: VerifyOutputT = { picks: [allConfirmed.picks[0]], quotes: allConfirmed.quotes, missing: [] };

    it("moves a held pick the verifier now confirms back into picks, with its ranking and checked quotes", () => {
      const r = applyVerdicts(withHeld, {
        ...base,
        picks: [...base.picks, { contestId: "supervisor-8", verdict: "confirmed", evidence: "#1 McCoy #2 Nguyen" }],
        quotes: [...base.quotes, { contestId: "supervisor-8", index: 1, verdict: "confirmed", evidence: "" }],
      });
      expect(r.file.picks["supervisor-8"]).toEqual({
        pick: ["Gary McCoy", "Michael T. Nguyen"], ranked: true, quotes: [q("McCoy has fixed our parks for a decade.")],
      });
      expect(r.file.held).toBeUndefined();
      expect(r.confirmed).toBe(2);
    });
    it("keeps a held pick held with the new reason when it still fails", () => {
      const r = applyVerdicts(withHeld, {
        ...base,
        picks: [...base.picks, { contestId: "supervisor-8", verdict: "wrong-rank", evidence: "Dual endorsement." }],
      });
      expect(r.file.picks["supervisor-8"]).toBeUndefined();
      expect(r.file.held).toEqual([{ ...heldD8, reason: "wrong-rank", evidence: "Dual endorsement." }]);
    });
    it("never releases an unclear-match hold, even when the verifier confirms the pick", () => {
      const unclear = { ...heldD8, reason: "unclear-match" as const, evidence: "decision" };
      const r = applyVerdicts({ ...withHeld, held: [unclear] }, {
        ...base,
        picks: [...base.picks, { contestId: "supervisor-8", verdict: "confirmed", evidence: "#1 McCoy #2 Nguyen" }],
      });
      expect(r.file.picks["supervisor-8"]).toBeUndefined();
      expect(r.file.held).toEqual([unclear]);
      expect(r.confirmed).toBe(1);
    });
    it("never releases a name-mismatch hold, even when the verifier confirms the pick", () => {
      const near = { ...heldD8, reason: "name-mismatch" as const, evidence: "near" };
      const r = applyVerdicts({ ...withHeld, held: [near] }, {
        ...base,
        picks: [...base.picks, { contestId: "supervisor-8", verdict: "confirmed", evidence: "#1 McCoy #2 Nguyen" }],
      });
      expect(r.file.picks["supervisor-8"]).toBeUndefined();
      expect(r.file.held).toEqual([near]);
    });
    it("keeps a held pick held when the verifier says nothing about it", () => {
      const r = applyVerdicts(withHeld, base);
      expect(r.file.held).toEqual([heldD8]);
    });
    it("records the ranking and quotes of a newly held pick so it can be restored", () => {
      const r = applyVerdicts(file, { ...allConfirmed, picks: allConfirmed.picks.slice(0, 2) });
      expect(r.file.held?.[0]).toMatchObject({ contestId: "supervisor-8", ranked: true });
    });
    it("sends held picks to the verifier", async () => {
      const finalMessage = vi.fn().mockResolvedValue({
        stop_reason: "end_turn", stop_details: null, usage: {}, content: [{ type: "text", text: JSON.stringify(base) }],
      });
      const stream = vi.fn().mockReturnValue({ finalMessage });
      await verify({ messages: { stream } } as unknown as ExtractClient, ballot, guide, withHeld, []);
      const audit = stream.mock.calls[0][0].messages[0].content.at(-1).text as string;
      expect(audit).toContain('"contestId":"supervisor-8"');
      expect(audit).toContain('"held":true');
      expect(audit).toContain('"text":"McCoy has fixed our parks for a decade."');
    });
    it("does not send unclear-match holds to the verifier", async () => {
      const finalMessage = vi.fn().mockResolvedValue({
        stop_reason: "end_turn", stop_details: null, usage: {}, content: [{ type: "text", text: JSON.stringify(base) }],
      });
      const stream = vi.fn().mockReturnValue({ finalMessage });
      const unclear = { ...heldD8, reason: "unclear-match" as const };
      await verify({ messages: { stream } } as unknown as ExtractClient, ballot, guide, { ...withHeld, held: [unclear] }, []);
      const audit = stream.mock.calls[0][0].messages[0].content.at(-1).text as string;
      expect(audit).not.toContain('"contestId":"supervisor-8"');
    });
  });

  it("reports missing picks without adding them", () => {
    const missing = [{ contestId: "prop-d", pick: "Y", evidence: "Yes on D" }];
    const r = applyVerdicts(file, { ...allConfirmed, missing });
    expect(r.missing).toEqual(missing);
    expect(r.file.picks["prop-d"]).toBeUndefined();
  });
});

describe("hasVerifiable", () => {
  const empty = { ...file, picks: {}, held: [] };
  const hold = (reason: "name-mismatch" | "unclear-match" | "wrong-pick") => ({ contestId: "prop-a", pick: "Y" as const, reason, evidence: "e" });
  it("is false when the only items are holds a person releases", () =>
    expect(hasVerifiable({ ...empty, held: [hold("name-mismatch"), { ...hold("unclear-match"), contestId: "prop-b" }] })).toBe(false));
  it("is true for a verifier hold", () => expect(hasVerifiable({ ...empty, held: [hold("wrong-pick")] })).toBe(true));
  it("is true for a pick", () => expect(hasVerifiable(file)).toBe(true));
});

describe("verifierPrompt", () => {
  const prompt = verifierPrompt(ballot);
  it("audits rather than extracts, and shares no text with the extraction prompt", () => {
    expect(prompt).toContain("You are auditing someone else's extraction");
    for (const line of systemPrompt(ballot).split("\n").filter((l) => l.length > 30 && !l.startsWith("["))) {
      expect(prompt).not.toContain(line);
    }
  });
  it("names every audit category", () => {
    for (const c of ["wrong-pick", "wrong-rank", "not-found", "old-election", "wrong-contest", "not-own-words", "not-substantive", "not-standalone"]) {
      expect(prompt).toContain(c);
    }
  });
  it("states the quote rule: reason, two-sentence context, connectors, pointing back, pronouns and subject", () => {
    for (const part of [
      "gives a reason for the pick",
      "bare verdicts",
      "It has more than two sentences, or its first sentence needs an earlier sentence to make sense.",
      "But, However, And, Moreover, Further, Furthermore, Instead, Additionally, Finally, Still, Yet, So, Plus, Meanwhile, Likewise, Similarly, Thus, Therefore, In addition, As a result, On the other hand, Nevertheless, Nonetheless, Lastly, Second(ly), Third(ly), Besides, Speaking of, That leaves us, Resulting",
      "Overall, In short, Ultimately",
      '"this funding" for the contest\'s own measure\'s money',
      "A He/She quote under a pick of several candidates names none of them",
      "In a two-way race, a quote criticizing the named opponent is about the pick",
    ]) {
      expect(prompt).toContain(part);
    }
  });
  it("is deterministic for caching", () => expect(verifierPrompt(ballot)).toBe(prompt));
  it("treats a candidate labelled Open Endorsement as not endorsed, and an open seat as no signal", () => {
    expect(prompt).toContain('A candidate labelled "Open Endorsement" (or "Open" in a column of endorsement statuses) is not endorsed; an "open seat" (a vacancy) says nothing about the pick.');
  });
});

describe("open endorsements in the extraction prompt", () => {
  const prompt = systemPrompt(ballot);
  it("leaves out a candidate labelled Open Endorsement, or Open in a column of statuses, and ignores open seats", () => {
    expect(prompt).toContain(
      '- A candidate labelled "Open Endorsement" (or "Open" in a column of endorsement statuses) is not endorsed: leave that candidate out, and skip the contest if no one else in it is endorsed ("X — Sole Endorsement, Y — Open Endorsement" is a pick of X alone). An "open seat" (a vacancy) does not affect the pick.',
    );
    expect(prompt).not.toContain('(or "Open") is not an endorsement');
  });
});

describe("VerifyOutput schema", () => {
  it("has no integer bounds (structured outputs reject them)", () => {
    expect(JSON.stringify(z.toJSONSchema(VerifyOutput))).not.toMatch(/"(minimum|maximum|exclusiveMinimum|exclusiveMaximum)"/);
  });
});

describe("verify", () => {
  const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 };
  const fakeClient = (response: Record<string, unknown> = {}) => {
    const finalMessage = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      stop_details: null,
      usage,
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(allConfirmed) }],
      ...response,
    });
    const stream = vi.fn().mockReturnValue({ finalMessage });
    return { client: { messages: { stream } } as unknown as ExtractClient, stream };
  };
  const sources = [
    { url: "https://growsf.org/slate.pdf", fetched: { kind: "pdf" as const, base64: "JVBERi0=", text: "" } },
    { url: src, fetched: { kind: "text" as const, text: "No on Prop B. A public bank would cost the city hundreds of millions." } },
  ];

  it("sends Opus with high effort, the cached audit prompt, the pages and the numbered extraction", async () => {
    const { client, stream } = fakeClient();
    const r = await verify(client, ballot, guide, file, sources);
    expect(r).toEqual({ output: allConfirmed, usage });
    const req = stream.mock.calls[0][0];
    expect(VERIFY_MODEL).toBe("claude-opus-5-5");
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.max_tokens).toBe(64000);
    expect(req.thinking).toBeUndefined();
    expect(req.tool_choice).toBeUndefined();
    expect(req.output_config.effort).toBe("high");
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.system).toEqual([{ type: "text", text: verifierPrompt(ballot), cache_control: { type: "ephemeral" } }]);
    const content = req.messages[0].content;
    expect(content[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" },
      title: "https://growsf.org/slate.pdf",
    });
    expect(content[1]).toEqual({ type: "text", text: `--- ${src} ---\nNo on Prop B. A public bank would cost the city hundreds of millions.` });
    const audit = content.at(-1).text as string;
    expect(audit).toContain("Organization: GrowSF (https://growsf.org/)");
    expect(audit).toContain('"contestId":"prop-b"');
    expect(audit).toContain('"index":2,"text":"This will only make it worse."');
    expect(JSON.stringify(req)).not.toContain("Extract this organization's endorsements");
  });

  it("throws on refusal and on max_tokens before parsing", async () => {
    await expect(verify(fakeClient({ stop_reason: "refusal", stop_details: { category: "cyber" } }).client, ballot, guide, file, sources)).rejects.toThrow(
      "refused (category: cyber)",
    );
    await expect(verify(fakeClient({ stop_reason: "max_tokens" }).client, ballot, guide, file, sources)).rejects.toThrow("max_tokens");
  });

  it("rejects output that doesn't match the schema", async () => {
    const bad = fakeClient({ content: [{ type: "text", text: '{"picks":[{"contestId":"prop-b","verdict":"maybe","evidence":""}],"quotes":[],"missing":[]}' }] });
    await expect(verify(bad.client, ballot, guide, file, sources)).rejects.toThrow("did not match the schema");
  });
});
