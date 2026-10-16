import type Anthropic from "@anthropic-ai/sdk";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Ballot, Contest, Entry, Guide, HeldPick } from "@/lib/schema";
import { matchName, suggestName, type Aliases } from "@/lib/names";
import { isRejected, MIN_CONTAINED } from "@/lib/quote-key";
import type { Fetched } from "./fetch";
import { misplacedUnder } from "./placement";
import { normalizeWithMap, standaloneProblem, verifyQuotes, type KeptQuote, type Page } from "./quotes";

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
      // Not z.int(): structured outputs reject the integer bounds it emits.
      rankedCount: z
        .number()
        .nullable()
        .describe("when only the first N listed names are ranked and the rest are unranked co-endorsements, N; otherwise null"),
      quotes: z
        .array(z.string())
        .describe(
          "up to 3 quotes copied exactly from the pages, each one sentence (or two consecutive sentences when the second needs the first), in the organization's own voice, giving a reason for this pick; empty if none",
        ),
      note: z
        .string()
        .nullable()
        .describe("use only when the position is unclear or partial; otherwise null"),
    }),
  ),
});
export type ExtractOutput = z.infer<typeof ExtractOutput>;

/** Not the SDK's zodOutputFormat: it folds `enum` into the description, leaving `vote` unconstrained. */
function outputFormat(): Anthropic.Messages.JSONOutputFormat {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(ExtractOutput) };
  delete schema.$schema;
  return { type: "json_schema", schema };
}

export type Source = { url: string; fetched: Fetched };
export type ExtractClient = { messages: Pick<Anthropic["messages"], "stream"> };

export const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 64000;
const MAX_QUOTES = 3;
const NOTE_QUOTE_CHARS = 80;

/** No clock or per-guide text: the prompt must stay byte-identical across guides with the same areas to hit the cache. */
export function systemPrompt(ballot: Ballot): string {
  const contests = ballot.contests.map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.kind,
    candidates: c.candidates,
    seats: c.seats,
    rankedChoice: c.rankedChoice,
  }));
  return [
    `You extract one organization's voter-guide endorsements for the ${ballot.title} on ${ballot.date}.`,
    `The pages may list endorsements for several elections. Extract only endorsements for the ${ballot.title} on ${ballot.date}; ignore every other election.`,
    "Extract only this organization's own endorsements; ignore endorsements the pages attribute to other organizations.",
    "",
    "Rules:",
    "- Return one pick per contest the organization takes a position on. Use the contestId values from the ballot below exactly.",
    "- Copy candidate names exactly as printed on the page; they are matched to the ballot downstream.",
    '- Skip contests the organization does not mention, and contests where it takes no position, is "neutral", or says "no recommendation" or "no endorsement".',
    '- A candidate labelled "Open Endorsement" (or "Open" in a column of endorsement statuses) is not endorsed: leave that candidate out, and skip the contest if no one else in it is endorsed ("X — Sole Endorsement, Y — Open Endorsement" is a pick of X alone). An "open seat" (a vacancy) does not affect the pick.',
    "- Measure and retention contests: set vote to Y or N and leave candidates empty. Candidate contests: set vote to null and list the endorsed candidates.",
    '- Emphatic phrasing still counts: "Oh Hell Yes!" or "Strong Yes" is Y, "Strong No" or "Hell No" is N, and "Retain all" on a retention contest is Y.',
    "- For a retention contest covering several judges where the organization's position is mixed (retain some, not others), do not give a Y or N: set vote to null and explain the position in note.",
    '- Ranked endorsements ("#1 X, #2 Y"): set ranked true and list candidates in rank order. Only contests with rankedChoice true can be ranked; elsewhere ranked is always false.',
    "- Dual endorsements without ranking: list both names with ranked false.",
    '- If only some names are ranked, list ranked names first and set rankedCount to how many are ranked ("#1 X, plus Y and Z unranked": X, Y, Z with ranked true and rankedCount 1). Otherwise rankedCount is null.',
    "- Multi-seat races (seats greater than 1) list up to `seats` names and are never ranked.",
    "- Use note only when the position is unclear or partial; otherwise set it to null.",
    '- Image alt text in square brackets next to an item, such as "[YES]" or "[NO]", is a valid signal of the pick.',
    "- hasReasoning is true if the organization explains its picks anywhere on these pages, false if it only lists them.",
    "",
    // The quote rules must match the runbook's quote rule and the verifier prompt, or re-extracts bring back rejected quotes.
    "Quotes:",
    "- A quote is one complete sentence copied character-for-character from the pages. Copy two consecutive sentences as one quote only when the second needs the first for its condition or subject (\"If we don't approve this funding measure, commutes will get longer. Transit service will be cut by up to 70%.\"). Never more than two.",
    "- Each quote must give a reason for the pick: a policy argument, the candidate's record or qualifications, a consequence of the vote, or a fact cited as a reason. Never quote announcements, slogans, calls to vote, thanks, bare verdicts (\"X and Y stand out as the candidates the town needs\") or background (\"Wynn taught in the district\").",
    "- Each quote must make sense shown alone under its contest and pick:",
    "  - Subject: it names the pick or is clearly about it. In a two-way race, criticism of or contrast with the named opponent counts. In a multi-seat race, never quote a sentence about a candidate the organization did not pick. Under a measure, a sentence about the problem the measure addresses is fine.",
    "  - Pronouns: He/She/They is fine when the pick names one candidate. When it names several, They is fine but a He/She quote must also name one of them.",
    "  - Pointing back: no this/that/these/those/it/such, or definite phrase (\"the system\", \"the money\", \"the price tag\", \"the incumbents\"), that refers to earlier text. Fine: \"this measure/office/race\", \"it\" for the measure under its own pick, \"the council/board/district\" for the body the contest elects, \"this funding\" for the measure's own money.",
    "  - Connectors: never open with a word that continues a prior sentence (But, However, And, Moreover, Further, Furthermore, Instead, Additionally, Finally, Still, Yet, So, Plus, Meanwhile, Likewise, Similarly, Thus, Therefore, In addition, As a result, On the other hand, Nevertheless, Nonetheless, Lastly, Second(ly), Third(ly), Besides, Speaking of, That leaves us, Resulting), or use a parenthetical \", however,\" against it. Summary openers (Overall, In short, Ultimately) and \"also\" are fine.",
    "- Quotes must be in the organization's own voice. Never quote text it attributes to opponents, critics, candidates or anyone else.",
    "- Never paraphrase, summarize, shorten, or join sentences that are not consecutive on the page.",
    "- At most 3 quotes per pick. If no sentence on the pages meets these rules for a pick, return an empty quotes array.",
    "",
    "Ballot contests (JSON):",
    JSON.stringify(contests),
  ].join("\n");
}

