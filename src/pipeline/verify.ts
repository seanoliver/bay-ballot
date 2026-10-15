import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { isPersonHold, type Ballot, type EndorsementFile, type Entry, type Guide, type HeldPick } from "@/lib/schema";
import { pageBlocks, type ExtractClient, type Source } from "./extract";
import { mergeInScope } from "./scope";

export const VERIFY_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 64000;

const PICK_VERDICTS = ["confirmed", "wrong-pick", "wrong-rank", "not-found", "old-election"] as const;
const QUOTE_VERDICTS = [
  "confirmed",
  "not-found",
  "wrong-contest",
  "not-own-words",
  "not-substantive",
  "not-standalone",
  "old-election",
] as const;

// No z.int(): structured outputs reject the integer bounds it emits.
export const VerifyOutput = z.object({
  picks: z.array(
    z.object({
      contestId: z.string(),
      verdict: z.enum(PICK_VERDICTS),
      evidence: z.string().describe("the page text that supports or contradicts the pick, quoted briefly"),
    }),
  ),
  quotes: z.array(
    z.object({
      contestId: z.string(),
      index: z.number().describe("the quote's number within its pick, starting at 1"),
      verdict: z.enum(QUOTE_VERDICTS),
      evidence: z.string(),
    }),
  ),
  missing: z.array(
    z.object({
      contestId: z.string(),
      pick: z.string().describe("the position the pages state, e.g. 'Y', 'N' or candidate names"),
      evidence: z.string(),
    }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifyOutput>;

function outputFormat(): Anthropic.Messages.JSONOutputFormat {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(VerifyOutput) };
  delete schema.$schema;
  return { type: "json_schema", schema };
}

/** Must not reuse the extraction prompt: the audit has to be independent of it. */
export function verifierPrompt(ballot: Ballot): string {
  const contests = ballot.contests
    .map((c) => {
      const extra = c.kind === "candidate" ? ` — candidates: ${c.candidates.join("; ")}${c.rankedChoice ? " (ranked-choice)" : ""}` : "";
      return `- ${c.id}: ${c.title} [${c.kind}]${extra}`;
    })
    .join("\n");
  return [
    "You are auditing someone else's extraction of one organization's voter-guide endorsements.",
    `The election is the ${ballot.title} on ${ballot.date}. For each pick and quote, say whether the organization's pages support it.`,
    "Judge only from the pages provided. Do not add, fix or re-extract anything; report what is wrong.",
    "",
    "Picks: give exactly one verdict per pick listed in the extraction.",
    "- confirmed: the pages show this organization taking this position in this contest for this election.",
    "- wrong-pick: the pages show a different position (other candidates, the opposite vote, or no position or neutral). A candidate labelled \"Open Endorsement\" (or \"Open\" in a column of endorsement statuses) is not endorsed; an \"open seat\" (a vacancy) says nothing about the pick.",
    "- wrong-rank: the names are right but the ranking is not (ranked when the page gives no order, unranked when it ranks them, a different order, or rankedCount wrong when only some names are ranked).",
    "- not-found: the pages do not mention this organization's position in this contest at all.",
    "- old-election: the position on the page is for a different election (an earlier primary or special election).",
    "A Y on a measure means the organization supports it; N means it opposes it. A candidate pick lists the endorsed names; ranked means the page gives a rank order.",
    "",
    "Quotes: give exactly one verdict per quote, identified by contestId and its number.",
    // Must match the extraction prompt's quote rule; a test forbids sharing any line with it.
    "- confirmed: the quote is on the pages, sits in this contest's section, is the organization's own words, gives a reason for the pick, and makes sense on its own.",
    "- not-found: the quote is not on the pages word for word, or it joins sentences that are not next to each other there.",
    "- wrong-contest: the quote is about a different contest than the pick it is attached to.",
    "- not-own-words: the quote is someone else's words (opponents, candidates, news coverage, another organization).",
    "- not-substantive: it gives no reason. Announcements, slogans, calls to vote, thanks, bare verdicts (\"Bragman and Da Cunha stand out as the two candidates the town needs\") and background (\"Wynn taught in the district\") are not reasons; a policy argument, a record or qualifications, a consequence of the vote, or a fact cited as a reason for the position is.",
    "- not-standalone: shown alone under its contest and pick, it is unclear or misleading. Mark it when any of these holds:",
    "  - It has more than two sentences, or its first sentence needs an earlier sentence to make sense. A second sentence may lean on the first (\"If we don't approve this measure, ... . Service will be cut by 70%.\" is one valid quote).",
    "  - It starts with a word carrying on from a previous sentence: But, However, And, Moreover, Further, Furthermore, Instead, Additionally, Finally, Still, Yet, So, Plus, Meanwhile, Likewise, Similarly, Thus, Therefore, In addition, As a result, On the other hand, Nevertheless, Nonetheless, Lastly, Second(ly), Third(ly), Besides, Speaking of, That leaves us, Resulting; or its first sentence has a parenthetical \", however,\" set against what came before. Overall, In short, Ultimately and a plain \"also\" are acceptable.",
    "  - This, that, these, those, it, such, or a definite phrase such as \"the system\", \"the funds\", \"the higher rates\" or \"the incumbents\", refers to text before the quote. Acceptable: \"this measure\", \"this office\", \"this race\"; \"it\" for the measure under its own pick; \"the council\", \"the board\" or \"the district\" for the body the contest elects; \"this funding\" for the contest's own measure's money.",
    "  - A He/She quote under a pick of several candidates names none of them (He/She/They under a one-candidate pick, and They under several, are acceptable).",
    "  - It neither names the pick nor is clearly about it, is about a candidate the organization did not pick in a multi-seat race, or reads as an argument for the other side. In a two-way race, a quote criticizing the named opponent is about the pick; under a measure, a sentence about the problem the measure addresses is acceptable.",
    "- old-election: the quote is about a different election.",
    "",
    "Missing: list positions the pages clearly state for contests on this ballot that the extraction has no pick for. Report only clear positions, not neutral ones.",
    "",
    "Evidence: quote the few words of page text that decided each verdict.",
    "",
    "Ballot contests:",
    contests,
  ].join("\n");
}

function auditText(guide: Guide, file: EndorsementFile): string {
  const describe = (contestId: string, e: Entry, held: boolean) => ({
    contestId,
    pick: e.pick,
    ...(Array.isArray(e.pick) ? { ranked: e.ranked, ...(e.rankedCount ? { rankedCount: e.rankedCount } : {}) } : {}),
    ...(held ? { held: true } : {}),
    quotes: e.quotes.map((q, i) => ({ index: i + 1, text: q.text, page: q.source })),
  });
  const picks = [
    ...Object.entries(file.picks).map(([contestId, e]) => describe(contestId, e, false)),
    ...(file.held ?? []).filter((h) => !isPersonHold(h)).map((h) => describe(h.contestId, heldEntry(h), true)),
  ];
  return [
    `Organization: ${guide.name} (${guide.homepage})`,
    "Extraction to audit (JSON, one object per pick):",
    ...picks.map((p) => JSON.stringify(p)),
  ].join("\n");
}

function parseOutput(text: string): VerifyOutput {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`verifier output did not match the schema: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const r = VerifyOutput.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`verifier output did not match the schema: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  return r.data;
}

export async function verify(
  client: ExtractClient,
  ballot: Ballot,
  guide: Guide,
  file: EndorsementFile,
  sources: Source[],
): Promise<{ output: VerifyOutput; usage: Anthropic.Messages.Usage }> {
  const res = await client.messages
    .stream({
      model: VERIFY_MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: verifierPrompt(ballot), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [...pageBlocks(sources), { type: "text", text: auditText(guide, file) }] }],
      output_config: { effort: "high", format: outputFormat() },
    })
    .finalMessage();
  if (res.stop_reason === "refusal") throw new Error(`refused (category: ${res.stop_details?.category ?? "none"})`);
  if (res.stop_reason === "max_tokens") throw new Error("verifier output hit max_tokens before finishing");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { output: parseOutput(text), usage: res.usage };
}

/** Whether a file has anything the verifier may audit: a pick, or a hold that isn't a person's to release. */
export function hasVerifiable(file: EndorsementFile): boolean {
  return Object.keys(file.picks).length + (file.held ?? []).filter((h) => !isPersonHold(h)).length > 0;
}

export function heldEntry(h: HeldPick): Entry {
  return { pick: h.pick, ranked: h.ranked ?? false, ...(h.rankedCount ? { rankedCount: h.rankedCount } : {}), quotes: h.quotes ?? [] };
}

export type DroppedByVerifier = { contestId: string; text: string; reason: string; evidence: string };

export type Applied = {
  file: EndorsementFile;
  confirmed: number;
  held: HeldPick[];
  droppedQuotes: DroppedByVerifier[];
  missing: VerifyOutput["missing"];
  notes: string[];
};

export function applyVerdicts(file: EndorsementFile, out: VerifyOutput): Applied {
  const picks = { ...file.picks };
  const held: HeldPick[] = [];
  const droppedQuotes: DroppedByVerifier[] = [];
  const notes: string[] = [];
  let confirmed = 0;
  const hold = (contestId: string, e: Entry, reason: HeldPick["reason"], evidence: string): HeldPick => ({
    contestId,
    pick: e.pick,
    reason,
    evidence,
    ...(e.ranked ? { ranked: true } : {}),
    ...(e.rankedCount ? { rankedCount: e.rankedCount } : {}),
    ...(e.quotes.length ? { quotes: e.quotes } : {}),
  });

  for (const [contestId, entry] of Object.entries(file.picks)) {
    const v = out.picks.find((p) => p.contestId === contestId);
    if (!v) {
      held.push(hold(contestId, entry, "unverified", "The verifier returned no verdict for this pick."));
      delete picks[contestId];
      continue;
    }
    if (v.verdict === "confirmed") {
      confirmed++;
      continue;
    }
    held.push(hold(contestId, entry, v.verdict, v.evidence));
    delete picks[contestId];
  }

  const stillHeld: HeldPick[] = [];
  for (const h of file.held ?? []) {
    const v = isPersonHold(h) ? undefined : out.picks.find((p) => p.contestId === h.contestId);
    if (v?.verdict === "confirmed" && !(h.contestId in picks)) {
      picks[h.contestId] = heldEntry(h);
      confirmed++;
    } else if (v && v.verdict !== "confirmed") stillHeld.push({ ...h, reason: v.verdict, evidence: v.evidence });
    else stillHeld.push(h);
  }

  for (const [contestId, entry] of Object.entries(picks)) {
    const keep = entry.quotes.filter((q, i) => {
      const v = out.quotes.find((x) => x.contestId === contestId && x.index === i + 1);
      if (!v) {
        droppedQuotes.push({ contestId, text: q.text, reason: "unverified", evidence: "The verifier returned no verdict for this quote." });
        return false;
      }
      if (v.verdict === "confirmed") return true;
      droppedQuotes.push({ contestId, text: q.text, reason: v.verdict, evidence: v.evidence });
      return false;
    });
    if (keep.length !== entry.quotes.length) picks[contestId] = { ...entry, quotes: keep };
  }

  const allHeld = [...stillHeld.filter((h) => !held.some((n) => n.contestId === h.contestId)), ...held];
  const next: EndorsementFile = {
    ...file,
    status: Object.keys(picks).length > 0 ? file.status : "pending",
    picks,
    held: allHeld.length ? allHeld : undefined,
  };
  return { file: next, confirmed, held, droppedQuotes, missing: out.missing, notes };
}

export function auditPart(file: EndorsementFile, ids: string[], inScope: (contestId: string) => boolean): EndorsementFile {
  const held = (file.held ?? []).filter((h) => inScope(h.contestId));
  return { ...file, picks: Object.fromEntries(ids.map((id) => [id, file.picks[id]])), held: held.length ? held : undefined };
}

export function withAudited(file: EndorsementFile, audited: EndorsementFile, ids: string[], inScope: (contestId: string) => boolean): EndorsementFile {
  const picks = Object.fromEntries(mergeInScope(Object.entries(file.picks), Object.entries(audited.picks), ([id]) => id, (id) => ids.includes(id)));
  const held = mergeInScope(file.held ?? [], audited.held ?? [], (h) => h.contestId, inScope);
  return { ...file, status: Object.keys(picks).length > 0 ? file.status : "pending", picks, held: held.length ? held : undefined };
}
