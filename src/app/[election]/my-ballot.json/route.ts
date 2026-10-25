import { election, elections, myBallotData } from "@/lib/site-data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function GET(_req: Request, { params }: RouteContext<"/[election]/my-ballot.json">) {
  const d = election((await params).election);
  if (!d) return new Response(null, { status: 404 });
  return Response.json(myBallotData(d));
}
