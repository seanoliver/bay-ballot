import { describe, expect, it } from "vitest";
import { matchName } from "@/lib/names";

const cands = ["Joaquín Torres", "Shirley N. Weber", "Malia M. Cohen"];

describe("matchName", () => {
  it("exact match", () => expect(matchName("Joaquín Torres", cands)).toEqual({ name: "Joaquín Torres", fuzzy: false }));
  it("accent-insensitive match is flagged", () => expect(matchName("Joaquin Torres", cands)).toEqual({ name: "Joaquín Torres", fuzzy: true }));
  it("middle initial dropped is flagged", () => expect(matchName("Shirley Weber", cands)).toEqual({ name: "Shirley N. Weber", fuzzy: true }));
  it("unknown name returns null", () => expect(matchName("Jane Doe", cands)).toBeNull());

  it("initials-only first names match exactly", () =>
    expect(matchName("J.R. Eppler", ["J.R. Eppler"])).toEqual({ name: "J.R. Eppler", fuzzy: false }));
  it("JR Eppler vs J.R. Eppler is a flagged match", () =>
    expect(matchName("JR Eppler", ["J.R. Eppler"])).toEqual({ name: "J.R. Eppler", fuzzy: true }));
  it("different initials do not collide", () => {
    expect(matchName("A. Smith", ["B. Smith"])).toBeNull();
    expect(matchName("A. Smith", ["B. Smith", "A. Smith"])).toEqual({ name: "A. Smith", fuzzy: false });
  });
  it("ambiguous fuzzy match returns null", () =>
    expect(matchName("Shirley Weber", ["Shirley N. Weber", "Shirley M. Weber"])).toBeNull());

  describe("token-based regressions", () => {
    const f = (name: string) => ({ name, fuzzy: true });
    it("conflicting middle initial returns null", () =>
      expect(matchName("Shirley N. Weber", ["Shirley M. Weber"])).toBeNull());
    it("conflicting leading initial returns null", () =>
      expect(matchName("A. Kevin Chan", ["B. Kevin Chan"])).toBeNull());
    it("non-Latin names do not match each other", () =>
      expect(matchName("陳先生", ["陈美玲", "Connie Chan"])).toBeNull());
    it("letters NFD cannot decompose are not deleted", () => {
      expect(matchName("Łukasz Nowak", ["ukasz Nowak"])).toBeNull();
      expect(matchName("Lukasz Nowak", ["Łukasz Nowak"])).toEqual(f("Łukasz Nowak"));
    });
    it("middle initial without period matches", () =>
      expect(matchName("Shirley N Weber", ["Shirley N. Weber"])).toEqual(f("Shirley N. Weber")));
    it("spaced initials do not match dotted pair", () =>
      expect(matchName("J. R. Eppler", ["J.R. Eppler"])).toBeNull());
    it("picks the only compatible candidate", () =>
      expect(matchName("Connie Chan", ["Connie M. Chan", "Gordon Chan"])).toEqual(f("Connie M. Chan")));
    it("quoted nickname is optional", () =>
      expect(matchName("Kulvindar Singh", ['Kulvindar "Rani" Singh'])).toEqual(f('Kulvindar "Rani" Singh')));
    it("curly apostrophe matches straight", () =>
      expect(matchName("O\u2019Brien", ["O'Brien"])).toEqual(f("O'Brien")));
    it("hyphenated vs spaced surname returns null", () =>
      expect(matchName("Ann Smith Jones", ["Ann Smith-Jones"])).toBeNull());
    it("suffixes are ignored on both sides", () => {
      expect(matchName("John Smith", ["John Smith Jr."])).toEqual(f("John Smith Jr."));
      expect(matchName("John Smith Sr.", ["John Smith"])).toEqual(f("John Smith"));
    });
    it("suffix-only differences are still ambiguous", () =>
      expect(matchName("John Smith", ["John Smith Jr.", "John Smith Sr."])).toBeNull());
    it("empty or punctuation-only input returns null", () => {
      expect(matchName("", cands)).toBeNull();
      expect(matchName(" . ", cands)).toBeNull();
      expect(matchName("...", ["..."].concat(cands.slice(0, 1)))).toEqual({ name: "...", fuzzy: false });
    });
  });
  describe("parenthetical nicknames", () => {
    const f = (name: string) => ({ name, fuzzy: true });
    const ballot = ["Dionjay (DJ) Brookter", "J.R. Eppler", "Theo Ellington", "Donald P. (Don) Wagner"];
    it("dotted nickname initials match", () =>
      expect(matchName("D.J. Brookter", ballot)).toEqual(f("Dionjay (DJ) Brookter")));
    it("nickname in place of the first name matches", () => {
      expect(matchName("DJ Brookter", ballot)).toEqual(f("Dionjay (DJ) Brookter"));
      expect(matchName("Don Wagner", ballot)).toEqual(f("Donald P. (Don) Wagner"));
    });
    it("name without the parenthetical matches", () => {
      expect(matchName("Dionjay Brookter", ballot)).toEqual(f("Dionjay (DJ) Brookter"));
      expect(matchName("Donald Wagner", ballot)).toEqual(f("Donald P. (Don) Wagner"));
    });
    it("initials rule still applies to each variant", () => {
      expect(matchName("Don P. Wagner", ballot)).toEqual(f("Donald P. (Don) Wagner"));
      expect(matchName("Don Q. Wagner", ballot)).toBeNull();
      expect(matchName("Donald Q. Wagner", ballot)).toBeNull();
    });
    it("a nickname does not collide with another candidate sharing the surname", () => {
      const c = ["Donald P. (Don) Wagner", "Ronald Wagner", "Mary Wagner"];
      expect(matchName("Ronald Wagner", c)).toEqual({ name: "Ronald Wagner", fuzzy: false });
      expect(matchName("Mary Wagner", c)).toEqual({ name: "Mary Wagner", fuzzy: false });
      expect(matchName("Don Wagner", c)).toEqual(f("Donald P. (Don) Wagner"));
      expect(matchName("Ron Wagner", c)).toBeNull();
    });
    it("is ambiguous when a nickname equals another candidate's name", () =>
      expect(matchName("DJ Brookter", ["Dionjay (DJ) Brookter", "D.J. Brookter"])).toBeNull());
  });
  describe("real ballot names", () => {
    const f = (name: string) => ({ name, fuzzy: true });
    const sup8 = ["Gary McCoy", "Michael T. Nguyen", "Darshini Patel", 'Emanuel "Manny" Yekutiel'];
    const sup10 = [
      'Pearci "PJ" Bastiany III', "Dionjay (DJ) Brookter", "Theo Ellington", "J.R. Eppler",
      'Ellsworth "Ell" M. Jennison, Jr.', "Mike Trouble Lin",
    ];
    const college = ["Elijah Ball", "Rome Moses Jones", "Monroe Lace", "Leah LaCroix", "Jeremy Lee", "Bunny McFadden", "Erwin Tam", "Lisa Palagi Wynn II"];
    it("Manny / Emanuel Yekutiel", () => {
      expect(matchName("Manny Yekutiel", sup8)).toEqual(f('Emanuel "Manny" Yekutiel'));
      expect(matchName("Emanuel Yekutiel", sup8)).toEqual(f('Emanuel "Manny" Yekutiel'));
      expect(matchName("Emanuel \u201cManny\u201d Yekutiel", sup8)).toEqual(f('Emanuel "Manny" Yekutiel'));
    });
    it("PJ / Pearci Bastiany", () => {
      expect(matchName("PJ Bastiany", sup10)).toEqual(f('Pearci "PJ" Bastiany III'));
      expect(matchName("Pearci Bastiany", sup10)).toEqual(f('Pearci "PJ" Bastiany III'));
    });
    it("Ell / Ellsworth Jennison", () => {
      expect(matchName("Ell Jennison", sup10)).toEqual(f('Ellsworth "Ell" M. Jennison, Jr.'));
      expect(matchName("Ellsworth Jennison", sup10)).toEqual(f('Ellsworth "Ell" M. Jennison, Jr.'));
      expect(matchName("Ellsworth M. Jennison Jr.", sup10)).toEqual(f('Ellsworth "Ell" M. Jennison, Jr.'));
    });
    it("Lisa Wynn / Lisa Palagi Wynn", () => {
      expect(matchName("Lisa Wynn", college)).toEqual(f("Lisa Palagi Wynn II"));
      expect(matchName("Lisa Palagi Wynn", college)).toEqual(f("Lisa Palagi Wynn II"));
    });
    it("Philip Wing", () =>
      expect(matchName("Philip Wing", ["Catherine Stefani", "Philip Louis Wing"])).toEqual(f("Philip Louis Wing")));
    it("Jeremy Greco", () =>
      expect(matchName("Jeremy Greco", ["Albert Chow", "Jeremy Julian Greco", "Alan Wong"])).toEqual(f("Jeremy Julian Greco")));
    it("Mike Lin", () => expect(matchName("Mike Lin", sup10)).toEqual(f("Mike Trouble Lin")));
    it("omitted middle names must keep first and last", () => {
      expect(matchName("Louis Wing", ["Philip Louis Wing"])).toBeNull();
      expect(matchName("Philip Louis", ["Philip Louis Wing"])).toBeNull();
      expect(matchName("Wing", ["Philip Louis Wing"])).toBeNull();
    });
    it("omitted middle names stay unique", () =>
      expect(matchName("Mike Lin", ["Mike Trouble Lin", "Mike Lee Lin"])).toBeNull());
  });
});
