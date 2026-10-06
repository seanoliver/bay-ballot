import { ImageResponse } from "next/og";
import { ContestShare } from "@/components/share/ContestCard";
import { areaShare, contestShare } from "@/components/share/data";
import { shareFonts } from "@/components/share/fonts";
import { SIZE, ShareFrame } from "@/components/share/ShareFrame";

export const alt = "How Bay Area voter guides split, side by side";
export const size = SIZE;
export const contentType = "image/png";

export const dynamicParams = false;
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ election: string; contest: string }> }) {
  const { election, contest } = await params;
  const share = contestShare(election, contest) ?? areaShare(election, contest);
  return new ImageResponse(
    (
      <ShareFrame right={share?.right}>
        {share ? <ContestShare card={share.card} /> : <div style={{ display: "flex", fontSize: 48 }}>Bay Ballot</div>}
      </ShareFrame>
    ),
    { ...size, fonts: await shareFonts() },
  );
}
