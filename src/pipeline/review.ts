import type { Ballot, EndorsementFile, Entry, Guide } from "../lib/schema";

export type ReviewPick = {
  contestId: string;
  contestTitle: string;
  label: string;
  change: "new" | "changed" | "same";
  previous?: string;
  quotes: { text: string; source: string }[];
};

export type ReviewGuide = {
  id: string;
  name: string;
  type: string;
  status: string;
  manual: boolean;
  hasReasoning: boolean;
  sources: string[];
  fetchedAt: string;
  flags: string[];
  picks: ReviewPick[];
  removed: { contestTitle: string; label: string }[];
  quoteCount: number;
};

export type ReviewModel = {
  election: string;
  title: string;
  totals: { published: number; pending: number; picks: number; quotes: number; flagged: number };
  guides: ReviewGuide[];
};

function pickLabel(entry: Entry): string {
  if (entry.pick === "Y") return "Yes";
  if (entry.pick === "N") return "No";
  if (entry.ranked) {
    const n = entry.rankedCount ?? entry.pick.length;
    const ranked = entry.pick.slice(0, n).map((name, i) => `${i + 1}. ${name}`);
    const rest = entry.pick.slice(n);
    return [...ranked, ...(rest.length ? [`${rest.join(", ")} (unranked)`] : [])].join(", ");
  }
  return entry.pick.join(", ");
}