export function pagesFor(sources: Source[]): Page[] {
  return sources.map(({ url, fetched }) =>
    fetched.kind === "pdf" ? { url, text: fetched.text, kind: "pdf" } : { url, text: fetched.text, kind: "html" },
  );
}

/** `mismatch` is set when a name only resembles a candidate: the pick is held for a person, never published. */
function candidateNames(
  id: string,
  raw: string[],
  official: string[],
  aliases: Aliases,
  notes: string[],
): { names: string[]; mismatch?: string; pageNames?: string[] } | null {
  const matches = raw.map((name) => {
    const m = matchName(name, official, aliases);
    const suggested = m ? null : suggestName(name, official, aliases);
    return { name, m: m ?? (suggested ? { name: suggested, fuzzy: true } : null), suggested };
  });
  const unknown = matches.find(({ m }) => !m);
  if (unknown) {
    notes.push(`${id}: PICK DROPPED — unknown candidate '${unknown.name}' (would change the pick's meaning)`);
    return null;
  }
  const names: string[] = [];
  for (const { name, m, suggested } of matches) {
    if (!m) continue;
    if (m.fuzzy && !suggested) notes.push(`${id}: '${name}' -> '${m.name}'`);
    if (!names.includes(m.name)) names.push(m.name);
  }
  const near = matches.filter((x, i) => x.suggested && matches.findIndex((y) => y.name === x.name) === i);
  // The page's spelling reaches the PR body: one line, no backticks, as code so it can't add links or mentions.
  const shown = (s: string) => `\`${s.replace(/[\s`]+/g, " ").trim().slice(0, 80)}\``;
  const mismatch = near.length
    ? `the page names ${near.map((x) => shown(x.name)).join(", ")}, not on the ballot; closest ${near.map((x) => shown(x.suggested!)).join(", ")}. If it is the same person, add an alias`
    : undefined;
  const pageNames = [...new Set(matches.map((x) => (x.suggested ? x.name : x.m!.name)))];
  return { names, ...(mismatch ? { mismatch, pageNames } : {}) };
}

const clip = (q: string) => (q.length > NOTE_QUOTE_CHARS ? `${q.slice(0, NOTE_QUOTE_CHARS)}…` : q);

