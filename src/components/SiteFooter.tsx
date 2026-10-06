import Link from "next/link";
import { dataAsOf } from "@/lib/display";
import { election, latestElection } from "@/lib/site-data";
import { ExternalLink } from "./ExternalLink";
import { FRAME } from "./frame";

const REPO = "https://github.com/seanoliver/bay-ballot";
const LINK = "whitespace-nowrap underline underline-offset-2 hover:text-foreground";

export function SiteFooter() {
  const asOf = dataAsOf(election(latestElection())?.endorsements ?? {});
  return (
    <footer className="mt-8 border-t border-border bg-muted/40">
      <div className={`${FRAME} space-y-2 py-8 text-sm`}>
        <p>
          Built and maintained in San Francisco by{" "}
          <ExternalLink href="https://seanoliver.dev" className="underline underline-offset-2">
            Sean Oliver
          </ExternalLink>
        </p>
        <p className="text-muted-foreground">
          <ExternalLink href={REPO} className={LINK}>
            Fully open source on GitHub
          </ExternalLink>
          {". Spotted a mistake? "}
          <a href="mailto:corrections@bayballot.com" className={LINK}>
            corrections@bayballot.com
          </a>
          {" · "}
          <ExternalLink href={`${REPO}/issues/new?template=data-correction.yml`} className={LINK}>
            Open an issue
          </ExternalLink>
        </p>
        <p className="text-muted-foreground">Independent; not affiliated with any guide. Every quote links to its source.</p>
        <p className="text-muted-foreground">
          {asOf ? `Data as of ${asOf} · ` : null}
          <Link href="/changelog" className={LINK}>
            Changelog
          </Link>
        </p>
      </div>
    </footer>
  );
}
