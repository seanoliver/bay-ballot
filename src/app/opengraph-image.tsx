import { ImageResponse } from "next/og";
import { ContestShare } from "@/components/share/ContestCard";
import { exampleShare } from "@/components/share/data";
import { shareFonts } from "@/components/share/fonts";
import { MUTED, SIZE, ShareFrame } from "@/components/share/ShareFrame";

export const alt = "Bay Ballot: every San Francisco voter guide in one place, November 3, 2026";
export const size = SIZE;
export const contentType = "image/png";

// Site-wide image: the tagline, then one real result as an example of what the site shows.
export default async function Image() {
  const example = exampleShare();
  return new ImageResponse(
    (
      <ShareFrame>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 1000 }}>
            Every San Francisco voter guide in one place · November 3, 2026
          </div>
          {example ? (
            <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 36 }}>
              <div style={{ display: "flex", fontSize: 24, color: MUTED, marginBottom: 12 }}>Example from the ballot</div>
              <ContestShare card={{ ...example.card, kicker: null }} compact />
            </div>
          ) : null}
        </div>
      </ShareFrame>
    ),
    { ...size, fonts: await shareFonts() },
  );
}