export function contestProblem(q: KeptQuote, c: Contest, pick: Entry["pick"], pages: Page[], contests: Contest[]): string | null {
  const alone = standaloneProblem(q.text, c, { names: Array.isArray(pick) ? pick : [] });
  if (alone) return `not-standalone: ${alone}`;
  const other = misplacedUnder(q, c.id, pages, contests);
  return other ? `wrong-contest, under ${other}` : null;
}

export type NotedQuote = { contestId: string; text: string };

export function toEntries(
  out: ExtractOutput,
  contests: Contest[],
  pages: Page[],
  { ownNames = [] }: { ownNames?: string[] } = {},
): { picks: Record<string, Entry>; held: HeldPick[]; notes: string[]; dropped: NotedQuote[]; spelled: Record<string, string[]> } {
  const byId = new Map(contests.map((c) => [c.id, c]));
  const picks: Record<string, Entry> = {};
  const held: HeldPick[] = [];
  const spelled: Record<string, string[]> = {};
  const notes: string[] = [];
  const dropped: NotedQuote[] = [];

  for (const p of out.picks) {
    const note = p.note?.trim();
    if (note) notes.push(`${p.contestId}: model note: ${note}`);
    const c = byId.get(p.contestId);
    if (!c) {
      notes.push(`unknown contest ${p.contestId}`);
      continue;
    }
    if (c.id in picks || held.some((h) => h.contestId === c.id)) {
      notes.push(`${c.id}: duplicate pick, kept first`);
      continue;
    }
    const isCandidate = c.kind === "candidate";
    if (isCandidate ? p.vote !== null : p.candidates.length > 0) {
      notes.push(`${c.id}: pick doesn't match contest kind`);
      continue;
    }

    let pick: Entry["pick"];
    let mismatch: string | undefined;
    if (isCandidate) {
      if (p.candidates.length === 0) {
        notes.push(`${c.id}: pick lists no candidates`);
        continue;
      }
      const names = candidateNames(c.id, p.candidates, c.candidates, c.aliases ?? {}, notes);
      if (!names) continue;
      pick = names.names;
      mismatch = names.mismatch;
      if (names.pageNames) spelled[c.id] = names.pageNames;
    } else {
      if (p.vote === null) {
        notes.push(`${c.id}: measure pick has no vote`);
        continue;
      }
      pick = p.vote;
    }

    const verified = verifyQuotes(p.quotes.slice(0, MAX_QUOTES), pages, { ownNames });
    for (const d of verified.dropped) {
      notes.push(`${c.id}: dropped quote (${d.reason}): "${clip(d.quote)}"`);
      dropped.push({ contestId: c.id, text: d.quote });
    }
    const kept = verified.kept.filter((q) => {
      const reason = contestProblem(q, c, pick, pages, contests);
      if (reason) {
        notes.push(`${c.id}: dropped quote (${reason}): "${clip(q.text)}"`);
        dropped.push({ contestId: c.id, text: q.text });
      }
      return !reason;
    });

    let ranked = isCandidate && p.ranked && Array.isArray(pick) && pick.length > 1;
    if (ranked && (!c.rankedChoice || c.seats > 1)) {
      notes.push(`${c.id}: ranked ignored (not a ranked-choice contest)`);
      ranked = false;
    }

    const n = p.rankedCount;
    const partial = ranked && Array.isArray(pick) && n !== null && Number.isInteger(n) && n >= 1 && n < pick.length;
    if (mismatch) {
      held.push({
        contestId: c.id,
        pick,
        reason: "name-mismatch",
        evidence: mismatch,
        ...(ranked ? { ranked: true } : {}),
        ...(partial ? { rankedCount: n } : {}),
        ...(kept.length ? { quotes: kept.map((q) => ({ text: q.text, source: q.source })) } : {}),
      });
    } else picks[c.id] = { pick, ranked, ...(partial ? { rankedCount: n } : {}), quotes: kept };
  }
  return { picks, held, notes, dropped, spelled };
}

// Must normalize like verifyQuotes, or a quote that differs only in dashes or spacing is kept twice.
const quoteNorm = (text: string) => normalizeWithMap(text).norm;

function sameQuote(a: string, b: string): boolean {
  const x = quoteNorm(a);
  const y = quoteNorm(b);
  return x === y || (Math.min(x.length, y.length) >= MIN_CONTAINED && (x.includes(y) || y.includes(x)));
}

/** Same names (in any order unless ranked) or the same vote. */
export function samePick(a: Entry, b: Entry): boolean {
  if (Array.isArray(a.pick) && Array.isArray(b.pick) && !a.ranked && !b.ranked) {
    return a.pick.length === b.pick.length && a.pick.every((n) => (b.pick as string[]).includes(n));
  }
  return isDeepStrictEqual(a.pick, b.pick);
}

