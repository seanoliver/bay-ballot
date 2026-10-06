import { ImageResponse } from "next/og";
import { ContestShare } from "@/components/share/ContestCard";
import { exampleShare } from "@/components/share/data";
import { shareFonts } from "@/components/share/fonts";
import { Lines, MUTED, run, SIZE, ShareFrame } from "@/components/share/ShareFrame";

export const alt = "Bay Ballot: every Bay Area voter guide in one place, November 3, 2026";
export const size = SIZE;
export const contentType = "image/png";

export default async function Image() {
  const example = exampleShare();
  return new ImageResponse(
    (
      <ShareFrame>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <Lines
            text="Every Bay Area voter guide in one place · November 3, 2026"
            maxChars={32}
            maxLines={2}
            style={{ fontSize: 54, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}
          />
          {example ? (
            <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 36 }}>
              <div style={{ display: "flex", fontSize: 24, color: MUTED, marginBottom: 12 }}>{run("Example from the ballot")}</div>
              <ContestShare card={{ ...example.card, kicker: null }} compact />
            </div>
          ) : null}
        </div>
      </ShareFrame>
    ),
    { ...size, fonts: await shareFonts() },
  );
}
