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
});
