import { redirect } from "next/navigation";
import { latestElection } from "@/lib/site-data";

export default function Home() {
  redirect(`/${latestElection()}`);
}
