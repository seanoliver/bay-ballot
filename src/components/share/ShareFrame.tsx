import type { CSSProperties, ReactNode } from "react";
import type { BarSegment, BarTone } from "@/lib/bar";
import { breakLines } from "@/lib/share";
import { HOLE, HOLE_RADIUS, HOLES, OFF_OPACITY } from "@/lib/logo";

export const INK = "#0a0a0a";
export const MUTED = "#666666";
export const PAPER = "#fafafa";
export const LINE = "#e5e5e5";
export const FILL: Record<BarTone, string> = {
  yes: "#166534",
  no: "#e25c5c",
  c1: "#2a78d6",
  c2: "#e87ba4",
  c3: "#4a3aa7",
  c4: "#1baf7a",
  other: "rgba(102,102,102,0.4)",
  empty: "#ebebeb",
};
export const LEAD_INK = { yes: "#15803d", no: "#b91c1c", split: "#b45309", candidate: INK, none: MUTED } as const;
export const SIZE = { width: 1200, height: 630 };

// Nbsp keeps each line one kerned run: the renderer leaves uneven gaps where it splits at spaces.
export const run = (text: string) => text.replace(/ /g, "\u00a0");

export function Lines({ text, maxChars, maxLines, style }: { text: string; maxChars: number; maxLines: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {breakLines(text, maxChars, maxLines).map((line, i) => (
        <div key={i} style={{ display: "flex" }}>
          {run(line)}
        </div>
      ))}
    </div>
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={INK}>
      {HOLES.map((h) => (
        <rect key={`${h.x}-${h.y}`} x={h.x} y={h.y} width={HOLE} height={HOLE} rx={HOLE_RADIUS} opacity={h.on ? 1 : OFF_OPACITY} />
      ))}
    </svg>
  );
}

export function ShareFrame({ right, children }: { right?: string; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "Geist" }}>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "56px 72px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={52} />
            <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>{run("Bay Ballot")}</span>
          </div>
          {right ? <span style={{ fontSize: 26, color: MUTED }}>{run(right)}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>{children}</div>
      </div>
      <div style={{ display: "flex", gap: 6, height: 14 }}>
        <div style={{ flexGrow: 62, background: INK }} />
        <div style={{ flexGrow: 24, background: INK, opacity: 0.55 }} />
        <div style={{ flexGrow: 14, background: INK, opacity: 0.25 }} />
      </div>
    </div>
  );
}

export function ShareBar({ segments, height = 36 }: { segments: BarSegment[]; height?: number }) {
  return (
    <div style={{ display: "flex", gap: 4, height, width: "100%" }}>
      {segments.map((s, i) => (
        <div
          key={s.key}
          style={{
            flexGrow: s.count || 1,
            flexBasis: 0,
            background: FILL[s.tone],
            borderTopLeftRadius: i === 0 ? height / 2 : 0,
            borderBottomLeftRadius: i === 0 ? height / 2 : 0,
            borderTopRightRadius: i === segments.length - 1 ? height / 2 : 0,
            borderBottomRightRadius: i === segments.length - 1 ? height / 2 : 0,
          }}
        />
      ))}
    </div>
  );
}

export function Swatch({ tone, size = 18 }: { tone: BarTone; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: FILL[tone] }} />;
}