/** Call before the verifier: a restored quote is only audited if the verifier sees it. */
export function keepPrevQuotes(
  prev: Record<string, Entry>,
  picks: Record<string, Entry>,
  contests: Contest[],
  pages: Page[],
  {
    ownNames = [],
    rejected = [],
    noted = [],
  }: { ownNames?: string[]; rejected?: { text: string; contestId?: string }[]; noted?: NotedQuote[] } = {},
): { picks: Record<string, Entry>; notes: string[] } {
  const byId = new Map(contests.map((c) => [c.id, c]));
  const out = { ...picks };
  const notes: string[] = [];
  for (const [id, entry] of Object.entries(picks)) {
    const old = prev[id];
    const c = byId.get(id);
    if (!old || !c || !samePick(old, entry)) continue;
    const problem = (q: KeptQuote): string | null => {
      if (isRejected(q.text, id, rejected)) return "in rejectedQuotes";
      const page = pages.find((p) => p.url === q.source);
      if (!page) return "source page no longer fetched";
      const checked = verifyQuotes([q.text], [page], { ownNames });
      if (checked.kept.length !== 1) return checked.dropped[0]?.reason ?? "not-found";
      return contestProblem(q, c, entry.pick, pages, contests);
    };
    const quotes = [...entry.quotes];
    const restored: KeptQuote[] = [];
    const lengthened: KeptQuote[] = [];
    const notKept = (q: KeptQuote, why: string) => {
      if (!noted.some((n) => n.contestId === id && sameQuote(n.text, q.text))) notes.push(`${id}: previous quote not kept (${why}): "${clip(q.text)}"`);
    };
    let at = 0;
    for (const q of old.quotes) {
      const i = quotes.findIndex((x) => sameQuote(x.text, q.text));
      if (i !== -1) {
        at = i + 1;
        if (quoteNorm(quotes[i].text).length < quoteNorm(q.text).length) {
          const why = problem(q);
          if (why) notKept(q, why);
          else {
            quotes[i] = q;
            lengthened.push(q);
          }
        }
      } else {
        const why = problem(q);
        if (why) notKept(q, why);
        else {
          quotes.splice(at++, 0, q);
          restored.push(q);
        }
      }
    }
    for (const q of lengthened) notes.push(`${id}: kept previous full quote over the model's shorter one: "${clip(q.text)}"`);
    if (restored.length === 0) {
      if (lengthened.length) out[id] = { ...entry, quotes };
      continue;
    }
    while (quotes.length > MAX_QUOTES) {
      const newest = quotes.findLastIndex((q) => !old.quotes.some((o) => sameQuote(o.text, q.text)));
      const [cut] = quotes.splice(newest === -1 ? quotes.length - 1 : newest, 1);
      notes.push(`${id}: dropped new quote to keep the previous ones (limit ${MAX_QUOTES}): "${clip(cut.text)}"`);
    }
    for (const q of restored) notes.push(`${id}: kept previous quote the model omitted: "${clip(q.text)}"`);
    out[id] = { ...entry, quotes };
  }
  return { picks: out, notes };
}

type UserContent = Anthropic.Messages.ContentBlockParam[];

export function pageBlocks(sources: Source[]): UserContent {
  const content: UserContent = [];
  for (const { url, fetched } of sources) {
    if (fetched.kind === "pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fetched.base64 },
        title: url,
      });
    } else {
      content.push({ type: "text", text: `--- ${url} ---\n${fetched.text}` });
    }
  }
  return content;
}

function userContent(guide: Guide, sources: Source[]): UserContent {
  const content = pageBlocks(sources);
  content.push({
    type: "text",
    text: `Organization: ${guide.name} (${guide.homepage})\nExtract this organization's endorsements.`,
  });
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

export async function extract(
  client: ExtractClient,
  ballot: Ballot,
  guide: Guide,
  sources: Source[],
): Promise<{ output: ExtractOutput; usage: Anthropic.Messages.Usage }> {
  const res = await client.messages
    // Streams so a large max_tokens can't hit the HTTP timeout.
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemPrompt(ballot), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent(guide, sources) }],
      output_config: { format: outputFormat() },
    })
    .finalMessage();
  if (res.stop_reason === "refusal") throw new Error(`refused (category: ${res.stop_details?.category ?? "none"})`);
  if (res.stop_reason === "max_tokens") throw new Error("model output hit max_tokens before finishing");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return { output: parseOutput(text), usage: res.usage };
}
