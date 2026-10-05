import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Layout lab · Bay Ballot" };

const OPTIONS = [
  { href: "/lab/1", name: "Split view", blurb: "Filters, a compact contest list, and a detail pane side by side. Phone: one-line rows; details open in a sheet." },
  { href: "/lab/2", name: "Table", blurb: "One row per contest with result bar, guide count and the top quote. Rows expand in place." },
  { href: "/lab/3", name: "Card grid", blurb: "Toolbar on top, a grid of compact result cards. A card expands to full width." },
];

export default function LabIndex() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-2 pb-10">
      <h1 className="text-xl font-semibold">Layout lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">Three arrangements of the same ballot, filters and data. Pick one.</p>
      <ol className="mt-4 space-y-3">
        {OPTIONS.map((o, i) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-base font-semibold">
                {i + 1}. {o.name}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{o.blurb}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
