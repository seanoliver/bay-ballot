import type { Metadata } from "next";
import { ExternalLink } from "@/components/ExternalLink";
import { FRAME, READING } from "@/components/frame";
import { changelogMonths, readChangelog } from "@/lib/changelog";
import { formatDate } from "@/lib/display";
import type { ChangelogEntry } from "@/lib/schema";
import { DATA_ROOT } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Changelog · Bay Ballot",
  description: "What's new on Bay Ballot and in its endorsement data.",
  alternates: { canonical: "/changelog" },
};

const PULL = "https://github.com/seanoliver/bay-ballot/pull";
const LABEL: Record<ChangelogEntry["type"], string> = { new: "New", data: "Data", fix: "Fix" };

export default function ChangelogPage() {
  const months = changelogMonths(readChangelog(DATA_ROOT).entries);
  return (
    <div className={`${FRAME} ${READING} pt-6 pb-10`}>
      <article className="measure">
        <h1 className="text-xl font-semibold">Changelog</h1>
        {months.map((m) => (
          <section key={m.label} className="mt-8">
            <h2 className="text-base font-semibold">{m.label}</h2>
            <ol className="mt-3 space-y-4">
              {m.entries.map((e) => (
                <li key={e.file} className="text-base">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <time dateTime={e.date}>{formatDate(e.date)}</time>
                    <span className="rounded-full border border-border px-2 text-xs font-medium text-foreground">{LABEL[e.type]}</span>
                    {e.pr ? (
                      <ExternalLink href={`${PULL}/${e.pr}`} aria-label={`Pull request #${e.pr} (opens in new tab)`} className="underline underline-offset-2">
                        #{e.pr}
                      </ExternalLink>
                    ) : null}
                  </p>
                  <p className="mt-1 font-medium">{e.title}</p>
                  {e.details ? <p className="text-sm text-muted-foreground">{e.details}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </article>
    </div>
  );
}
