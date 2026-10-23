import { describe, expect, it } from "vitest";
import { changelogDays, dataSummary, digestSearch, guideHistory, readDigestQuery, rowInArea, visibleDays, type SiteItem } from "@/lib/changelog-digest";
import { monthDay } from "@/lib/display";
import { validateChangelog } from "@/lib/changelog";

const entry = (date: string, type: SiteItem["type"], title: string, guide?: string): SiteItem => ({ date, type, title, file: `${date}-${title.replace(/\W+/g, "-").toLowerCase()}.yml`, ...(guide ? { guide } : {}) });
const guides = [
  { id: "growsf", name: "GrowSF" },
  { id: "sf-chronicle", name: "San Francisco Chronicle" },
  { id: "marin-dems", name: "Marin County Democratic Party" },
];

const entries = [
  entry("2026-10-15", "new", "A new thing"),
  entry("2026-10-15", "data", "GrowSF added a reason for Prop E", "growsf"),
  entry("2026-10-15", "data", "Marin County Democratic Party endorsed Yes on Measure P", "marin-dems"),
  entry("2026-10-15", "data", "GrowSF endorsed No on Prop F", "growsf"),
  entry("2026-10-15", "data", "Mercury News endorsed No on Prop 44"),
  entry("2026-10-14", "data", "San Francisco Chronicle added a reason for Prop 1", "sf-chronicle"),
  entry("2026-10-13", "fix", "A fix"),
];
const days = changelogDays(entries, guides);

describe("changelogDays", () => {
  it("groups entries by day in order and splits site changes from data rows", () => {
    expect(days.map((d) => [d.date, d.site.map((e) => e.title), d.data.length])).toEqual([
      ["2026-10-15", ["A new thing"], 4],
      ["2026-10-14", [], 1],
      ["2026-10-13", ["A fix"], 0],
    ]);
  });
  it("splits a data row into its guide's name and the rest of the title", () => {
    expect(days[0].data[0]).toMatchObject({ guide: "growsf", name: "GrowSF", text: "added a reason for Prop E" });
    expect(days[0].data[3]).toMatchObject({ guide: null, name: null, text: "Mercury News endorsed No on Prop 44" });
  });
  it("an unknown guide id leaves the row unnamed and unassigned", () => {
    const [d] = changelogDays([entry("2026-10-15", "data", "Gone added a reason", "gone")], guides);
    expect(d.data[0]).toMatchObject({ guide: null, name: null, text: "Gone added a reason" });
  });
});

describe("dataRow on a guided entry", () => {
  it("keeps the guide name, details and PR", () => {
    const [row] = changelogDays([{ file: "x.yml", date: "2026-10-14", type: "data", guide: "growsf", title: "GrowSF refreshed", details: "d", pr: 9 }], guides)[0].data;
    expect(row).toMatchObject({ guide: "growsf", name: "GrowSF", details: "d", pr: 9 });
  });
});

describe("dataRow without a leading guide name", () => {
  it("keeps the guide and the whole title", () => {
    const [row] = changelogDays([entry("2026-10-14", "data", "Endorsements refreshed", "growsf")], guides)[0].data;
    expect(row).toMatchObject({ guide: "growsf", name: null, text: "Endorsements refreshed" });
  });
});

describe("dataSummary", () => {
  it("counts distinct guides and every update", () => {
    expect(dataSummary(days[0].data)).toBe("2 guides updated · 4 updates");
    expect(dataSummary(days[1].data)).toBe("1 guide updated");
  });
  it("counts updates alone when no row has a guide", () => {
    expect(dataSummary([{ guide: null }, { guide: null }])).toBe("2 updates");
  });
});

