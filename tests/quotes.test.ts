import { describe, expect, it } from "vitest";
import { isSubstantive, sentencesOf, standaloneProblem, standsAlone, verifyQuotes, type Page } from "@/pipeline/quotes";
import type { Contest } from "@/lib/schema";
import { htmlToText } from "@/pipeline/fetch";

const html = (text: string, url = "https://a.org/guide"): Page => ({ url, text, kind: "html" });
const pdf = (text: string, url = "https://a.org/guide.pdf"): Page => ({ url, text, kind: "pdf" });
const Q = "A public bank would cost the city hundreds of millions";
const page = html(`Prop B — We oppose it. ${Q}. The risks are real.`);
const reasonOf = (q: string, pages: Page[]) => verifyQuotes([q], pages).dropped[0]?.reason;

describe("verifyQuotes basics", () => {
  it("keeps verbatim quotes ignoring curly quotes, dashes and whitespace", () => {
    expect(verifyQuotes([Q], [page]).kept).toEqual([{ text: Q, source: "https://a.org/guide" }]);
  });
  it("drops paraphrases as not-found", () => {
    const r = verifyQuotes(["A public bank costs hundreds of millions"], [page]);
    expect(r.kept).toEqual([]);
    expect(r.dropped).toEqual([{ quote: "A public bank costs hundreds of millions", reason: "not-found" }]);
  });
  it("drops fragments as too-short", () => {
    expect(verifyQuotes(["We oppose it."], [page]).dropped[0].reason).toBe("too-short");
  });
  it("requires at least 5 words and 20 non-space chars", () => {
    const p = html("It is a bad idea. Supercalifragilistic expialidocious wonderfully.");
    expect(reasonOf("It is a bad idea.", [p])).toBe("too-short");
    expect(reasonOf("Supercalifragilistic expialidocious wonderfully.", [p])).toBe("too-short");
  });
  it("matches across merged inline words", () => {
    const p = html("Sara BarzCo-founder of Mission Housing");
    expect(verifyQuotes(["Sara Barz Co-founder of Mission Housing"], [p]).kept).toHaveLength(1);
  });
  it("matches ellipsis char vs three dots", () => {
    const p = html("The measure is flawed… and costly for everyone involved.");
    expect(verifyQuotes(["The measure is flawed... and costly for everyone involved."], [p]).kept).toHaveLength(1);
  });
  it("strips surrounding curly quotes on the quote", () => {
    expect(verifyQuotes([`“${Q}”`], [page]).kept[0].text).toBe(Q);
  });
  it("uses the first page containing the quote as source", () => {
    const first = html("nothing relevant here at all");
    const second = html("We oppose it. The risks are real and large for everyone.", "u2");
    expect(verifyQuotes(["The risks are real and large for everyone."], [first, second]).kept[0].source).toBe("u2");
  });
  it("deduplicates kept quotes", () => {
    expect(verifyQuotes([Q, Q.toUpperCase(), `“${Q}”`], [page]).kept).toHaveLength(1);
  });
  it("drops a quote that changes one word", () => {
    expect(reasonOf(Q.replace("city", "town"), [page])).toBe("not-found");
  });
  it("drops everything with no pages", () => {
    expect(verifyQuotes([Q], []).dropped).toEqual([{ quote: Q, reason: "not-found" }]);
  });
});

