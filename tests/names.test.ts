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
    it("nickname in quotes does not match", () =>
      expect(matchName("Kulvindar Singh", ['Kulvindar "Rani" Singh'])).toBeNull());
    it("curly apostrophe matches straight", () =>
      expect(matchName("O\u2019Brien", ["O'Brien"])).toEqual(f("O'Brien")));
    it("hyphenated vs spaced surname returns null", () =>
      expect(matchName("Ann Smith Jones", ["Ann Smith-Jones"])).toBeNull());
    it("suffix mismatch returns null", () =>
      expect(matchName("John Smith", ["John Smith Jr."])).toBeNull());
    it("empty or punctuation-only input returns null", () => {
      expect(matchName("", cands)).toBeNull();
      expect(matchName(" . ", cands)).toBeNull();
      expect(matchName("...", ["..."].concat(cands.slice(0, 1)))).toEqual({ name: "...", fuzzy: false });
    });
  });
});
