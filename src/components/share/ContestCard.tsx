import type { ShareCard } from "@/lib/share";
import { FILL, LEAD_INK, MUTED, ShareBar, Swatch } from "./ShareFrame";

// One contest's result as drawn on its share image. `compact`: the smaller example on the site-wide image.
export function ContestShare({ card, compact = false }: { card: ShareCard; compact?: boolean }) {
  const titleSize = compact ? 36 : 64;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div
        style={{
          display: "flex",
          fontSize: titleSize,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          maxHeight: Math.ceil(titleSize * 1.1 * 2) + 2,
          overflow: "hidden",
        }}
      >
        {card.title}
      </div>
      {card.kicker ? (
        <div style={{ display: "flex", marginTop: 10, fontSize: 28, color: MUTED, maxWidth: 1000 }}>{card.kicker}</div>
      ) : null}
      {card.lead === null ? (
        <div style={{ display: "flex", marginTop: 40, fontSize: 40, color: MUTED }}>{card.sub}</div>
      ) : (
        // The image renderer lays out fragments as rows; a column div keeps the result stacked.
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: compact ? 16 : 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", fontSize: compact ? 36 : 52, fontWeight: 600, color: LEAD_INK[card.leadTone] }}>
              {card.lead}
              {card.ranked ? <span style={{ marginLeft: 8, fontSize: 40, color: MUTED }}>*</span> : null}
            </div>
            <div style={{ display: "flex", fontSize: compact ? 24 : 30, color: MUTED }}>{card.sub}</div>
          </div>
          {card.multi ? <Seats card={card} /> : <Result card={card} compact={compact} />}
        </div>
      )}
    </div>
  );
}

function Result({ card, compact }: { card: ShareCard; compact: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: compact ? 14 : 20 }}>
      <ShareBar segments={card.segments} height={compact ? 26 : 36} />
      <div style={{ display: "flex", flexWrap: "wrap", marginTop: compact ? 12 : 18, fontSize: compact ? 24 : 28 }}>
        {card.legend.map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32, marginBottom: 6 }}>
            <Swatch tone={l.tone} />
            <span>{l.label}</span>
            <span style={{ color: MUTED }}>{l.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Seats({ card }: { card: ShareCard }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 14, marginTop: 20 }}>
      {card.seats.map((s) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
          <div style={{ display: "flex", width: 380, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap" }}>{s.label}</div>
          <div style={{ display: "flex", flexGrow: 1, flexBasis: 0, height: 22, borderRadius: 11, background: FILL.empty }}>
            <div style={{ width: `${s.pct}%`, height: 22, borderRadius: 11, background: FILL[s.tone] }} />
          </div>
          <div style={{ display: "flex", width: 160, flexShrink: 0, justifyContent: "flex-end", color: MUTED }}>{`${s.count} of ${card.total}`}</div>
        </div>
      ))}
    </div>
  );
}
