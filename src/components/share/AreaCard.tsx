import type { ShareCard } from "@/lib/share";
import { ContestShare } from "./ContestCard";
import { Lines, MUTED, run } from "./ShareFrame";

export function AreaShare({ headline, counts, card }: { headline: string; counts: string; card: ShareCard }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <Lines text={headline} maxChars={32} maxLines={1} style={{ fontSize: 54, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }} />
      <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: MUTED }}>{run(counts)}</div>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 36 }}>
        <ContestShare card={{ ...card, kicker: null }} compact />
      </div>
    </div>
  );
}
