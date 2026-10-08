import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { loadElection } from "@/lib/data";
import type { EndorsementFile, Guide } from "@/lib/schema";
import { systemPrompt, type ExtractClient } from "@/pipeline/extract";
import {
  applyVerdicts,
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
  });

  it("reports missing picks without adding them", () => {
    const missing = [{ contestId: "prop-d", pick: "Y", evidence: "Yes on D" }];
    const r = applyVerdicts(file, { ...allConfirmed, missing });
    expect(r.missing).toEqual(missing);
    expect(r.file.picks["prop-d"]).toBeUndefined();
  });
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
  it("tells the auditor how quotes are displayed", () => {
    expect(prompt).toContain(
      'A quote is always shown under its contest and pick. "It" or "This measure" referring to that contest\'s measure, and "He" or "She" when the pick names a single candidate, are not not-standalone.',
    );
    expect(prompt).toContain(
      "For a pick that names several candidates, a quote starting with He/She/His/Her is standalone only if the same quote names one of the endorsed candidates.",
    );
    expect(prompt).toContain(
      "Mark not-substantive only when the sentence gives no reason at all; a fact cited as a reason for the position counts as a reason.",
    );
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
