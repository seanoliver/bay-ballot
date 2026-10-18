import path from "node:path";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import ContestPage from "@/app/[election]/[contest]/page";
import { ContestView } from "@/components/ContestView";
import { localGuides } from "@/lib/areas";
import { loadElection } from "@/lib/data";

const d = loadElection(path.join(process.cwd(), "data"), "2026-11");

// The page is a server component that only composes props, so its element tree can be read without rendering.
// No contest in the data has a pick whose order the area-first rule changes, so an e2e can't see a missing `local`.
async function viewProps(contest: string) {
  const page = (await ContestPage({ params: Promise.resolve({ election: "2026-11", contest }) } as PageProps<"/[election]/[contest]">)) as ReactElement<{ children: unknown }>;
  const view = [page.props.children].flat().find((el): el is ReactElement<Parameters<typeof ContestView>[0]> => isValidElement(el) && el.type === ContestView);
  if (!view) throw new Error(`no ContestView on ${contest}`);
  return view.props;
}

describe("contest page", () => {
  it("hands a city contest's view its city's and its county's guides to list first", async () => {
    const city = d.areas.find((a) => a.id === "palo-alto")!;
    const county = d.areas.find((a) => a.id === "santa-clara-county")!;
    const props = await viewProps("palo-alto-council");
    expect(props.area).toBe(city.id);
    expect(props.local).toEqual(localGuides(d.guides, city, d.areas).map((g) => g.id));
    const cityOnly = d.guides.find((g) => g.areas.includes(city.id) && !g.areas.includes(county.id));
    const countyOnly = d.guides.find((g) => g.areas.includes(county.id) && !g.areas.includes(city.id));
    expect(props.local).toContain(cityOnly!.id);
    expect(props.local).toContain(countyOnly!.id);
  });

  it("lists no guides first on a statewide contest, which has no area", async () => {
    const props = await viewProps("supreme-court-groban");
    expect(props.area).toBeNull();
    expect(props.local).toBeUndefined();
  });
});
