import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, MapPin, Pin } from "lucide-react";
import { ExternalLink } from "@/components/ExternalLink";
import { PageColumn } from "@/components/PageColumn";
import { BAR_FILL } from "@/components/tone";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { areaBallotLinks, coverage, coverageSentence } from "@/lib/coverage";
import { formatDate } from "@/lib/display";
import { MAX_PINS } from "@/lib/filters";
import { election, latestElection } from "@/lib/site-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "About · Bay Ballot", alternates: { canonical: "/about" } };

const REPO = "https://github.com/seanoliver/bay-ballot";
const LINK = "underline underline-offset-2";

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function MiniChip({ name, pinned = false }: { name: string; pinned?: boolean }) {
  return (
    <span className={cn("inline-flex items-stretch rounded-full border bg-background text-xs", pinned ? "border-foreground" : "border-foreground/20 shadow-xs")}>
      <span className="inline-flex min-h-7 items-center pr-2 pl-2.5">{name}</span>
      <span className="my-1.5 w-px bg-foreground/20" />
      <span className={cn("inline-flex w-7 items-center justify-center rounded-r-full", pinned ? "bg-foreground text-background" : "text-muted-foreground")}>
        <Pin className={cn("size-3", pinned && "fill-current")} />
      </span>
    </span>
  );
}

const STEPS: { title: string; body: string; drawing: ReactNode }[] = [
  {
    title: "Pick your area or enter your ZIP",
    body: "Your area shows its contests. Add your ZIP to narrow them to the ones that can be on your ballot. Your ZIP stays on your device.",
    drawing: (
      <>
        <span className="inline-flex min-h-7 items-center rounded-full bg-foreground px-2.5 text-xs font-medium text-background">San Francisco</span>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs ring-1 ring-foreground/15">
          <MapPin className="size-3.5" />
          94110
        </span>
      </>
    ),
  },
  {
    title: "Open a contest",
    body: "See how the guides split, then read their reasons.",
    drawing: (
      <span className="flex w-40 flex-col gap-1">
        <span className="text-xs font-semibold text-yes">Yes 52%</span>
        <span className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
          <span className={cn("flex-[17]", BAR_FILL.yes)} />
          <span className={cn("flex-[16]", BAR_FILL.no)} />
        </span>
      </span>
    ),
  },
  {
    title: "Pin the guides you trust",
    body: `Tap the pin on up to ${MAX_PINS} guides. Their picks then show on every contest.`,
    drawing: (
      <>
        <MiniChip name="GrowSF" pinned />
        <MiniChip name="SPUR" />
      </>
    ),
  },
];

function Question({ q, children }: { q: string; children: ReactNode }) {
  return (
    <Collapsible className="border-t border-border">
      <h3>
        <CollapsibleTrigger className="group flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-md py-3 text-left text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {q}
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
      </h3>
      {/* keepMounted, not hiddenUntilFound: answers stay in the server HTML, and WebKit showed until-found panels while closed. */}
      <CollapsibleContent keepMounted>
        <div className="space-y-2 pb-4 text-base">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AboutPage() {
  const id = latestElection();
  const d = election(id)!;
  const areas = areaBallotLinks(d);
  return (
    <PageColumn>
      <article>
        <h1 className="text-xl font-semibold">About Bay Ballot</h1>
        <p className="measure mt-2 text-base text-muted-foreground">
          Every Bay Area voter guide for the {formatDate(d.ballot.date)} election, side by side, one contest at a time, with each guide&apos;s
          reasons in its own words. It doesn&apos;t tell you how to vote.
        </p>

        <section className="mt-8">
          <h2 id="how-to" className="text-base font-semibold">How to use it</h2>
          <ol aria-labelledby="how-to" className="mt-3 grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] content-start gap-x-3 gap-y-1 rounded-xl border border-border bg-card p-4">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                  {i + 1}
                </span>
                <span className="self-center font-semibold">{s.title}</span>
                <span className="col-start-2 text-sm text-muted-foreground">{s.body}</span>
                <span aria-hidden="true" className="col-start-2 mt-2 flex flex-wrap items-center gap-1.5">
                  {s.drawing}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href={`/${id}`}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-6 font-semibold text-background outline-none hover:bg-foreground/85 focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
          >
            Go to the ballot
          </Link>
        </section>

        <section className="measure mt-10">
          <h2 className="text-base font-semibold">Questions</h2>
          <div className="mt-2 border-b border-border">
            <Question q="Is my area covered?">
              <p>{coverageSentence(coverage(d))}</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {areas.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} prefetch={false} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm ring-1 ring-foreground/15 hover:bg-muted">
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Question>
            <Question q="How are guides counted?">
              <List>
                <li>Only guides that took a position on a contest count toward it.</li>
                <li>A guide that ranks candidates counts toward its first choice.</li>
                <li>In races with more than one seat, each name a guide endorses counts.</li>
                <li>An area&apos;s page counts only the guides that cover that area. The Bay Area list counts every guide.</li>
              </List>
            </Question>
            <Question q="How are guides chosen?">
              <p>
                For each area, I look for every voter guide that publishes endorsements: newspaper editorial boards, party committees, political
                clubs, labor councils, advocacy groups and civic groups. A guide&apos;s endorsements appear once it publishes them for this election.
              </p>
            </Question>
            <Question q="How do you check the quotes?">
              <p>
                For most guides, an automated process reads the guide&apos;s published pages and records its endorsements, along with short quotes
                giving its reasons. A separate check confirms each quote appears word for word on the guide&apos;s page. Quotes that fail are left out,
                and endorsements the check can&apos;t confirm stay off the site until they&apos;re confirmed. A few guides publish their endorsements
                as images or documents, and I enter those by hand. I monitor the whole process closely. Each quote links to its source or an archived
                copy. Guides that publish only a list of endorsements show no quotes.
              </p>
              <p>
                Guides are checked for updates every day, and the few that can&apos;t be checked automatically are checked by hand. Updates are listed
                on the{" "}
                <Link href="/changelog" className={LINK}>
                  changelog
                </Link>
                .
              </p>
            </Question>
            <Question q="Is it partisan?">
              <List>
                <li>Bay Ballot makes no endorsements of its own.</li>
                <li>It is not affiliated with any guide or campaign.</li>
              </List>
              <p>
                All of the code and data are{" "}
                <ExternalLink href={REPO} className={LINK}>
                  public on GitHub
                </ExternalLink>
                , so anyone can see exactly how it works.
              </p>
            </Question>
            <Question q="What do you track?">
              <List>
                <li>Bay Ballot counts page views with Vercel Web Analytics and Ahrefs Web Analytics, which also counts link clicks. Neither uses cookies.</li>
                <li>It never records addresses or ZIP codes. A ZIP code you enter stays on your device.</li>
              </List>
            </Question>
            <Question q="Something's wrong. How do I report it?">
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
            </Question>
            <Question q="Who made Bay Ballot?">
              <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
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
                    each guide gives in its own words. It starts with San Francisco, the Peninsula, the South Bay, the East Bay and the North Bay and will grow from there. It stays up to date as guides
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
            </Question>
          </div>
        </section>
      </article>
    </PageColumn>
  );
}
