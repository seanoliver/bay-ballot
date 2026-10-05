import Link from "next/link";
import { contestHeadline } from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { TONE_CLASS } from "./tone";

// Pure presentational: takes precomputed rows so a client view can pass filtered rows later.
export function ContestSummary({ election, contest, rows }: { election: string; contest: Contest; rows: Row[] }) {
  const { headline, runnersUp } = contestHeadline(contest, rows);
  return (
    <div className="py-3">
      <h3 className="font-medium">
        <Link href={`/${election}/${contest.id}`} className="underline underline-offset-2">
          {contest.title}
        </Link>
      </h3>
      {contest.kind === "measure" && contest.description ? (
        <p className="text-sm text-muted-foreground">{contest.description}</p>
      ) : null}
      <p className="mt-1">
        <span className={`font-semibold ${TONE_CLASS[headline.tone]}`}>{headline.label}</span>
        {headline.ranked ? <span className="ml-1 text-xs text-muted-foreground">(ranked #1)</span> : null}
        {headline.detail ? <span className="ml-2 text-sm text-muted-foreground">{headline.detail}</span> : null}
      </p>
      {runnersUp ? <p className="text-sm text-muted-foreground">Also: {runnersUp}</p> : null}
    </div>
  );
}
