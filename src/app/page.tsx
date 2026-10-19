import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { election, latestElection } from "@/lib/site-data";
import { websiteJsonLd } from "@/lib/structured-data";
import { ListPage, listMetadata } from "./[election]/list-page";

export function generateMetadata(): Metadata {
  const id = latestElection();
  return listMetadata(election(id)!, id, null);
}

export default function Home() {
  const id = latestElection();
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <ListPage d={election(id)!} electionId={id} area={null} />
    </>
  );
}