describe("segments", () => {
  const prop = html("We recommend a yes vote on Prop A.\nProp B: Public Bank\nWe oppose the creation of a public bank.");
  it("drops html quotes spanning a blurb and the next heading", () => {
    expect(reasonOf("a yes vote on Prop A. Prop B: Public Bank", [prop])).toBe("crosses-boundary");
  });
  it("drops html quotes spanning a heading and its body", () => {
    expect(reasonOf("Prop B: Public Bank We oppose the creation of a public bank.", [prop])).toBe("crosses-boundary");
  });
  it("keeps pdf quotes across a line wrap", () => {
    const p = pdf("Overall, the bank would cost the city hundreds of\nmillions of dollars.");
    expect(verifyQuotes(["Overall, the bank would cost the city hundreds of millions of dollars."], [p]).kept).toHaveLength(1);
  });
  it("publishes a wrapped pdf quote with single spaces", () => {
    const p = pdf("Overall, the bank would cost the city hundreds of\nmillions of dollars.");
    expect(verifyQuotes(["Overall, the bank would cost the city hundreds of millions of dollars."], [p]).kept[0].text)
      .toBe("Overall, the bank would cost the city hundreds of millions of dollars.");
  });
  it("drops pdf quotes across a paragraph break", () => {
    const p = pdf("The bank is a risky proposal for the city.\n\nWe urge a no vote on this measure.");
    expect(reasonOf("The bank is a risky proposal for the city. We urge a no vote on this measure.", [p])).toBe("crosses-boundary");
  });
  it("drops pdf quotes across a form feed", () => {
    const p = pdf("The bank is a risky proposal for the city.\fWe urge a no vote on this measure.");
    expect(reasonOf("The bank is a risky proposal for the city. We urge a no vote on this measure.", [p])).toBe("crosses-boundary");
  });
  it("joins hyphenated pdf wraps", () => {
    const p = pdf("Overall, a public bank would cost the city hun-\ndreds of millions of dollars.");
    const r = verifyQuotes(["Overall, a public bank would cost the city hundreds of millions of dollars."], [p]);
    expect(r.kept).toHaveLength(1);
  });
});

describe("publishes the page's text", () => {
  it("returns the page's original wording, not the quote's", () => {
    const p = html("We oppose it. The Bank Would Cost—Hundreds of Millions Of Dollars.");
    const r = verifyQuotes(["the bank would cost - hundreds of millions of dollars."], [p]);
    expect(r.kept[0].text).toBe("The Bank Would Cost—Hundreds of Millions Of Dollars.");
  });
  it("a fake-boundary quote yields the page's real wording", () => {
    const p = html("Residents panic buttons are widely installed in the city.");
    const r = verifyQuotes(["Residents pa nic but tons are widely installed in the city."], [p]);
    expect(r.kept[0].text).toBe("Residents panic buttons are widely installed in the city.");
  });
});

describe("other people's words", () => {
  it("drops spans enclosed in curly quotes", () => {
    const p = html(`Foes call it reckless. “${Q},” they warned.`);
    expect(reasonOf(Q, [p])).toBe("attributed-speech");
  });
  it("drops spans enclosed in straight quotes", () => {
    const p = html(`Foes call it reckless. "${Q}," they warned.`);
    expect(reasonOf(Q, [p])).toBe("attributed-speech");
  });
  it.each(["Opponents", "Critics", "Proponents say", "According to staff", "They claim"])(
    "drops after attribution phrase %s",
    (phrase) => {
      const p = html(`${phrase}. The bank would cost the city hundreds of millions.`);
      expect(reasonOf("The bank would cost the city hundreds of millions.", [p])).toBe("attributed-speech");
    },
  );
  it("ignores same-segment attribution beyond 80 chars", () => {
    const far = html(`Critics disagree.${" x".repeat(50)}. The bank would cost the city hundreds of millions.`);
    expect(verifyQuotes(["The bank would cost the city hundreds of millions."], [far]).kept).toHaveLength(1);
    const other = html("Critics disagree.\nThe bank would cost the city hundreds of millions.");
    expect(reasonOf("The bank would cost the city hundreds of millions.", [other])).toBe("attributed-speech");
  });
});

