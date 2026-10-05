import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bay Ballot",
  description: "What San Francisco voter guides recommend, side by side.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-full">
        <header className="border-b border-line">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              Bay Ballot
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