describe("rowInArea and visibleDays", () => {
  const sf = new Set(["growsf", "sf-chronicle"]);
  it("keeps rows whose guide covers the area, and rows with no guide everywhere", () => {
    expect(rowInArea({ guide: "growsf" }, sf)).toBe(true);
    expect(rowInArea({ guide: "marin-dems" }, sf)).toBe(false);
    expect(rowInArea({ guide: null }, sf)).toBe(true);
    expect(rowInArea({ guide: "marin-dems" }, null)).toBe(true);
  });
  it("Site drops data rows and days left empty", () => {
    expect(visibleDays(days, { show: "site", guides: null }).map((d) => [d.date, d.data.length])).toEqual([
      ["2026-10-15", 0],
      ["2026-10-13", 0],
    ]);
  });
  it("Data drops site changes and days left empty, and an area narrows the rows", () => {
    expect(visibleDays(days, { show: "data", guides: null }).map((d) => [d.date, d.site.length, d.data.length])).toEqual([
      ["2026-10-15", 0, 4],
      ["2026-10-14", 0, 1],
    ]);
    const marin = visibleDays(days, { show: "data", guides: new Set(["marin-dems"]) });
    expect(marin.map((d) => [d.date, d.data.map((r) => r.guide)])).toEqual([["2026-10-15", ["marin-dems", null]]]);
  });
  it("All keeps site changes under an area", () => {
    expect(visibleDays(days, { show: "all", guides: new Set(["marin-dems"]) }).map((d) => d.date)).toEqual(["2026-10-15", "2026-10-13"]);
  });
});

describe("digest query", () => {
  const ids = ["sf", "marin"];
  it("reads show and area, ignoring unknown values", () => {
    expect(readDigestQuery("", ids)).toEqual({ show: "all", area: null });
    expect(readDigestQuery("?show=data&area=sf", ids)).toEqual({ show: "data", area: "sf" });
    expect(readDigestQuery("?show=site&area=sf", ids)).toEqual({ show: "site", area: null });
    expect(readDigestQuery("?show=nope&area=mars", ids)).toEqual({ show: "all", area: null });
  });
  it("writes only what differs from the default", () => {
    expect(digestSearch({ show: "all", area: null })).toBe("");
    expect(digestSearch({ show: "data", area: "sf" })).toBe("?show=data&area=sf");
    expect(digestSearch({ show: "all", area: "marin" })).toBe("?area=marin");
  });
});

describe("monthDay", () => {
  it("names the day without the year", () => {
    expect(monthDay("2026-10-15")).toBe("October 15");
  });
});

describe("validateChangelog guide ids", () => {
  it("flags a guide id that does not exist", () => {
    const f = (guide: string) => ({ date: "2026-10-06", guide, file: `2026-10-06-refresh-${guide}.yml` });
    expect(validateChangelog([f("growsf"), f("gone")], "2026-10-06", { guides: new Set(["growsf"]) })).toEqual(["changelog/2026-10-06-refresh-gone.yml: no guide 'gone'"]);
  });
});

describe("dataRow keeps a hand-written entry's details and PR", () => {
  it("copies details and pr onto the row", () => {
    const row = changelogDays([{ file: "x.yml", date: "2026-10-14", type: "data", title: "Burlingame City Council, District 3 is now on the ballot", details: "The race was missing.", pr: 9 }], [])[0].data[0];
    expect(row).toMatchObject({ details: "The race was missing.", pr: 9 });
  });
});

describe("guideHistory", () => {
  it("keeps only the guide's data entries, newest first, with its name dropped and the rest capitalized", () => {
    expect(guideHistory(entries, guides[0]).map((r) => [r.date, r.text])).toEqual([
      ["2026-10-15", "Added a reason for Prop E"],
      ["2026-10-15", "Endorsed No on Prop F"],
    ]);
  });
  it("leaves a title that doesn't start with the guide's name as written", () => {
    const rows = guideHistory([entry("2026-10-15", "data", "Restored a quote on Prop 1", "growsf")], guides[0]);
    expect(rows[0].text).toBe("Restored a quote on Prop 1");
  });
  it("a guide with no entries gets no rows", () => {
    expect(guideHistory(entries, { id: "nobody", name: "Nobody" })).toEqual([]);
  });
});