describe("sentence boundaries", () => {
  const p = html("Some argue a public bank is a good idea, but it would cost billions.");
  it("drops cut-short fragments", () => {
    expect(reasonOf("a public bank is a good idea", [p])).toBe("partial-sentence");
  });
  it("keeps a full sentence", () => {
    expect(verifyQuotes(["Some argue a public bank is a good idea, but it would cost billions."], [p]).kept).toHaveLength(1);
  });
  it("drops a long sentence-start fragment that stops mid-sentence", () => {
    const p = html("A public bank is a great idea for San Francisco in the long run, but the costs today are too high.");
    expect(reasonOf("A public bank is a great idea for San Francisco in the long run", [p])).toBe("partial-sentence");
  });
  it("drops a long fragment cut before a trailing clause", () => {
    const p = html("The bank would cost the city hundreds of millions of dollars unless the state helps.");
    expect(reasonOf("The bank would cost the city hundreds of millions of dollars", [p])).toBe("partial-sentence");
  });
  it("drops a sentence-start fragment under 8 words that stops mid-sentence", () => {
    expect(reasonOf("The bank would cost the city", [html("The bank would cost the city hundreds of millions.")])).toBe("partial-sentence");
  });
  it("accepts a start after a colon or a closing quote after punctuation", () => {
    expect(verifyQuotes(["The bank would cost the city millions."], [html("Our view: The bank would cost the city millions.")]).kept).toHaveLength(1);
  });
  it("accepts a start after a closing quote that follows punctuation", () => {
    const p = html("The mayor called it \u201cunwise.\u201d The bank would cost the city millions.");
    expect(verifyQuotes(["The bank would cost the city millions."], [p]).kept).toHaveLength(1);
  });
  it("accepts a sentence end followed by a closing quote or paren", () => {
    const p = html("We oppose this measure (The bank would cost the city millions.) Next.");
    expect(verifyQuotes(["The bank would cost the city millions"], [p]).kept).toHaveLength(0);
    const q = html("We oppose this. The bank would cost the city millions.\u201d");
    expect(verifyQuotes(["The bank would cost the city millions"], [q]).kept).toHaveLength(1);
  });
});

describe("surrounding context", () => {
  it("drops a blockquote introduced by an attribution in the previous segment", () => {
    const text = htmlToText("<p>Opponents argue:</p><blockquote>The bond will raise your taxes for thirty years.</blockquote>");
    expect(reasonOf("The bond will raise your taxes for thirty years.", [html(text)])).toBe("attributed-speech");
  });
  it("drops text after a previous segment ending in a colon", () => {
    const p = html("Here is what the other side says:\nThe bond will raise your taxes for thirty years.");
    expect(reasonOf("The bond will raise your taxes for thirty years.", [p])).toBe("attributed-speech");
  });
  it("drops text after a previous pdf paragraph with an attribution phrase", () => {
    const p = pdf("According to the Chamber of Commerce\n\nThe bond will raise your taxes for thirty years.");
    expect(reasonOf("The bond will raise your taxes for thirty years.", [p])).toBe("attributed-speech");
  });
  it("keeps text after an unrelated previous segment", () => {
    const p = html("Prop C: Housing Bond\nThe bond will raise your taxes for thirty years.");
    expect(verifyQuotes(["The bond will raise your taxes for thirty years."], [p]).kept).toHaveLength(1);
  });
  it("drops a full sentence attributed afterwards", () => {
    const p = html("\"The bond will raise your taxes.\" said the Chamber.");
    expect(reasonOf("The bond will raise your taxes.", [p])).toBe("attributed-speech");
  });
  it("drops a sentence followed by a trailing attribution", () => {
    const p = html("The bond will raise your taxes for thirty years, the Chamber of Commerce says.");
    expect(reasonOf("The bond will raise your taxes for thirty years", [p])).toBe("attributed-speech");
  });
});

describe("own-voice sentences next to attribution", () => {
  const S = "We support Prop 45 because it speeds up housing approvals.";
  it("does not carry an attribution phrase across a sentence boundary", () => {
    const p = html(`Opponents say it's costly. ${S}`);
    expect(verifyQuotes([S], [p]).kept).toHaveLength(1);
  });
  it("still drops a sentence in the same sentence as the phrase", () => {
    const p = html("Opponents say that the bank would cost the city hundreds of millions.");
    expect(reasonOf("the bank would cost the city hundreds of millions.", [p])).toBe("attributed-speech");
  });
  it("keeps text after a first-person-plural colon intro", () => {
    const p = html(`From our writeup in June:\n${S}`);
    expect(verifyQuotes([S], [p]).kept).toHaveLength(1);
  });
  it.each(["Opponents argue:", "The Chamber writes:"])("still drops text after '%s'", (intro) => {
    const p = html(`${intro}\n${S}`);
    expect(reasonOf(S, [p])).toBe("attributed-speech");
  });
});

