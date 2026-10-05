import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cardDescription, contestHeadline } from "@/lib/display";
import type { Row } from "@/lib/filters";
import type { Contest } from "@/lib/schema";
import { Verdict } from "./Verdict";

// Static contest card for the no-JS fallback: the summary plus a link to the contest page.
export function ContestSummary({ election, contest, rows }: { election: string; contest: Contest; rows: Row[] }) {
  const { headline, topPicks } = contestHeadline(contest, rows);
  const description = cardDescription(contest);
  return (
    <Card className="gap-0 p-4 shadow-xs">
      <h3 className="text-lg leading-snug font-semibold">
        <Link href={`/${election}/${contest.id}`} className="underline-offset-2 hover:underline">
          {contest.title}
        </Link>
      </h3>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <Verdict headline={headline} topPicks={topPicks} ranked={<span className="text-sm text-muted-foreground">(ranked #1)</span>} />
    </Card>
  );
}
