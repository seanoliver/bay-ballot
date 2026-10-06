import { ImageResponse } from "next/og";
import { ContestShare } from "@/components/share/ContestCard";
import { contestShare } from "@/components/share/data";
import { shareFonts } from "@/components/share/fonts";
import { SIZE, ShareFrame } from "@/components/share/ShareFrame";

export const alt = "How San Francisco voter guides split on this contest";
export const size = SIZE;
export const contentType = "image/png";

// Prerender one image per contest at build time, like the contest pages.
export const dynamicParams = false;
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ election: string; contest: string }> }) {
  const { election, contest } = await params;
  const share = contestShare(election, contest);
  return new ImageResponse(
    (
      <ShareFrame right={share?.right}>
        {share ? <ContestShare card={share.card} /> : <div style={{ display: "flex", fontSize: 48 }}>Bay Ballot</div>}
      </ShareFrame>
    ),
    { ...size, fonts: await shareFonts() },
  );
}