describe("sentences following an attributed sentence", () => {
  it("drops a continuation of the opponents' argument", () => {
    const q = "It will raise property taxes on every homeowner.";
    expect(reasonOf(q, [html(`Opponents say the bond is costly. ${q}`)])).toBe("attributed-speech");
  });
  it("drops a continuation after 'According to the Chamber'", () => {
    const q = "It will drive restaurants out of the city.";
    const p = html(`According to the Chamber, the tax hurts small business. ${q}`);
    expect(reasonOf(q, [p])).toBe("attributed-speech");
  });
  it("keeps a first-person-plural reply", () => {
    const q = "We think it is a smart investment in housing.";
    expect(verifyQuotes([q], [html(`Critics say the bond is costly. ${q}`)]).kept).toHaveLength(1);
  });
  it("keeps a reply that names the guide", () => {
    const q = "SPUR believes it is a smart investment in housing.";
    const p = html(`Critics say the bond is costly. ${q}`);
    expect(reasonOf(q, [p])).toBe("attributed-speech");
    expect(verifyQuotes([q], [p], { ownNames: ["SPUR"] }).kept).toHaveLength(1);
  });
});

describe("colon intros and abbreviations", () => {
  const S = "This tax will drive businesses out of San Francisco.";
  it("treats a colon intro as the guide only when it opens in the first person", () => {
    expect(verifyQuotes([S], [html(`We wrote in June:\n${S}`)]).kept).toHaveLength(1);
    expect(verifyQuotes([S], [html(`From our writeup in June:\n${S}`)]).kept).toHaveLength(1);
    expect(reasonOf(S, [html(`The Mayor told us:\n${S}`)])).toBe("attributed-speech");
  });
  it("does not split sentences at abbreviations", () => {
    const p = html("Critics say the U.S. rules are fine and this measure is redundant overreach.");
    expect(reasonOf("S. rules are fine and this measure is redundant overreach.", [p])).toBe("attributed-speech");
    const q = "It will raise property taxes on every homeowner.";
    expect(reasonOf(q, [html(`Opponents cite Prop. 13 and say Mr. Smith agrees. ${q}`)])).toBe("attributed-speech");
    const own = "We think Prop. 45 is a smart investment in housing.";
    expect(verifyQuotes([own], [html(`Some say e.g. delays are fine. ${own}`)]).kept).toHaveLength(1);
  });
});

describe("own names and speech verbs", () => {
  const critic = "Critics say the bond is costly.";
  it("matches own names on word boundaries", () => {
    const q = "It spurred a smart investment in new housing.";
    expect(reasonOf(q, [html(`${critic} ${q}`)])).toBe("attributed-speech");
    expect(verifyQuotes([q], [html(`${critic} ${q}`)], { ownNames: ["SPUR"] }).kept).toHaveLength(0);
    const own = "The SF Dems' view is that it is a smart investment.";
    expect(verifyQuotes([own], [html(`${critic} ${own}`)], { ownNames: ["SF Dems"] }).kept).toHaveLength(1);
    const spur = "Overall, SPUR supports this smart investment in housing.";
    expect(verifyQuotes([spur], [html(`${critic} ${spur}`)], { ownNames: ["spur"] }).kept).toHaveLength(1);
  });
  it("treats a previous sentence with a speech verb as attribution", () => {
    const q = "Rent control will destroy the housing supply in the city.";
    expect(reasonOf(q, [html(`The No on B campaign says. ${q}`)])).toBe("attributed-speech");
    const own = "We still support Prop C for these reasons.";
    expect(verifyQuotes([own], [html(`We said this in June. ${own}`)]).kept).toHaveLength(1);
  });
});

