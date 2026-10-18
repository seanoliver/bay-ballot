import { BADGE_NAMES, badge, type BadgeName } from "@/lib/badges";
import { election, latestElection } from "@/lib/site-data";

// Read by the README's shields.io badges; nothing in the site links here.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return BADGE_NAMES.map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: RouteContext<"/badges/[name]">) {
  const { name } = await params;
  const d = election(latestElection());
  if (!d || !BADGE_NAMES.includes(name as BadgeName)) return new Response(null, { status: 404 });
  return Response.json(badge(d, name as BadgeName));
}
