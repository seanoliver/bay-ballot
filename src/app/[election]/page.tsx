import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BallotView } from "@/components/BallotView";
import { electionIntro } from "@/lib/display";
import { ballotViewProps, election, elections } from "@/lib/site-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function generateMetadata({ params }: PageProps<"/[election]">): Promise<Metadata> {
  const id = (await params).election;
  const d = election(id);
  return d ? { title: `${d.ballot.title} · Bay Ballot`, alternates: { canonical: `/${id}` } } : {};
}

export default async function ElectionPage({ params }: PageProps<"/[election]">) {
  const id = (await params).election;
  const d = election(id);
  if (!d) notFound();
  const props = ballotViewProps(d);
  return <BallotView election={id} intro={electionIntro(d.ballot, props.files)} {...props} />;
}
