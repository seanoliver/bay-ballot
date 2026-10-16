import { describe, expect, it } from "vitest";
import { daysLeft, electionDayState, pacificDate, shortDate } from "@/lib/election-day";

const DAY = "2026-11-03";
const at = (iso: string) => electionDayState(DAY, pacificDate(new Date(iso)));

describe("electionDayState", () => {
  it("counts the days left before election day", () => {
    expect(at("2026-10-16T19:00:00Z")).toEqual({ kind: "before", days: 18 });
    expect(at("2026-11-02T20:00:00Z")).toEqual({ kind: "before", days: 1 });
  });

  it("is election day all day in Pacific time", () => {
    expect(at("2026-11-03T08:00:00Z")).toEqual({ kind: "day" });
    expect(at("2026-11-04T07:59:00Z")).toEqual({ kind: "day" });
  });

  it("is after once Pacific midnight passes", () => {
    expect(at("2026-11-04T08:00:00Z")).toEqual({ kind: "after" });
    expect(at("2027-01-01T00:00:00Z")).toEqual({ kind: "after" });
  });

  it("uses the Pacific date, not UTC, near midnight", () => {
    expect(at("2026-11-03T07:00:00Z")).toEqual({ kind: "before", days: 1 });
    // Daylight saving ends Nov 1, 2026: 11:30 pm PST on Nov 1 is still two days out.
    expect(at("2026-11-02T07:30:00Z")).toEqual({ kind: "before", days: 2 });
  });
});

describe("pacificDate", () => {
  it("returns YYYY-MM-DD", () => {
    expect(pacificDate(new Date("2026-01-05T20:00:00Z"))).toBe("2026-01-05");
  });

  it("formats the California calendar date", () => {
    expect(pacificDate(new Date("2026-10-16T06:59:00Z"))).toBe("2026-10-15");
    expect(pacificDate(new Date("2026-10-16T07:00:00Z"))).toBe("2026-10-16");
  });
});

describe("labels", () => {
  it("pluralizes days", () => {
    expect(daysLeft(1)).toBe("1 day");
    expect(daysLeft(2)).toBe("2 days");
  });

  it("shortens the date", () => {
    expect(shortDate(DAY)).toBe("Nov 3");
  });
});
