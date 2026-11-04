import Link from "next/link";
import { dataAsOf } from "@/lib/display";
import { election, electionIndex, latestElection } from "@/lib/site-data";
import { ExternalLink } from "./ExternalLink";
import { FRAME } from "./frame";
import { VotingLinks } from "./VotingLinks";

const REPO = "https://github.com/seanoliver/bay-ballot";
const LINK = "underline underline-offset-2 hover:text-foreground";
const COL_LINK = `${LINK} flex min-h-10 items-center text-foreground/85`;
const HEADING = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";


export function SiteFooter() {
  const id = latestElection();
  const asOf = dataAsOf(election(id)?.endorsements ?? {});
  return (
    <footer className="mt-8 border-t border-border bg-muted/40">
      {/* pb-24: room below the last row for the Your ballot pill. */}
      <div className={`${FRAME} space-y-6 pt-8 pb-24 text-sm`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 lg:gap-x-8">
          <section id="before-you-vote" tabIndex={-1} aria-labelledby="before-you-vote-heading" className="col-span-2 scroll-mt-4 outline-none rounded-2xl bg-background px-4 pt-3 pb-1 ring-1 ring-foreground/15 lg:col-span-1">
            <VotingLinks date={election(id)!.ballot.date} />
          </section>
          <nav aria-label="Footer">
            <h2 className={HEADING}>
              Site
            </h2>
            <Link href={electionIndex(id)} className={COL_LINK}>
              Ballot
            </Link>
            <Link href="/changelog" className={COL_LINK}>
              Changelog
            </Link>
            <Link href="/about" className={COL_LINK}>
              About
            </Link>
          </nav>
          <div>
            <h2 className={HEADING}>Contact</h2>
            <a href="mailto:corrections@bayballot.com" className={COL_LINK}>
              <span>
                corrections@
                <wbr />
                bayballot.com
              </span>
            </a>
            <ExternalLink href={`${REPO}/issues/new?template=data-correction.yml`} className={COL_LINK}>
              Open an issue
            </ExternalLink>
          </div>
        </div>
        <div className="space-y-1 border-t border-border pt-4 text-muted-foreground">
          <p>
            {asOf ? `Data as of ${asOf} · ` : null}
            {"Every quote links to its source · Independent; not affiliated with any guide · "}
            <ExternalLink href={REPO} className={LINK}>
              Open source
            </ExternalLink>
          </p>
          <p>
            Built and maintained in San Francisco by{" "}
            <ExternalLink href="https://seanoliver.dev" className={`${LINK} text-foreground`}>
              Sean Oliver
            </ExternalLink>
          </p>
        </div>
      </div>
    </footer>
  );
}
