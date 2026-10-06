import { describe, expect, it } from "vitest";
import { isSubstantive, standsAlone, verifyQuotes, type Page } from "@/pipeline/quotes";
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
    expect(reasonOf("It is a bad idea.", [p])).toBe("too-short"); // 5 words but 13 chars
    expect(reasonOf("Supercalifragilistic expialidocious wonderfully.", [p])).toBe("too-short"); // 3 words
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
    expect(reasonOf("The bank would cost the city hundreds of millions.", [other])).toBe("attributed-speech"); // via previous-segment context
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

describe("standsAlone", () => {
  const juris = { level: "city" as const, name: "San Francisco" };
  const propD = { id: "prop-d", section: "S", title: "Proposition D", kind: "measure", candidates: [], seats: 1, rankedChoice: false, jurisdiction: juris } as Contest;
  const rtm = { ...propD, id: "rtm", title: "Regional Measure RTM" } as Contest;
  const boe = { ...propD, id: "board-of-education", title: "Board of Education", kind: "candidate", seats: 3, candidates: ["Ryan Hazelton", "Reina Tello", "Virginia Cheung"] } as Contest;
  const bart = { ...propD, id: "bart-8", title: "BART Board, District 8", kind: "candidate", candidates: ["Sara Barz"] } as Contest;

  it.each([
    ["This is a common-sense reform measure.", propD],
    ["He would be a good addition to the school board.", boe],
    ["It also gives you someone to hold responsible.", propD],
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

  it("lets he/she/his/her stand for the only endorsed candidate", () => {
    const q = "She supports building more housing near BART stations for riders.";
    expect(standsAlone(q, bart, { names: ["Sara Barz"] })).toBe(true);
    expect(standsAlone("He would be a good addition to the school board.", boe, { names: ["Ryan Hazelton", "Reina Tello"] })).toBe(false);
    expect(standsAlone("They say the bond is costly and wasteful.", bart, { names: ["Sara Barz"] })).toBe(false);
    expect(standsAlone("It is a costly stunt we cannot afford.", propD, { names: [] })).toBe(false);
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
