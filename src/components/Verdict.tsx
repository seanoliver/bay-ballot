import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { topPickCount, type Headline, type TopPick } from "@/lib/display";
import { BADGE_CLASS } from "./tone";

// The collapsed-card summary: verdict badge and detail, or "Most endorsed" with one name per line.
// `ranked` renders next to the badge when the headline comes from ranked endorsements.
export function Verdict({ headline, topPicks, ranked }: { headline: Headline; topPicks: TopPick[]; ranked?: ReactNode }) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge className={`h-auto rounded-md px-2.5 py-1 text-[15px] font-bold whitespace-normal ${BADGE_CLASS[headline.tone]}`}>
          {headline.label}
        </Badge>
        {headline.ranked ? ranked : null}
        {headline.detail ? <span className="text-sm text-muted-foreground">{headline.detail}</span> : null}
      </div>
      {topPicks.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[15px]">
          {topPicks.map((p) => (
            <li key={p.name}>
              {p.name}{" "}
              <span className="text-sm text-muted-foreground">· {topPickCount(p)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
