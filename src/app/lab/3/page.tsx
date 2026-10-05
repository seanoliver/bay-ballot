import type { Metadata } from "next";
import { CardGrid } from "@/components/lab/CardGrid";
import { labProps } from "../data";

export const metadata: Metadata = { title: "Lab 3: Card grid · Bay Ballot" };

export default function Page() {
  return <CardGrid {...labProps()} />;
}
