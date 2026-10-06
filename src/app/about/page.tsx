import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { FRAME, READING } from "@/components/frame";

export const metadata: Metadata = { title: "About · Bay Ballot" };

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
    <div className={`${FRAME} ${READING} pt-6 pb-10`}>
      <article className="measure">
        <h1 className="text-xl font-semibold">About Bay Ballot</h1>
        <p className="mt-2 text-base">
          Bay Ballot puts every San Francisco voter guide&apos;s endorsements for the November 3, 2026 election side by side, one contest at a
          time.
        </p>

        <Section title="Counting">
          <List>
            <li>Only guides that took a position on a contest count toward it.</li>
            <li>A guide that ranks candidates counts toward its first choice.</li>
            <li>In races with more than one seat, each name a guide endorses counts.</li>
          </List>
        </Section>

        <Section title="Sources">
          <List>
            <li>
              Endorsements come from each guide&apos;s own published pages. They are collected automatically, then checked against those pages in
              a separate review pass.
            </li>
            <li>Quotes are verbatim and link to their source or an archived copy.</li>
            <li>Guides that publish only a list of endorsements show no quotes.</li>
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
    </div>
  );
}
