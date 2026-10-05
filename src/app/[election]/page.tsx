import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotView } from "@/components/BallotView";
import { electionSubtitle } from "@/lib/display";
import { ballotViewProps, election, elections } from "@/lib/site-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function generateMetadata({ params }: PageProps<"/[election]">): Promise<Metadata> {
  const d = election((await params).election);
  return d ? { title: `${d.ballot.title} · Bay Ballot` } : {};
}

export default async function ElectionPage({ params }: PageProps<"/[election]">) {
  const id = (await params).election;
  const d = election(id);
  if (!d) notFound();
  return <BallotView election={id} subtitle={electionSubtitle(d.ballot)} {...ballotViewProps(d)} />;
}
