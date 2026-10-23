import { ChevronDown } from "lucide-react";
import { ExternalLink } from "@/components/ExternalLink";
import { historySummary, type GuideRow } from "@/lib/changelog-digest";
import { shortMonthDay } from "@/lib/display";

const PULL = "https://github.com/seanoliver/bay-ballot/pull";

export function GuideHistory({ rows }: { rows: GuideRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group mt-8 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foreground/70 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <h2 className="text-base font-semibold">Change history</h2>
          <span className="text-sm text-muted-foreground">{historySummary(rows)}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="divide-y divide-border/70 border-t border-border bg-muted/40 text-sm">
        {rows.map((r) => (
          <li key={r.file} className="flex gap-3 px-4 py-2.5">
            <time dateTime={r.date} className="w-14 shrink-0 text-muted-foreground tabular-nums">
              {shortMonthDay(r.date)}
            </time>
            <span className="min-w-0">
              {r.text}
              {r.pr ? (
                <>
                  {" "}
                  <ExternalLink href={`${PULL}/${r.pr}`} aria-label={`Pull request #${r.pr} (opens in new tab)`} className="underline underline-offset-2">
                    #{r.pr}
                  </ExternalLink>
                </>
              ) : null}
              {r.details ? <span className="mt-1 block text-muted-foreground">{r.details}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
