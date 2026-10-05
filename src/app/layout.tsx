import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist } from "next/font/google";
import { FRAME } from "@/components/frame";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Bay Ballot",
  description: "What San Francisco voter guides recommend, side by side.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("antialiased", "font-sans", geist.variable)}>
      {/* Light: cards on a muted page. Dark: --card is already lighter than --background. */}
      <body className="min-h-full bg-muted dark:bg-background">
        <header className="bg-background">
          <div className={`${FRAME} pt-4`}>
            <Link href="/" className="inline-flex min-h-10 items-center text-2xl font-extrabold tracking-tight">
              Bay Ballot
            </Link>
          </div>
        </header>
        {/* Pages set their own width so bands (like the sticky filter bar) can span the screen. */}
        <main>{children}</main>
      </body>
    </html>
  );
}
