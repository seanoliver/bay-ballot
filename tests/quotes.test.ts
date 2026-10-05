import { describe, expect, it } from "vitest";
import { verifyQuotes, type Page } from "@/pipeline/quotes";
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
