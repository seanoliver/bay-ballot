import { describe, expect, it } from "vitest";
import { verifyQuotes } from "@/pipeline/quotes";

const page = { url: "https://a.org/guide", text: "Prop B — We oppose it. “A public bank would cost the city hundreds of millions,” and the risks are real." };

describe("verifyQuotes", () => {
  it("keeps verbatim quotes ignoring curly quotes, dashes and whitespace", () => {
    expect(verifyQuotes(["A public bank would cost the city hundreds of millions"], [page]).kept)
      .toEqual([{ text: "A public bank would cost the city hundreds of millions", source: "https://a.org/guide" }]);
  });
  it("drops paraphrases", () => {
    const r = verifyQuotes(["A public bank costs hundreds of millions"], [page]);
    expect(r.kept).toEqual([]);
    expect(r.dropped).toEqual(["A public bank costs hundreds of millions"]);
  });
  it("drops fragments under 20 characters", () => {
    expect(verifyQuotes(["We oppose it."], [page]).kept).toEqual([]);
  });
  it("matches across a PDF line wrap", () => {
    const p = { url: "u", text: "A public bank would cost the city hundreds of\nmillions, and more." };
    expect(verifyQuotes(["A public bank would cost the city hundreds of millions"], [p]).kept).toHaveLength(1);
  });
  it("matches across merged inline words", () => {
    const p = { url: "u", text: "Sara BarzCo-founder of Mission Housing" };
    expect(verifyQuotes(["Sara Barz Co-founder of Mission Housing"], [p]).kept).toHaveLength(1);
  });
  it("matches ellipsis char vs three dots", () => {
    const p = { url: "u", text: "The measure is flawed… and costly for everyone involved." };
    expect(verifyQuotes(["The measure is flawed... and costly for everyone"], [p]).kept).toHaveLength(1);
  });
  it("matches non-breaking spaces", () => {
    const p = { url: "u", text: "The measure is flawed and costly for everyone." };
    expect(verifyQuotes(["The measure is flawed and costly"], [p]).kept).toHaveLength(1);
  });
  it("strips surrounding curly quotes on the quote", () => {
    const r = verifyQuotes(["“A public bank would cost the city hundreds of millions”"], [page]);
    expect(r.kept[0].text).toBe("A public bank would cost the city hundreds of millions");
  });
  it("uses the first page containing the quote as source", () => {
    const first = { url: "u1", text: "nothing relevant here at all" };
    const second = { url: "u2", text: "We oppose it because the risks are real and large." };
    expect(verifyQuotes(["the risks are real and large"], [first, second]).kept[0].source).toBe("u2");
  });
  it("deduplicates kept quotes", () => {
    const q = "A public bank would cost the city hundreds of millions";
    expect(verifyQuotes([q, q.toUpperCase(), `“${q}”`], [page]).kept).toHaveLength(1);
  });
  it("drops a quote that changes one word", () => {
    expect(verifyQuotes(["A public bank would cost the town hundreds of millions"], [page]).kept).toEqual([]);
  });
  it("drops everything with no pages", () => {
    const r = verifyQuotes(["A public bank would cost the city hundreds of millions"], []);
    expect(r.kept).toEqual([]);
    expect(r.dropped).toHaveLength(1);
  });
});
