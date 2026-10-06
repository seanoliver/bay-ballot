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
        {/* Report frame: a quiet full-width band, then the three-bar rule from the mark. */}
        <header className="bg-background">
          <div className="border-b border-border bg-muted/40">
            <div className={`${FRAME} flex min-h-16 items-center justify-between gap-4`}>
              <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-2xl font-extrabold tracking-tight">
                {/* Logo mark goes here (TBD). */}
                Bay Ballot
              </Link>
              <nav aria-label="Site">
                <Link href="/about" className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  About
                </Link>
              </nav>
            </div>
          </div>
          <div aria-hidden="true" className="flex h-1 gap-[3px]">
            <span className="flex-[62] bg-foreground" />
            <span className="flex-[24] bg-foreground/55" />
            <span className="flex-[14] bg-foreground/25" />
          </div>
        </header>
        {/* Pages set their own width so bands (like the sticky filter bar) can span the screen. */}
        <main>{children}</main>
      </body>
    </html>
  );
}
