import { jsonLdHtml } from "@/lib/structured-data";

// A plain <script>, not next/script: structured data is not code to load (Next's JSON-LD guide).
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />;
}
