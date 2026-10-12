import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NextStep } from "@/lib/areas";

// The last row of a contest card, so a reader who arrived from search finds the rest of their ballot.
export function BallotNextStep({ step, carry }: { step: NextStep; carry: string }) {
  const edge = "-mx-4 -mb-4 mt-6 border-t border-border sm:-mx-6 sm:-mb-6";
  if (step.kind === "area") {
    return (
      <Link href={`${step.link.href}${carry}`} className={`${edge} flex min-h-11 items-center justify-between gap-3 rounded-b-xl px-4 py-4 font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-6`}>
        {step.link.label}
        <ArrowRight aria-hidden className="size-5 shrink-0" />
      </Link>
    );
  }
  return (
    <nav aria-labelledby="next-step-heading" className={`${edge} px-4 py-4 sm:px-6 sm:pb-6`}>
      <h2 id="next-step-heading" className="text-base font-medium">See the rest of your ballot</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{step.note} Pick your county:</p>
      <ul className="mt-3 grid grid-cols-2 gap-2 min-[375px]:grid-cols-3 sm:flex sm:flex-wrap">
        {step.links.map((l) => (
          <li key={l.href}>
            <Link href={`${l.href}${carry}`} className="flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-sm leading-tight outline-none ring-1 ring-foreground/10 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:rounded-full sm:px-3">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
