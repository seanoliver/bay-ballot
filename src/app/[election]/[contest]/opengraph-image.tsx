import { ImageResponse } from "next/og";
import { AreaShare } from "@/components/share/AreaCard";
import { ContestShare } from "@/components/share/ContestCard";
import { areaShare, contestShare } from "@/components/share/data";
import { shareFonts } from "@/components/share/fonts";
import { SIZE, ShareFrame } from "@/components/share/ShareFrame";

export const alt = "How voter guides split, side by side";
export const size = SIZE;
export const contentType = "image/png";

export const dynamicParams = false;
export { generateStaticParams } from "./page";

export default async function Image({ params }: { params: Promise<{ election: string; contest: string }> }) {
  const { election, contest } = await params;
  const one = contestShare(election, contest);
  const area = one ? null : areaShare(election, contest);
  return new ImageResponse(
    (
      <ShareFrame right={(one ?? area)?.right}>
        {one ? (
          <ContestShare card={one.card} />
        ) : area ? (
          <AreaShare {...area.area} card={area.card} />
        ) : (
          <div style={{ display: "flex", fontSize: 48 }}>Bay Ballot</div>
        )}
      </ShareFrame>
    ),
    { ...size, fonts: await shareFonts() },
  );
}
