import Link from "next/link";
import { contestHeadline, type Headline } from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";

const TONE: Record<Headline["tone"], string> = {
  yes: "text-green-700",
  no: "text-red-700",
  candidate: "text-blue-800",
  split: "text-amber-700",
  none: "text-zinc-500",
};

// Pure presentational: takes precomputed rows so a client view can pass filtered rows later.
export function ContestSummary({ election, contest, rows }: { election: string; contest: Contest; rows: Row[] }) {
  const { headline, runnersUp } = contestHeadline(contest, rows);
  return (
    <div className="py-3">
      <Link href={`/${election}/${contest.id}`} className="font-medium underline-offset-2 hover:underline">
        {contest.title}
      </Link>
      {contest.kind === "measure" && contest.description ? (
        <p className="text-sm text-zinc-600">{contest.description}</p>
      ) : null}
      <p className="mt-1">
        <span className={`font-semibold ${TONE[headline.tone]}`}>{headline.label}</span>
        {headline.ranked ? <span className="ml-1 text-xs text-zinc-500">(ranked #1)</span> : null}
        {headline.detail ? <span className="ml-2 text-sm text-zinc-600">{headline.detail}</span> : null}
      </p>
      {runnersUp ? <p className="text-sm text-zinc-500">Also: {runnersUp}</p> : null}
    </div>
  );
}
