import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Ballot, Contest, Entry } from "@/lib/schema";
import { matchName } from "@/lib/names";
import type { Fetched } from "./fetch";
import { verifyQuotes, type Page } from "./quotes";

export const ExtractOutput = z.object({
  hasReasoning: z
    .boolean()
    .describe("true if the organization explains its picks anywhere on these pages; false if it only lists them"),
  picks: z.array(
    z.object({
      contestId: z.string(),
      vote: z.enum(["Y", "N"]).nullable().describe("for measure and retention contests; null for candidate races"),
      candidates: z
        .array(z.string())
        .describe("endorsed candidate names, in rank order if ranked; empty for measures"),
      ranked: z.boolean(),
      quotes: z
        .array(z.string())
        .describe(
          "up to 3 complete sentences copied exactly from the pages, in the organization's own voice, explaining this pick; empty if none",
        ),
    }),
  ),
});
export type ExtractOutput = z.infer<typeof ExtractOutput>;

/**
 * The structured-output format, built from zod directly. The SDK's zodOutputFormat
 * (0.131) folds `enum` into the description, which would leave `vote` unconstrained.
 */
function outputFormat(): Anthropic.Messages.JSONOutputFormat {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(ExtractOutput) };
  delete schema.$schema;
  return { type: "json_schema", schema };
}

export type Source = { url: string; fetched: Fetched };
export type ExtractClient = { messages: Pick<Anthropic["messages"], "create"> };

export const MODEL = "claude-sonnet-5-5";
const MAX_QUOTES = 3;

/** The ballot-specific system prompt. Deterministic (no clock) so every guide call hits the prompt cache. */
export function systemPrompt(ballot: Ballot): string {
  const contests = ballot.contests.map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.kind,
    candidates: c.candidates,
    seats: c.seats,
  }));
  return [
    `You extract one organization's voter-guide endorsements for the ${ballot.title} on ${ballot.date}.`,
    `The pages may list endorsements for several elections. Extract only endorsements for the ${ballot.title} on ${ballot.date}; ignore every other election.`,
    "",
    "Rules:",
    "- Return one pick per contest the organization takes a position on. Use the contestId values from the ballot below exactly.",
    "- Use the official candidate names from the ballot below exactly, even when the page spells them differently.",
    '- Skip contests the organization does not mention, and contests where it takes no position, is "neutral", or says "no recommendation" or "no endorsement".',
    "- Measure and retention contests: set vote to Y or N and leave candidates empty. Candidate contests: set vote to null and list the endorsed candidates.",
    '- Ranked endorsements ("#1 X, #2 Y"): set ranked true and list candidates in rank order. Dual endorsements without ranking: list both names with ranked false.',
    '- Image alt text in square brackets next to an item, such as "[YES]" or "[NO]", is a valid signal of the pick.',
    "- hasReasoning is true if the organization explains its picks anywhere on these pages, false if it only lists them.",
    "",
    "Quotes:",
    "- Each quote must be a complete sentence copied character-for-character from the pages.",
    "- Quotes must be in the organization's own voice. Never quote text it attributes to opponents, critics, candidates or anyone else.",
    "- Never paraphrase, summarize, shorten or combine sentences.",
    "- At most 3 quotes per pick. If the pages give no reasons for a pick, return an empty quotes array.",
    "",
    "Ballot contests (JSON):",
    JSON.stringify(contests),
  ].join("\n");
}

/** Pages for quote verification. A PDF with empty extracted text yields no verifiable quotes, so its quotes all drop. */
export function pagesFor(sources: Source[]): Page[] {
  return sources.map(({ url, fetched }) =>
    fetched.kind === "pdf" ? { url, text: fetched.text, kind: "pdf" } : { url, text: fetched.text, kind: "html" },
  );
}

function candidateNames(id: string, raw: string[], official: string[], notes: string[]): string[] {
  const names: string[] = [];
  for (const name of raw) {
    const m = matchName(name, official);
    if (!m) {
      notes.push(`${id}: unknown candidate '${name}'`);
      continue;
    }
    if (m.fuzzy) notes.push(`${id}: '${name}' -> '${m.name}'`);
    if (!names.includes(m.name)) names.push(m.name);
  }
  return names;
}

/** Turn model output into schema entries, normalizing names and keeping only verified quotes. */
export function toEntries(
  out: ExtractOutput,
  contests: Contest[],
  pages: Page[],
): { picks: Record<string, Entry>; notes: string[] } {
  const byId = new Map(contests.map((c) => [c.id, c]));
  const picks: Record<string, Entry> = {};
  const notes: string[] = [];

  for (const p of out.picks) {
    const c = byId.get(p.contestId);
    if (!c) {
      notes.push(`unknown contest ${p.contestId}`);
      continue;
    }
    const isCandidate = c.kind === "candidate";
    if (isCandidate ? p.vote !== null : p.candidates.length > 0) {
      notes.push(`${c.id}: pick doesn't match contest kind`);
      continue;
    }

    let pick: Entry["pick"];
    if (isCandidate) {
      const names = candidateNames(c.id, p.candidates, c.candidates, notes);
      if (names.length === 0) continue;
      pick = names;
    } else {
      if (p.vote === null) {
        notes.push(`${c.id}: measure pick has no vote`);
        continue;
      }
      pick = p.vote;
    }

    const { kept, dropped } = verifyQuotes(p.quotes.slice(0, MAX_QUOTES), pages);
    for (const d of dropped) notes.push(`${c.id}: dropped quote (${d.reason})`);

    picks[c.id] = { pick, ranked: isCandidate && p.ranked, quotes: kept };
  }
  return { picks, notes };
}

type UserContent = Anthropic.Messages.ContentBlockParam[];

function userContent(sources: Source[]): UserContent {
  const content: UserContent = [];
  for (const { url, fetched } of sources) {
    if (fetched.kind === "pdf") {
      content.push(
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: fetched.base64 } },
        { type: "text", text: `--- ${url} ---` },
      );
    } else {
      content.push({ type: "text", text: `--- ${url} ---\n${fetched.text}` });
    }
  }
  content.push({ type: "text", text: "Extract this organization's endorsements." });
  return content;
}

function parseOutput(text: string): ExtractOutput {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`model output did not match the schema: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const r = ExtractOutput.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`model output did not match the schema: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  return r.data;
}

/**
 * Ask Claude for one guide's endorsements across its already-fetched pages.
 * Uses `create` rather than `parse` so stop_reason is checked before any parsing:
 * `parse` throws on truncated or non-JSON text, which would hide a refusal or max_tokens.
 */
export async function extract(
  client: ExtractClient,
  ballot: Ballot,
  sources: Source[],
): Promise<{ output: ExtractOutput; usage: Anthropic.Messages.Usage }> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: systemPrompt(ballot), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent(sources) }],
    output_config: { format: outputFormat() },
  });
  if (res.stop_reason === "refusal") throw new Error(`refused: ${res.stop_details?.category}`);
  if (res.stop_reason === "max_tokens") throw new Error("model output hit max_tokens before finishing");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { output: parseOutput(text), usage: res.usage };
}