describe("own voice means a first-person opening", () => {
  it("drops a continuation that merely mentions us or our", () => {
    const a = "It will cost our small businesses millions of dollars.";
    expect(reasonOf(a, [html(`Opponents say the tax is unfair. ${a}`)])).toBe("attributed-speech");
    const b = "It will push all of us out of the city.";
    expect(reasonOf(b, [html(`The Chamber warned the tax is unfair. ${b}`)])).toBe("attributed-speech");
  });
  it("keeps a reply that opens in the first person", () => {
    const q = "We still support Prop C because it builds housing.";
    expect(verifyQuotes([q], [html(`Critics say the bond is costly. ${q}`)]).kept).toHaveLength(1);
  });
  it("treats a first-person colon intro with a speech verb as attribution", () => {
    const S = "This tax will drive small businesses out of San Francisco.";
    expect(reasonOf(S, [html(`Our opponent, Supervisor Chan, writes:\n${S}`)])).toBe("attributed-speech");
    expect(verifyQuotes([S], [html(`From our writeup in June:\n${S}`)]).kept).toHaveLength(1);
  });
  it("drops a quote that itself reports speech unless it opens in the first person", () => {
    const they = "They argue that the bond is a giveaway to developers.";
    expect(reasonOf(they, [html(`Prop A — Housing\n${they}`)])).toBe("attributed-speech");
    const we = "We argue that the bond is sound and worth the cost.";
    expect(verifyQuotes([we], [html(`Prop A — Housing\n${we}`)]).kept).toHaveLength(1);
  });
});

describe("isSubstantive", () => {
  it.each([
    "We are proud to endorse Connie Chan for Congress!",
    "We are thrilled to endorse Supervisor Connie Chan for Congress -again!",
    "Please vote Yes on Prop B!",
    "Yes on Prop H, Stronger Muni for All!",
    "We endorse Connie Chan for Congress.",
    "Vote Sara Barz for BART Board, District 8.",
    "Connie Chan for Congress!",
    "Thank you to everyone who came to our endorsement meeting.",
  ])("drops announcement %s", (q) => expect(isSubstantive(q)).toBe(false));

  it.each([
    "For affordable housing to be built, we need our own bank.",
    "We endorse Prop C because it funds affordable housing without new taxes.",
    "We support Prop H, which keeps Muni running at night.",
    "Vote yes on Prop H to save Muni service across the city.",
    "We are proud to endorse Connie Chan, who has fought for tenants for a decade.",
    "Sunset Dunes park is already one of the most visited parks on the west coast.",
    "Voters approved the park in 2024 and it has been a success.",
    "We support the commitments he made in his SF YIMBY questionnaire: six-story single-stair buildings, more homes near transit, objective by-right approvals and project shot clocks.",
    "We support Prop A as a basic good governance reform measure.",
    "Vote Yes on C for more affordable housing (eventually)!",
  ])("keeps reasoning %s", (q) => expect(isSubstantive(q)).toBe(true));

  it("drops announcements in verifyQuotes with reason not-substantive", () => {
    const q = "We are proud to endorse Connie Chan for Congress!";
    expect(verifyQuotes([q], [html(`Congress\n${q}`)]).dropped).toEqual([{ quote: q, reason: "not-substantive" }]);
  });
});

describe("two-sentence quotes", () => {
  const first = "If we don’t approve this critical funding measure, everyday people will face longer, more expensive commutes.";
  const second = "Transit services across the Bay Area will be slashed by up to 70%, leading to closed stations.";
  const p = html(`Measure RTM\nWe recommend you vote Yes. ${first} ${second} Vote yes!`);

  it("keeps two consecutive sentences copied verbatim as one quote", () => {
    expect(verifyQuotes([`${first} ${second}`], [p]).kept).toEqual([{ text: `${first} ${second}`, source: "https://a.org/guide" }]);
  });
  it("drops two sentences that are not consecutive on the page", () => {
    expect(reasonOf(`We recommend you vote Yes. ${second}`, [p])).toBe("not-found");
  });
  it("drops a pair that starts mid-sentence", () => {
    expect(reasonOf(`everyday people will face longer, more expensive commutes. ${second}`, [p])).toBe("partial-sentence");
  });
  it("still drops reported speech", () => {
    const q = "They say the bond is costly and wasteful for taxpayers.";
    expect(standsAlone(q, { id: "bart-8", kind: "candidate", candidates: ["Sara Barz"] } as Contest, { names: ["Sara Barz"] })).toBe(true);
    expect(reasonOf(q, [html(`BART\n${q}`)])).toBe("attributed-speech");
  });
});

