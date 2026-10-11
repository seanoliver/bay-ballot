import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection, type ElectionData } from "@/lib/data";
import type { EndorsementFile } from "@/lib/schema";
import { formatLint, lintQuotes } from "@/pipeline/quotelint";

const fixture = loadElection(path.join(__dirname, "fixtures", "data"), "2026-11");
const URL_ = "https://growsf.org/guide";
const PAGE = [
  "Prop B: No",
  "A public bank would cost the city hundreds of millions of dollars. But the risks are real for every taxpayer in the city.",
  "This would drain the general fund for a decade or more.",
  "Assessor-Recorder: Joaquín Torres",
  "Torres has cleared the assessment backlog and brought in record revenue.",
].join("\n");

function withQuotes(picks: EndorsementFile["picks"], extra: Partial<EndorsementFile> = {}): ElectionData {
  const file: EndorsementFile = { ...fixture.endorsements.growsf, source: URL_, picks, ...extra };
  return { ...fixture, endorsements: { growsf: file } };
}
const read = (pages: Record<string, string>) => (_guide: string, url: string) => pages[url] ?? null;
const q = (text: string, source = URL_) => ({ text, source });

describe("lintQuotes", () => {
  it("passes good quotes and reports each failing one with its reason", () => {
    const data = withQuotes({
      "prop-b": {
        pick: "N",
        ranked: false,
        quotes: [
          q("A public bank would cost the city hundreds of millions of dollars."),
          q("But the risks are real for every taxpayer in the city."),
          q("This would drain the general fund for a decade or more."),
        ],
      },
      assessor: {
        pick: ["Joaquín Torres"],
        ranked: false,
        quotes: [q("Torres has cleared the assessment backlog and brought in record revenue."), q("Torres is the only candidate with a real plan for the office.")],
      },
    });
    const out = lintQuotes(data, read({ [URL_]: PAGE }));
    expect(out.checked).toBe(5);
    expect(out.rows.map((r) => [r.contestId, r.reason])).toEqual([
      ["prop-b", 'not-standalone: opens with "But"'],
      ["prop-b", 'not-standalone: opens with "This" pointing back'],
      ["assessor", "not-found (in the stored page text)"],
    ]);
    expect(out.rows[0]).toMatchObject({ guide: "growsf", pick: "N", quote: "But the risks are real for every taxpayer in the city." });
  });

  it("accepts a two-sentence quote copied verbatim", () => {
    const pair = "A public bank would cost the city hundreds of millions of dollars. But the risks are real for every taxpayer in the city.";
    const data = withQuotes({ "prop-b": { pick: "N", ranked: false, quotes: [q(pair)] } });
    expect(lintQuotes(data, read({ [URL_]: PAGE })).rows).toEqual([]);
  });

  it("flags a quote placed under another contest's heading, a missing page and a rejected quote", () => {
    const data = withQuotes(
      {
        "prop-b": { pick: "N", ranked: false, quotes: [q("Torres has cleared the assessment backlog and brought in record revenue.")] },
        assessor: {
          pick: ["Joaquín Torres"],
          ranked: false,
          quotes: [q("Torres has cleared the assessment backlog and brought in record revenue.", "https://growsf.org/other")],
        },
      },
    );
    expect(lintQuotes(data, read({ [URL_]: PAGE })).rows.map((r) => r.reason)).toEqual([
      "wrong-contest, under assessor",
      "source page not stored as text",
    ]);
    const rejected = withQuotes(
      { assessor: { pick: ["Joaquín Torres"], ranked: false, quotes: [q("Torres has cleared the assessment backlog and brought in record revenue.")] } },
      { rejectedQuotes: [{ text: "Torres has cleared the assessment backlog and brought in record revenue.", contestId: "assessor", reason: "test" }] },
    );
    expect(lintQuotes(rejected, read({ [URL_]: PAGE })).rows.map((r) => r.reason)).toEqual(["in rejectedQuotes"]);
  });

  it("checks only the named guide, and skips pending guides", () => {
    const data = withQuotes({ "prop-b": { pick: "N", ranked: false, quotes: [q("But the risks are real for every taxpayer in the city.")] } });
    expect(lintQuotes(data, read({ [URL_]: PAGE }), { guide: "other" }).checked).toBe(0);
    const pending = { ...data, endorsements: { growsf: { ...data.endorsements.growsf, status: "pending" as const } } };
    expect(lintQuotes(pending, read({ [URL_]: PAGE })).checked).toBe(0);
  });

  it("prints one tab-separated line per failing quote and a total", () => {
    const text = formatLint({ rows: [{ guide: "g", contestId: "prop-b", pick: "N", quote: "But no.", reason: 'not-standalone: opens with "But"' }], checked: 4 });
    expect(text).toBe('g\tprop-b\tN\tnot-standalone: opens with "But"\t"But no."\n\n1 of 4 published quotes would fail the quote checks (25.0%).');
  });
});
