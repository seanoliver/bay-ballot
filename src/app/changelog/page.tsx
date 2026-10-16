import type { Metadata } from "next";
import { ChangelogDigest } from "@/components/ChangelogDigest";
import { PageColumn } from "@/components/PageColumn";
import { areaGuides } from "@/lib/areas";
import { readChangelog } from "@/lib/changelog";
import { changelogDays, FOLDED_ROWS } from "@/lib/changelog-digest";
import { DATA_ROOT, election, latestElection } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Changelog · Bay Ballot",
  description: "What's new on Bay Ballot and in its endorsement data.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  const d = election(latestElection())!;
  const days = changelogDays(readChangelog(DATA_ROOT).entries, d.guides);
  const areas = d.areas.map((a) => ({ id: a.id, name: a.name, guides: areaGuides(d.guides, a).map((g) => g.id) }));
  return (
    <PageColumn>
      <article className="measure">
        <h1 className="text-xl font-semibold">Changelog</h1>
        <noscript>
          <style>{`.${FOLDED_ROWS}{display:block;border-top-width:1px;border-radius:calc(var(--radius)*1.4)}`}</style>
        </noscript>
        <ChangelogDigest days={days} areas={areas} />
      </article>
    </PageColumn>
  );
}
