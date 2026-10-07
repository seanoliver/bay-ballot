import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { PageColumn } from "@/components/PageColumn";

export const metadata: Metadata = { title: "About · Bay Ballot", alternates: { canonical: "/about" } };

const REPO = "https://github.com/seanoliver/bay-ballot";
const LINK = "underline underline-offset-2";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-base">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export default function AboutPage() {
  return (
    <PageColumn>
      <article className="measure">
        <h1 className="text-xl font-semibold">About Bay Ballot</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Endorsements for the November 3, 2026 election from voter guides in San Francisco, San Mateo County, Palo Alto, Mountain View and Marin County.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="space-y-4 text-base">
            <p>
              I&apos;ve lived in San Francisco since 2012, and both my kids are in SFUSD. Every election since 2016, I&apos;ve sat down with my ballot and a
              dozen browser tabs: the Chronicle, the League of Women Voters, the local clubs and unions, a few advocacy groups. I kept a spreadsheet of
              who endorsed what, to see where the guides agreed and where they split.
            </p>
            <p>
              Over the years I started sharing that spreadsheet with friends and colleagues to help them vote, and kept running into the same problem.
              Many of them live outside San Francisco, all over the Bay Area, and my spreadsheet only covered the city.
            </p>
            <p>
              So I turned it into Bay Ballot: one place for every voter guide in the Bay Area, side by side, one contest at a time, with the reasons
              each guide gives in its own words. It starts with San Francisco, the Peninsula and Marin and will grow from there. It stays up to date as guides
              publish, and it&apos;s free for everyone.
            </p>
            <p>It doesn&apos;t tell you how to vote. It shows you what the people who spend time on this are recommending, and why.</p>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              SO
            </div>
            <div>
              <div className="font-semibold">Sean Oliver</div>
              <div className="text-sm text-muted-foreground">
                San Francisco ·{" "}
                <ExternalLink href="https://seanoliver.dev" className={LINK}>
                  seanoliver.dev
                </ExternalLink>
              </div>
            </div>
          </div>
        </div>

        <hr className="mt-8 border-border" />

        <Section title="How guides are found">
          <p>
            For each area, I look for every voter guide that publishes endorsements: newspaper editorial boards, party committees, political clubs,
            labor councils, advocacy groups and civic groups. A guide&apos;s endorsements appear once it publishes them for this election.
          </p>
        </Section>

        <Section title="How endorsements are collected">
          <p>
            For most guides, an automated process reads the guide&apos;s published pages and records its endorsements, along with short quotes giving
            its reasons. A separate check confirms each quote appears word for word on the guide&apos;s page. Quotes that fail are left out, and
            endorsements the check can&apos;t confirm stay off the site until they&apos;re confirmed. A few guides publish their endorsements as images
            or documents, and I enter those by hand. I monitor the whole process closely. Each quote links to its source or an archived copy. Guides
            that publish only a list of endorsements show no quotes.
          </p>
        </Section>

        <Section title="Staying current">
          <p>
            Guides are checked for updates every day, and the few that can&apos;t be checked automatically are checked by hand. Updates are listed on
            the{" "}
            <Link href="/changelog" className={LINK}>
              changelog
            </Link>
            .
          </p>
        </Section>

        <Section title="Open source">
          <p>
            All of the code and data are{" "}
            <ExternalLink href={REPO} className={LINK}>
              public on GitHub
            </ExternalLink>
            , so anyone can see exactly how it works.
          </p>
        </Section>

        <Section title="Counting">
          <List>
            <li>Only guides that took a position on a contest count toward it.</li>
            <li>A guide that ranks candidates counts toward its first choice.</li>
            <li>In races with more than one seat, each name a guide endorses counts.</li>
            <li>An area&apos;s page counts only the guides that cover that area. The Bay Area list counts every guide.</li>
          </List>
        </Section>

        <Section title="Independence">
          <List>
            <li>Bay Ballot makes no endorsements of its own.</li>
            <li>It is not affiliated with any guide or campaign.</li>
          </List>
        </Section>

        <Section title="Privacy">
          <List>
            <li>Bay Ballot counts page views with Vercel Web Analytics, which uses no cookies.</li>
            <li>It never records addresses or ZIP codes.</li>
          </List>
        </Section>

        <Section title="Corrections">
          <p>If something here doesn&apos;t match what a guide published:</p>
          <List>
            <li>
              Email{" "}
              <a href="mailto:corrections@bayballot.com" className={LINK}>
                corrections@bayballot.com
              </a>
              .
            </li>
            <li>
              <ExternalLink href={`${REPO}/issues/new?template=data-correction.yml`} className={LINK}>
                Open an issue on GitHub
              </ExternalLink>
              .
            </li>
            <li>
              Send a{" "}
              <ExternalLink href={`${REPO}/pulls`} className={LINK}>
                pull request
              </ExternalLink>{" "}
              with the fix.
            </li>
          </List>
        </Section>
      </article>
    </PageColumn>
  );
}
