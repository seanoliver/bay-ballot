import type { Metadata } from "next";
import { SplitView } from "@/components/lab/SplitView";
import { labProps } from "../data";

export const metadata: Metadata = { title: "Lab 1: Split view · Bay Ballot" };

export default function Page() {
  return <SplitView {...labProps()} />;
}