describe("standsAlone", () => {
  const juris = { level: "city" as const, name: "San Francisco" };
  const propD = { id: "prop-d", section: "S", title: "Proposition D", kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: juris } as Contest;
  const rtm = { ...propD, id: "rtm", title: "Regional Measure RTM" } as Contest;
  const boe = { ...propD, id: "board-of-education", title: "Board of Education", kind: "candidate", seats: 3, candidates: ["Ryan Hazelton", "Reina Tello", "Virginia Cheung"] } as Contest;
  const bart = { ...propD, id: "bart-8", title: "BART Board, District 8", kind: "candidate", candidates: ["Sara Barz"] } as Contest;

  it.each([
    ["This is a common-sense reform measure.", propD],
    ["He would be a good addition to the school board.", boe],
    ["It also gives you someone to hold responsible.", boe],
    ["This will only make it worse.", propD],
    ["This would increase congestion, make it more expensive for people to get to work, and hurt our economy.", rtm],
    ["Their plan leaves the district without a voice on the board.", boe],
    ["such a reform is overdue in this city and long promised.", propD],
  ] as const)("drops %s", (q, c) => expect(standsAlone(q, c)).toBe(false));

  it.each([
    ["This measure is critical to saving Bay Area public transit for the whole region.", rtm],
    ["This proposition fixes a broken ballot process that lets anyone place measures.", propD],
    ["These measures are designed to sabotage the billionaire tax.", propD],
    ["It is why Prop D matters: fewer frivolous measures on the ballot.", propD],
    ["He has run Hazelton's own nonprofit budget for a decade.", boe],
    ["Sunset Dunes park is already one of the most visited parks on the west coast.", propD],
    ["Barz has spent her career on exactly that.", bart],
    ["This city’s ballots are choked with unnecessary ballot measures, many of which are imposed as bargaining chips.", propD],
    ["This state's budget cannot absorb another unfunded mandate.", propD],
    ["These elections are too important to leave to a handful of donors.", propD],
  ] as const)("keeps %s", (q, c) => expect(standsAlone(q, c)).toBe(true));

  it("still drops a bare 'This is …' or 'This will …'", () => {
    expect(standsAlone("This is a common-sense measure.", propD)).toBe(false);
    expect(standsAlone("This will only make it worse.", propD)).toBe(false);
    expect(standsAlone("This cityscape is changing fast for everyone.", propD)).toBe(false);
  });

  it("lets he/she/they stand for the only endorsed candidate", () => {
    const q = "She supports building more housing near BART stations for riders.";
    expect(standsAlone(q, bart, { names: ["Sara Barz"] })).toBe(true);
    expect(standsAlone("They have spent a decade fixing the agency's budget.", bart, { names: ["Sara Barz"] })).toBe(true);
    expect(standsAlone("He would be a good addition to the school board.", boe, { names: ["Ryan Hazelton", "Reina Tello"] })).toBe(false);
  });

  it("needs a multi-name pick's he/she quote to name one of the endorsed candidates, not another candidate", () => {
    const names = ["Ryan Hazelton", "Reina Tello"];
    expect(standsAlone("He backs Hazelton's plan to reopen the shuttered schools.", boe, { names })).toBe(true);
    expect(standaloneProblem("She has worked alongside Cheung on the budget for years.", boe, { names })).toBe(
      "pronoun names none of the endorsed candidates",
    );
    expect(standsAlone("They bring fresh energy and deep roots in the neighborhood schools.", boe, { names })).toBe(true);
    expect(standsAlone("Their plan would reopen two shuttered campuses next fall.", boe, { names })).toBe(true);
  });

  it('lets "it" mean the measure under its own pick, but not a candidate race', () => {
    expect(standsAlone("It is a costly stunt we cannot afford.", propD, { names: [] })).toBe(true);
    expect(standsAlone("If passed, it would expand the program to every district.", propD)).toBe(true);
    expect(standsAlone("It is the experience the board has been missing.", boe)).toBe(false);
  });

  it.each([
    ["But the need for more housing is too desperate to wait.", "But"],
    ["However, the charter amendment does not reflect good governance.", "However"],
    ["And by just raising revenue, it ignores the real cause of the deficit.", "And"],
    ["Moreover, the plan does nothing for public transit riders.", "Moreover"],
    ["Further, the plan does nothing for public transit riders.", "Further"],
    ["Furthermore we appreciate her support for transit priority on buses.", "Furthermore"],
    ["Instead, the measure streamlines destructive sprawl developments.", "Instead"],
    ["Speaking of housing, the measure would block new homes near transit.", "Speaking of"],
    ["Resulting cuts to Muni would worsen the city's congestion and gridlock.", "Resulting"],
    ...[
      "Additionally", "Finally", "Still", "Yet", "So", "Plus", "Meanwhile", "Likewise", "Similarly", "Thus", "Therefore",
      "In addition", "As a result", "On the other hand", "Nevertheless", "Nonetheless", "Lastly", "Second", "Secondly",
      "Third", "Thirdly", "Besides",
    ].map(
      (w) => [`${w}, the plan does nothing for public transit riders.`, w],
    ),
  ])("drops a quote opening with a connector: %s", (q, word) => {
    expect(standaloneProblem(q, propD)).toBe(`opens with "${word}"`);
  });

  it("drops \"That leaves us\" and a parenthetical however set against the prior sentence", () => {
    expect(standsAlone("That leaves us with only one choice for the council seat.", boe)).toBe(false);
    expect(standaloneProblem("The measure, however, would leave the city with no reserve.", propD)).toBe(
      'sets "however" against an earlier sentence',
    );
    expect(standsAlone("That is not enough to fix the deficit, however.", propD)).toBe(false);
  });

  it("keeps a however that joins two clauses or means 'no matter how'", () => {
    expect(standsAlone("The measure raises fees; however, it caps them for small businesses.", propD)).toBe(true);
    expect(standsAlone("However long the audit takes, Prop D keeps the reserve intact.", propD)).toBe(true);
    expect(standsAlone("Prop D protects the reserve however much the budget shrinks.", propD)).toBe(true);
  });

  it.each([
    "Overall, Prop D is the most responsible path for the city budget.",
    "In short, the measure fixes a broken process at no cost to taxpayers.",
    "Ultimately, the measure protects renters from sudden displacement.",
    "Instead of raising taxes, the measure trims the administrative budget.",
    "Also on the ballot, Prop D would add needed oversight to city contracts.",
    "So far, the city has spent nothing on the promised repairs under Prop D.",
    "So-called reform measures like Prop D rarely deliver what they promise.",
    "Thus far, the city has spent nothing on the promised repairs under Prop D.",
    "In addition to cutting fees, Prop D caps what the city can charge renters.",
    "This November, voters can finally fix the ballot process with Prop D.",
    "This fall, Prop D gives voters a chance to fix the ballot process.",
  ])("keeps summary openers, 'Instead of' and 'Also': %s", (q) => expect(standsAlone(q, propD)).toBe(true));

  it("allows this office/race for a candidate contest and this funding only for a measure", () => {
    expect(standsAlone("This office needs someone who reads the budget line by line.", boe)).toBe(true);
    expect(standsAlone("This race will decide who runs the schools for four years.", boe)).toBe(true);
    expect(standsAlone("Without this funding, Muni will cut a third of its routes.", rtm)).toBe(true);
    expect(standsAlone("This funding would keep BART trains running every ten minutes.", rtm)).toBe(true);
    expect(standsAlone("This funding is what the district has been missing.", boe)).toBe(false);
    expect(standsAlone("This diversion would reduce General Fund revenue for core services.", propD)).toBe(false);
  });

  it("judges a two-sentence quote as a unit: the first sentence must stand alone", () => {
    const pair =
      "If we don’t approve this critical funding measure, everyday people will face longer commutes. Transit services across the Bay Area will be slashed by up to 70%.";
    expect(standsAlone(pair, rtm)).toBe(true);
    expect(standsAlone("This will only make it worse. The deficit grows every year it stays.", propD)).toBe(false);
    expect(standsAlone("Prop D fixes the ballot. But it costs too much to run every year.", propD)).toBe(true);
  });

  it("drops a quote of more than two sentences", () => {
    expect(standaloneProblem("Prop D fixes the ballot. It costs little. It passed before.", propD)).toBe("more than 2 sentences");
  });
});

