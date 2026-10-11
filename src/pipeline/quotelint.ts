import type { ElectionData } from "@/lib/data";
import { isRejected } from "@/lib/quote-key";
import { contestProblem } from "./extract";
import { isPdfDigest, normalizePageText } from "./pagestore";
import { verifyQuotes, type Page } from "./quotes";
import { guideBallot } from "./scope";
import { sourcesFor } from "./sources";

export type LintRow = { guide: string; contestId: string; pick: string; quote: string; reason: string };

const isPdfUrl = (url: string) => /\.pdf(?:$|[?#])/i.test(url);

export function lintQuotes(
  data: ElectionData,
  readPage: (guideId: string, url: string) => string | null,
  { guide: only }: { guide?: string } = {},
): { rows: LintRow[]; checked: number } {
  const rows: LintRow[] = [];
  let checked = 0;
  for (const guide of data.guides) {
    if (only && guide.id !== only) continue;
    const file = data.endorsements[guide.id];
    if (!file || file.status !== "published") continue;
    const contests = guideBallot(data.ballot, guide, data.areas).contests;
    const urls = new Set([...sourcesFor(file), ...Object.values(file.picks).flatMap((e) => e.quotes.map((q) => q.source))]);
    const pages: Page[] = [];
    for (const url of urls) {
      const text = readPage(guide.id, url);
      if (text !== null && !isPdfDigest(text)) pages.push({ url, text, kind: isPdfUrl(url) ? "pdf" : "html" });
    }
    const ownNames = [guide.name];
    for (const [contestId, entry] of Object.entries(file.picks)) {
      const pick = Array.isArray(entry.pick) ? entry.pick.join(" / ") : entry.pick;
      const contest = contests.find((c) => c.id === contestId);
      for (const q of entry.quotes) {
        checked++;
        const fail = (reason: string) => rows.push({ guide: guide.id, contestId, pick, quote: q.text, reason });
        if (!contest) {
          fail("contest not on the guide's ballot");
          continue;
        }
        if (isRejected(q.text, contestId, file.rejectedQuotes ?? [])) {
          fail("in rejectedQuotes");
          continue;
        }
        const page = pages.find((p) => p.url === q.source);
        if (!page) {
          fail("source page not stored as text");
          continue;
        }
        // Stored text has dates stripped and doesn't record whether a page was a PDF, so try those forms too.
        const forms = [...new Set([q.text, normalizePageText(q.text)])].filter(Boolean);
        const kinds: Page["kind"][] = page.kind === "pdf" ? ["pdf"] : ["html", "pdf"];
        const results = kinds.flatMap((kind) => forms.map((f) => verifyQuotes([f], [{ ...page, kind }], { ownNames })));
        const kept = results.find((r) => r.kept.length === 1)?.kept[0];
        if (!kept) {
          fail(`${results[0].dropped[0]?.reason ?? "not-found"} (in the stored page text)`);
          continue;
        }
        const problem = contestProblem(kept, contest, entry.pick, pages, contests);
        if (problem) fail(problem);
      }
    }
  }
  return { rows, checked };
}

export function formatLint({ rows, checked }: { rows: LintRow[]; checked: number }): string {
  const lines = rows.map((r) => `${r.guide}\t${r.contestId}\t${r.pick}\t${r.reason}\t"${r.quote}"`);
  const pct = checked ? ((rows.length / checked) * 100).toFixed(1) : "0.0";
  return [...lines, "", `${rows.length} of ${checked} published quotes would fail the quote checks (${pct}%).`].join("\n");
}
