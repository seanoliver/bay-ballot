import { election, electionSnapshot, elections } from "@/lib/site-data";

// Every area's list data, fetched by area pages so the area chips switch in the browser.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function GET(_req: Request, { params }: RouteContext<"/[election]/snapshot.json">) {
  const d = election((await params).election);
  if (!d) return new Response(null, { status: 404 });
  return Response.json(electionSnapshot(d));
}