describe("sentencesOf", () => {
  it("splits on sentence ends but not on abbreviations or initials", () => {
    expect(sentencesOf("Housing Dept. and Planning Dept. are both understaffed.")).toHaveLength(1);
    expect(sentencesOf("Richard J. Barrera has a plan for the U.S. Dept. of Education. It is good.")).toHaveLength(2);
    expect(sentencesOf("Vote by Nov. 3 to keep Prop. 50 alive! Then tell a friend.")).toHaveLength(2);
    expect(sentencesOf("Asm. Wicks supported the bill from the start.")).toHaveLength(1);
    expect(sentencesOf("Polls close at 8 p.m. on Election Day across the county.")).toHaveLength(1);
    expect(sentencesOf("polls close at 8 p.m. on Tuesday")).toHaveLength(1);
    expect(sentencesOf("Polls close at 8 p.m. Tuesday in every county.")).toHaveLength(1);
    expect(sentencesOf("We say vote no on Props. 41 and 42 this fall.")).toHaveLength(1);
    expect(sentencesOf("The case, Smith v. Jones, set the rule. Etc. Ste. 200 is the office.")).toHaveLength(2);
  });
  it("ends a sentence after a measure letter", () => {
    expect(sentencesOf("We support Measure A. It will fix roads.")).toHaveLength(2);
    expect(sentencesOf("We oppose Prop B. It costs too much.")).toHaveLength(2);
  });
});

