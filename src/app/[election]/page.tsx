import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { election, elections } from "@/lib/site-data";
import { ListPage, listMetadata } from "./list-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return elections().map((id) => ({ election: id }));
}

export async function generateMetadata({ params }: PageProps<"/[election]">): Promise<Metadata> {
  const id = (await params).election;
  const d = election(id);
  return d ? listMetadata(d, id, null) : {};
}

export default async function ElectionPage({ params }: PageProps<"/[election]">) {
  const id = (await params).election;
  const d = election(id);
  if (!d) notFound();
  return <ListPage d={d} electionId={id} area={null} />;
}
