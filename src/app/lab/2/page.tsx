import type { Metadata } from "next";
import { TableView } from "@/components/lab/TableView";
import { labProps } from "../data";

export const metadata: Metadata = { title: "Lab 2: Table · Bay Ballot" };

export default function Page() {
  return <TableView {...labProps()} />;
}