describe("CJK quotes", () => {
  const zhSentence = "公共银行将为城市节省数百万美元的利息费用。";
  const zh = html(`B提案\n我们支持B提案。${zhSentence}请投赞成票！`, "https://a.org/zh");

  it("keeps a full Chinese sentence from the page", () => {
    expect(verifyQuotes([zhSentence], [zh]).kept).toEqual([{ text: zhSentence, source: "https://a.org/zh" }]);
  });
  it("keeps a Chinese sentence ending in a full-width exclamation mark", () => {
    const p = html("我们支持B提案。这项措施将帮助每一个社区的家庭！");
    expect(verifyQuotes(["这项措施将帮助每一个社区的家庭！"], [p]).kept).toHaveLength(1);
  });
  it("drops a 6-character fragment as too-short", () => {
    expect(reasonOf("公共银行将为", [zh])).toBe("too-short");
  });
  it("drops a complete sentence under 10 CJK characters as too-short", () => {
    expect(reasonOf("我们支持B提案。", [zh])).toBe("too-short");
  });
  it("drops a CJK partial sentence", () => {
    expect(reasonOf("公共银行将为城市节省数百万美元", [zh])).toBe("partial-sentence");
  });
  it("counts Japanese and Korean by characters too", () => {
    const ja = html("私たちは賛成です。この法案は市の財政を大きく改善します。");
    expect(verifyQuotes(["この法案は市の財政を大きく改善します。"], [ja]).kept).toHaveLength(1);
    const ko = html("우리는 찬성합니다. 이 법안은 도시 재정을 크게 개선합니다.");
    expect(verifyQuotes(["이 법안은 도시 재정을 크게 개선합니다."], [ko]).kept).toHaveLength(1);
  });
});
