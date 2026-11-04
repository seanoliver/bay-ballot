import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";
import { CARD } from "@/components/frame";
import { LinkMaker, type LinkOption } from "@/components/LinkMaker";
import { PageColumn } from "@/components/PageColumn";
import { coverage } from "@/lib/coverage";
import { dataAsOf, formatDate } from "@/lib/display";
import { publishedGuides } from "@/lib/filters";
import { guideLinkSnippet, siteLinkSnippet } from "@/lib/link-snippet";
import { election, latestElection } from "@/lib/site-data";

export const metadata: Metadata = { title: "Press kit · Bay Ballot", alternates: { canonical: "/press" } };

const LINK = "underline underline-offset-2";
const H2 = "text-base font-semibold";

const SHOTS = [
  { file: "bay-ballot-contest-phone.png", alt: "A contest page on a phone, with the Your vote box", caption: "A contest, with Your vote (phone)", width: 1170, height: 2532 },
  { file: "bay-ballot-your-ballot-phone.png", alt: "The Your ballot list on a phone", caption: "Your ballot (phone)", width: 1170, height: 2532 },
  { file: "bay-ballot-sf-desktop.png", alt: "The San Francisco ballot on a desktop, with the Governor contest open beside the list", caption: "San Francisco ballot (desktop)", width: 2880, height: 1800 },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className={H2}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Download({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} download className={`${LINK} inline-flex min-h-10 items-center text-sm`}>
      {children}
    </a>
  );
}

export default function PressPage() {
  const d = election(latestElection())!;
  const c = coverage(d);
  const asOf = dataAsOf(d.endorsements);
  const date = formatDate(d.ballot.date);
  const year = d.ballot.date.slice(0, 4);
  const about = `Bay Ballot (bayballot.com) shows the endorsements of ${c.guides} Bay Area voter guides for the ${date} election side by side, contest by contest, with each guide's reasons quoted from its own pages. It makes no endorsements of its own and is not affiliated with any guide or campaign. Its code and data are public.`;
  const links: LinkOption[] = [
    { value: "", label: "The whole site", snippet: siteLinkSnippet() },
    ...[...publishedGuides(d.guides, d.endorsements)]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ value: g.id, label: g.name, snippet: guideLinkSnippet({ guideId: g.id, guideName: g.name }) })),
  ];
  const numbers = [
    { n: c.guides, label: c.guides === 1 ? "voter guide" : "voter guides" },
    { n: c.contests, label: c.contests === 1 ? "contest" : "contests" },
    { n: c.counties, label: c.counties === 1 ? "county" : "counties" },
  ];

  return (
    <PageColumn>
      <article className="measure">
        <h1 className="text-xl font-semibold">Press kit</h1>
        <p className="mt-2 text-base text-muted-foreground">
          For reporters, newsletter writers and anyone covering the {year} Bay Area election. Use anything here without asking.
        </p>

        <Section id="about-bay-ballot" title="About Bay Ballot">
          <div className={CARD}>
            <p id="about-paragraph" className="text-base">
              {about}
            </p>
            <CopyButton text={about} selectId="about-paragraph" failLabel="Select the paragraph above to copy" className="mt-4" />
          </div>
        </Section>

        <Section id="by-the-numbers" title="By the numbers">
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {numbers.map((x) => (
              <div key={x.label} className="flex flex-col-reverse rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
                <dt className="text-sm text-muted-foreground">{x.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{x.n}</dd>
              </div>
            ))}
          </dl>
          {asOf ? <p className="mt-2 text-sm text-muted-foreground">As of {asOf}.</p> : null}
        </Section>

        <Section id="screenshots" title="Screenshots">
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
            {SHOTS.map((s) => (
              <li key={s.file} className={s.width > s.height ? "col-span-2" : undefined}>
                <figure>
                  <Image
                    src={`/press/${s.file}`}
                    alt={s.alt}
                    width={s.width}
                    height={s.height}
                    sizes="(min-width: 768px) 768px, 100vw"
                    className="h-auto w-full rounded-lg ring-1 ring-foreground/10"
                  />
                  <figcaption className="mt-1.5 text-sm">
                    <span className="block text-muted-foreground">{s.caption}</span>
                    <Download href={`/press/${s.file}`}>Download PNG</Download>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Free to use with credit to Bay Ballot.</p>
        </Section>

        <Section id="logo" title="Logo">
          <div className={`${CARD} flex items-center gap-4`}>
            <Image src="/press/bay-ballot-logo.svg" alt="The Bay Ballot mark" width={64} height={64} unoptimized className="size-16 rounded-xl ring-1 ring-foreground/15" />
            <div className="flex flex-wrap gap-x-4">
              <Download href="/press/bay-ballot-logo.svg">Download SVG</Download>
              <Download href="/press/bay-ballot-logo.png">Download PNG (512px)</Download>
            </div>
          </div>
        </Section>

        <Section id="link-to-bay-ballot" title="Link to Bay Ballot">
          <div className={CARD}>
            <LinkMaker options={links} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Every area, contest and guide has its own address, which you can copy from the browser.</p>
        </Section>

        <Section id="contact" title="Contact">
          <p className="mt-2 text-base">
            Email{" "}
            <a href="mailto:corrections@bayballot.com" className={LINK}>
              corrections@bayballot.com
            </a>
          </p>
        </Section>
      </article>
    </PageColumn>
  );
}
