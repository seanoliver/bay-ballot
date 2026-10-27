import { describe, expect, it } from "vitest";
import { names, quoteAbout, quoteIsFor, tagQuotes } from "@/lib/quote-about";
import type { Entry } from "@/lib/schema";

const board = ["Phil Kim", "Ryan Hazelton", "Alida Fisher"];
const src = "https://g.org/a";

describe("names", () => {
  it("matches a full name in any case, a surname alone as written or in capitals", () => {
    expect(names("alida fisher is right.", "Alida Fisher")).toBe(true);
    expect(names("Fisher’s correct.", "Alida Fisher")).toBe(true);
    expect(names("FISHER is correct.", "Alida Fisher")).toBe(true);
    expect(names("We had a picnic in the park.", "Kevin Park")).toBe(false);
  });
  it("matches an alias", () => {
    expect(names("Ali has done the work.", "Alida Fisher", ["Ali"])).toBe(true);
  });
});

describe("quoteAbout", () => {
  it("names the picks a quote is about when it names only some", () => {
    expect(quoteAbout("Fisher’s correct that achieving a balanced budget is a major milestone.", board)).toEqual(["Alida Fisher"]);
    expect(quoteAbout("Kim and Fisher bring experience.", board)).toEqual(["Phil Kim", "Alida Fisher"]);
  });
  it("matches a first name alone as written, including initials", () => {
    expect(quoteAbout("Phil is a former public school teacher.", board)).toEqual(["Phil Kim"]);
    expect(quoteAbout("JR and Seema have our votes.", ["J.R. Fruen", "John Tang", "Seema Sharma Lindskog"])).toEqual(["J.R. Fruen", "Seema Sharma Lindskog"]);
  });
  it("is undefined for a quote about the whole pick", () => {
    expect(quoteAbout("They have demonstrated integrity.", board)).toBeUndefined();
    expect(quoteAbout("Kim, Hazelton and Fisher will steady the board.", board)).toBeUndefined();
    expect(quoteAbout("Fisher is right.", ["Alida Fisher"])).toBeUndefined();
    expect(quoteAbout("Fisher is right.", "Y")).toBeUndefined();
  });
});

describe("quoteIsFor", () => {
  it("shows an untagged quote under every pick, a tagged one only under its names", () => {
    expect(quoteIsFor({}, "Ryan Hazelton")).toBe(true);
    expect(quoteIsFor({ about: ["Alida Fisher"] }, "Ryan Hazelton")).toBe(false);
    expect(quoteIsFor({ about: ["Alida Fisher"] }, "Alida Fisher")).toBe(true);
  });
});

describe("tagQuotes", () => {
  const entry = (quotes: Entry["quotes"], pick: Entry["pick"] = board): Entry => ({ pick, ranked: false, quotes });
  it("tags quotes that name some of a multi-name pick and leaves the rest alone", () => {
    const picks = { boe: entry([{ text: "Fisher is right.", source: src }, { text: "They will steady the board.", source: src }]), m: entry([{ text: "Fisher is right.", source: src }], "Y") };
    const out = tagQuotes(picks);
    expect(out.boe.quotes).toEqual([{ text: "Fisher is right.", source: src, about: ["Alida Fisher"] }, { text: "They will steady the board.", source: src }]);
    expect(out.m).toBe(picks.m);
  });
  it("keeps a published quote's about while those names are still picked", () => {
    const prev = { boe: entry([{ text: "They will steady the board.", source: src, about: ["Phil Kim"] }]) };
    expect(tagQuotes({ boe: entry([{ text: "They will steady the board.", source: src }]) }, { prev }).boe.quotes[0].about).toEqual(["Phil Kim"]);
    const dropped = { boe: entry([{ text: "They will steady the board.", source: src }], ["Ryan Hazelton", "Alida Fisher"]) };
    expect(tagQuotes(dropped, { prev }).boe.quotes[0].about).toBeUndefined();
  });
  it("keeps a published about when the quote comes back with different quote marks or spacing", () => {
    const prev = { boe: entry([{ text: "Fisher’s right, and   Kim agrees.", source: src, about: board }]) };
    expect(tagQuotes({ boe: entry([{ text: "Fisher's right, and Kim agrees.", source: src }]) }, { prev }).boe.quotes[0].about).toEqual(board);
  });
  it("never overwrites an about already on the quote", () => {
    const picks = { boe: entry([{ text: "Fisher is right.", source: src, about: board }]) };
    expect(tagQuotes(picks).boe.quotes[0].about).toEqual(board);
  });
  it("returns the same entry when nothing changes", () => {
    const picks = { boe: entry([{ text: "They will steady the board.", source: src }]) };
    expect(tagQuotes(picks).boe).toBe(picks.boe);
  });
});
