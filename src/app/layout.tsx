import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist } from "next/font/google";
import { FRAME } from "@/components/frame";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL("https://bayballot.com"),
  title: "Bay Ballot — every SF voter guide in one place",
  description: "What San Francisco's voter guides recommend for each contest, side by side, with quotes that link to their source.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full bg-muted dark:bg-background">
        <header className="bg-background">
          <div className="border-b border-border bg-muted/40">
            <div className={`${FRAME} flex min-h-16 items-center justify-between gap-4`}>
              <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-2xl font-extrabold tracking-tight">
                <Logo size={36} className="-my-2 -ml-1 shrink-0" />
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
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