export function buildReviewModel(
  ballot: Ballot,
  guides: Guide[],
  current: Record<string, EndorsementFile>,
  previous: Record<string, EndorsementFile>,
): ReviewModel {
  const order = new Map(ballot.contests.map((c, i) => [c.id, i]));
  const titleOf = new Map(ballot.contests.map((c) => [c.id, c.title]));

  const reviewed: ReviewGuide[] = guides.flatMap((guide) => {
    const file = current[guide.id];
    if (!file) return [];
    const prev = previous[guide.id];
    const flags: string[] = [];

    const picks: ReviewPick[] = Object.entries(file.picks)
      .sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
      .map(([contestId, entry]) => {
        const label = pickLabel(entry);
        const before = prev?.picks[contestId];
        const change = !before ? "new" : pickLabel(before) === label ? "same" : "changed";
        return {
          contestId,
          contestTitle: titleOf.get(contestId) ?? contestId,
          label,
          change,
          ...(change === "changed" && before ? { previous: pickLabel(before) } : {}),
          quotes: entry.quotes,
        };
      });

    const removed = prev
      ? Object.entries(prev.picks)
          .filter(([id]) => !(id in file.picks))
          .map(([id, entry]) => ({ contestTitle: titleOf.get(id) ?? id, label: pickLabel(entry) }))
      : [];
    const quoteCount = picks.reduce((n, p) => n + p.quotes.length, 0);

    if (!prev && picks.length > 0) flags.push("new");
    if (prev && (removed.length > 0 || picks.some((p) => p.change !== "same"))) flags.push("picks changed");
    if (file.manual) flags.push("manual");
    if (prev && prev.hasReasoning !== file.hasReasoning) flags.push("explains picks changed");
    if (file.status === "published" && file.hasReasoning && quoteCount === 0) flags.push("explains picks but no quotes");
    if (Object.values(file.picks).some((e) => e.ranked)) flags.push("ranked pick");

    return [{
      id: guide.id,
      name: guide.name,
      type: guide.type,
      status: file.status,
      manual: !!file.manual,
      hasReasoning: file.hasReasoning,
      sources: [file.source, ...(file.extraSources ?? [])].filter((s): s is string => !!s),
      fetchedAt: file.fetchedAt,
      flags,
      picks,
      removed,
      quoteCount,
    }];
  });

  const isFlagged = (g: ReviewGuide) => g.flags.some((f) => f !== "ranked pick");
  const rank = (g: ReviewGuide) => (g.status !== "published" ? 2 : isFlagged(g) ? 0 : 1);
  reviewed.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en"));

  const published = reviewed.filter((g) => g.status === "published");
  return {
    election: ballot.election,
    title: ballot.title,
    totals: {
      published: published.length,
      pending: reviewed.length - published.length,
      picks: published.reduce((n, g) => n + g.picks.length, 0),
      quotes: published.reduce((n, g) => n + g.quoteCount, 0),
      flagged: published.filter(isFlagged).length,
    },
    guides: reviewed,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderReviewHtml(model: ReviewModel): string {
  const t = model.totals;
  const guideHtml = model.guides
    .map((g) => {
      const flags = g.flags.map((f) => `<span class="flag${f === "ranked pick" ? " info" : ""}">${esc(f)}</span>`).join("");
      const rows = g.picks
        .map((p) => {
          const change =
            p.change === "new" ? `<span class="chg new">new</span>` : p.change === "changed" ? `<span class="chg changed">was ${esc(p.previous ?? "")}</span>` : "";
          const quotes = p.quotes
            .map((q) => `<blockquote>“${esc(q.text)}” <a href="${esc(q.source)}" target="_blank" rel="noopener noreferrer">source</a></blockquote>`)
            .join("");
          return `<tr><td class="contest">${esc(p.contestTitle)}</td><td><b>${esc(p.label)}</b> ${change}${quotes}</td></tr>`;
        })
        .join("");
      const removed = g.removed.length
        ? `<p class="removed">Removed since last commit: ${g.removed.map((r) => `${esc(r.contestTitle)} (${esc(r.label)})`).join("; ")}</p>`
        : "";
      const sources = g.sources
        .map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${i === 0 ? "source" : `extra ${i}`}</a>`)
        .join(" · ");
      return `<section class="guide" data-id="${esc(g.id)}" data-flagged="${g.flags.some((f) => f !== "ranked pick")}" data-status="${esc(g.status)}">
  <header>
    <h2>${esc(g.name)}</h2>
    <div class="meta">${esc(g.type)} · ${esc(g.status)} · ${g.picks.length} picks · ${g.quoteCount} quotes · explains picks: ${g.hasReasoning ? "yes" : "no"} · as of ${esc(g.fetchedAt)} · ${sources || "no source"}</div>
    <div class="flags">${flags}</div>
  </header>
  ${g.picks.length ? `<table>${rows}</table>` : `<p class="muted">No picks.</p>`}
  ${removed}
  <div class="verdict">
    <label><input type="radio" name="v-${esc(g.id)}" value="ok"> Looks good</label>
    <label><input type="radio" name="v-${esc(g.id)}" value="fix"> Needs a fix</label>
    <textarea placeholder="Notes for Claude…" rows="2"></textarea>
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bay Ballot Data Review</title>
<style>
:root { --bg:#fff; --fg:#171717; --muted:#6b6b6b; --line:#e5e5e5; --soft:#f5f5f5; --flag:#b45309; --flagbg:#fef3c7; --new:#15803d; --newbg:#dcfce7; --chg:#b91c1c; --chgbg:#fee2e2; --accent:#2563eb; }
@media (prefers-color-scheme: dark) { :root { --bg:#0a0a0a; --fg:#ededed; --muted:#a3a3a3; --line:#2a2a2a; --soft:#171717; --flag:#fbbf24; --flagbg:#3a2a07; --new:#4ade80; --newbg:#0f2a17; --chg:#f87171; --chgbg:#3a1414; --accent:#60a5fa; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 -apple-system, system-ui, sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 80px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.summary { color: var(--muted); margin-bottom: 16px; }
.bar { position: sticky; top: 0; background: var(--bg); padding: 10px 0; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 12px; align-items: center; z-index: 2; }
.bar button { border: 1px solid var(--line); background: var(--bg); color: var(--fg); padding: 8px 12px; border-radius: 8px; cursor: pointer; font: inherit; }
.bar .progress { color: var(--muted); }
.guide { border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin: 16px 0; }
.guide.ok { border-color: var(--new); }
.guide.fix { border-color: var(--chg); }
.guide h2 { font-size: 18px; margin: 0; }
.meta { color: var(--muted); font-size: 13px; }
.meta a, blockquote a { color: var(--accent); }
.flags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.flag { background: var(--flagbg); color: var(--flag); border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
.flag.info { background: var(--soft); color: var(--muted); }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
td { border-top: 1px solid var(--line); padding: 8px 6px; vertical-align: top; }
td.contest { width: 34%; color: var(--muted); }
.chg { border-radius: 6px; padding: 1px 6px; font-size: 12px; font-weight: 600; }
.chg.new { background: var(--newbg); color: var(--new); }
.chg.changed { background: var(--chgbg); color: var(--chg); }
blockquote { margin: 6px 0 0; padding: 6px 10px; background: var(--soft); border-left: 3px solid var(--line); border-radius: 4px; font-size: 14px; }
.removed { color: var(--chg); font-size: 13px; }
.muted { color: var(--muted); }
.verdict { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.verdict textarea { flex: 1 1 100%; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 8px; padding: 8px; font: inherit; }
.hidden { display: none; }
</style></head>
<body><main>
<h1>Data review · ${esc(model.title)}</h1>
<div class="summary">${t.published} published · ${t.pending} pending · ${t.picks} picks · ${t.quotes} quotes · <b>${t.flagged} flagged</b>. Flagged guides are listed first. Changes are compared with the last commit.</div>
<div class="bar">
  <button id="only-flagged">Show flagged only</button>
  <button id="copy">Copy my notes</button>
  <span class="progress" id="progress"></span>
</div>
${guideHtml}
</main>
<script>
const KEY = "bb-review-${esc(model.election)}";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };
const sections = [...document.querySelectorAll(".guide")];
function paint() {
  let done = 0;
  for (const s of sections) {
    const v = (saved[s.dataset.id] || {}).verdict;
    s.classList.toggle("ok", v === "ok");
    s.classList.toggle("fix", v === "fix");
    if (v) done++;
  }
  document.getElementById("progress").textContent = done + " of " + sections.length + " reviewed";
}
for (const s of sections) {
  const id = s.dataset.id, st = saved[id] || {};
  s.querySelectorAll("input[type=radio]").forEach((r) => {
    r.checked = st.verdict === r.value;
    r.addEventListener("change", () => { saved[id] = { ...(saved[id] || {}), verdict: r.value }; save(); paint(); });
  });
  const ta = s.querySelector("textarea");
  ta.value = st.note || "";
  ta.addEventListener("input", () => { saved[id] = { ...(saved[id] || {}), note: ta.value }; save(); });
}
let flaggedOnly = false;
document.getElementById("only-flagged").addEventListener("click", (e) => {
  flaggedOnly = !flaggedOnly;
  e.target.textContent = flaggedOnly ? "Show all" : "Show flagged only";
  sections.forEach((s) => s.classList.toggle("hidden", flaggedOnly && s.dataset.flagged !== "true"));
});
document.getElementById("copy").addEventListener("click", async (e) => {
  const lines = sections.map((s) => {
    const st = saved[s.dataset.id] || {};
    if (!st.verdict && !st.note) return null;
    return "- " + s.dataset.id + ": " + (st.verdict === "ok" ? "looks good" : st.verdict === "fix" ? "NEEDS FIX" : "no verdict") + (st.note ? " — " + st.note : "");
  }).filter(Boolean);
  const text = lines.length ? "Data review notes:\\n" + lines.join("\\n") : "No review notes yet.";
  try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy my notes"), 1500); }
  catch { prompt("Copy these notes:", text); }
});
paint();
</script>
</body></html>`;
}
