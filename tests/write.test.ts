import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { EndorsementFile, type Entry } from "@/lib/schema";
import { nextFile, shrinkWarning, toYaml } from "@/pipeline/write";

const prev: EndorsementFile = {
  guide: "spur", election: "2026-11", status: "pending", source: "https://www.spur.org/voter-guide/2026-11",
  extraSources: ["https://www.spur.org/voter-guide/2026-11/sf-prop-b"], fetchWith: "browser",
  allowForeignSources: true, fetchedAt: "2026-09-01", hasReasoning: false,
  picks: { "prop-a": { pick: "N", ranked: false, quotes: [] } },
};
const picks: Record<string, Entry> = {
  "prop-b": { pick: "Y", ranked: false, quotes: [{ text: "A public bank would help.", source: "https://www.spur.org/voter-guide/2026-11/sf-prop-b" }] },
  "prop-c": { pick: "N", ranked: false, quotes: [] },
  "supervisor-d8": { pick: ["Gary McCoy", "Michael Nguyen"], ranked: true, quotes: [] },
};

describe("nextFile", () => {
  it("never writes a quote listed in rejectedQuotes, however its spacing or apostrophes differ, and keeps the list", () => {
    const rejected = [{ text: "Rep. Mullin has served in this seat since 2022.", reason: "not substantive (audit 2026-10-06)" }];
    const src = "https://g.org/a";
    const withQuotes = {
      "us-rep-15": { pick: ["Kevin Mullin"], ranked: false, quotes: [{ text: "Rep.  Mullin has served in this seat since 2022.", source: src }, { text: "Mullin’s record on climate is strong.", source: src }] },
    } as Record<string, Entry>;
    const n = nextFile({ ...prev, rejectedQuotes: rejected }, withQuotes, true, "2026-10-05");
    expect(n.picks["us-rep-15"].quotes.map((q) => q.text)).toEqual(["Mullin’s record on climate is strong."]);
    expect(n.rejectedQuotes).toEqual(rejected);
    const back = EndorsementFile.parse(parse(toYaml(n)));
    expect(back.rejectedQuotes).toEqual(rejected);
  });
  it("publishes new picks and keeps the file's settings", () => {
    const n = nextFile(prev, picks, true, "2026-10-05");
    expect(n).toMatchObject({
      guide: "spur", election: "2026-11", status: "published", source: prev.source, extraSources: prev.extraSources,
      fetchWith: "browser", allowForeignSources: true, fetchedAt: "2026-10-05", hasReasoning: true, picks,
    });
    expect(n.manual).toBeUndefined();
  });

  it("is pending when nothing was extracted, even over a published file (--force)", () => {
    const n = nextFile(prev, {}, false, "2026-10-05");
    expect(n.status).toBe("pending");
    expect(n.picks).toEqual({});
    expect(nextFile({ ...prev, status: "published" }, {}, false, "2026-10-05").status).toBe("pending");
  });

  it("records archive snapshots, keeping the previous ones when none are given", () => {
    const snap = [{
      source: "https://www.spur.org/voter-guide/2026-11",
      snapshot: "https://web.archive.org/web/20261005000000/https://www.spur.org/voter-guide/2026-11",
    }];
    expect(nextFile(prev, picks, true, "2026-10-05", snap).archived).toEqual(snap);
    expect(nextFile({ ...prev, archived: snap }, picks, true, "2026-10-06").archived).toEqual(snap);
    expect(nextFile(prev, picks, true, "2026-10-05").archived).toBeUndefined();
  });

  it("keeps fetchedAt when picks and quotes are unchanged", () => {
    const same = { ...prev, picks, fetchedAt: "2026-10-01" };
    const reordered = Object.fromEntries(Object.entries(structuredClone(picks)).reverse());
    expect(nextFile(same, reordered, true, "2026-10-05").fetchedAt).toBe("2026-10-01");
    const moreQuotes = structuredClone(picks);
    moreQuotes["prop-c"].quotes.push({ text: "A new reason.", source: "https://www.spur.org/" });
    expect(nextFile(same, moreQuotes, true, "2026-10-05").fetchedAt).toBe("2026-10-05");
  });

  it("replaces the snapshot for a re-archived source and keeps the others", () => {
    const src = prev.source!;
    const extra = prev.extraSources![0];
    const old = [
      { source: src, snapshot: `https://web.archive.org/web/20260512000000/${src}` },
      { source: extra, snapshot: `https://web.archive.org/web/20260512000000/${extra}` },
    ];
    const fresh = [{ source: src, snapshot: `https://web.archive.org/web/20261005000000/${src}` }];
    expect(nextFile({ ...prev, archived: old }, picks, true, "2026-10-05", fresh).archived).toEqual([fresh[0], old[1]]);
  });

  it("drops snapshots for sources the file no longer lists", () => {
    const gone = [{ source: "https://www.spur.org/old-page", snapshot: "https://web.archive.org/web/1/https://www.spur.org/old-page" }];
    const fresh = [{ source: prev.source!, snapshot: `https://web.archive.org/web/20261005000000/${prev.source}` }];
    expect(nextFile({ ...prev, archived: gone }, picks, true, "2026-10-05", fresh).archived).toEqual(fresh);
  });

  it("keeps a hold while extraction returns the same pick, and drops it when the pick changes", () => {
    const held = [{ contestId: "prop-c", pick: "N" as const, reason: "wrong-pick" as const, evidence: "Page says Yes on C." }];
    const same = nextFile({ ...prev, held }, picks, true, "2026-10-05");
    expect(same.held).toEqual(held);
    expect(same.picks["prop-c"]).toBeUndefined();
    const changed = { ...picks, "prop-c": { pick: "Y" as const, ranked: false, quotes: [] } };
    const n = nextFile({ ...prev, held }, changed, true, "2026-10-05");
    expect(n.held).toBeUndefined();
    expect(n.picks["prop-c"].pick).toBe("Y");
  });

  it("keeps manual", () => {
    expect(nextFile({ ...prev, manual: true }, picks, true, "2026-10-05").manual).toBe(true);
  });
});

describe("toYaml", () => {
  const file = nextFile(prev, picks, true, "2026-10-05", [
    { source: "https://www.spur.org/", snapshot: "https://web.archive.org/web/2026/https://www.spur.org/" },
  ]);

  it("round-trips through the schema", () => {
    expect(EndorsementFile.parse(parse(toYaml(file)))).toEqual(file);
  });

  it("round-trips rankedCount", () => {
    const f = { ...file, picks: { "supervisor-d8": { pick: ["Gary McCoy", "Michael Nguyen"], ranked: true, rankedCount: 1, quotes: [] } } };
    const y = toYaml(f);
    expect(y).toContain("rankedCount: 1");
    expect(EndorsementFile.parse(parse(y))).toEqual(f);
  });

  it("writes keys in a stable order", () => {
    const shuffled = Object.fromEntries(Object.entries(file).reverse()) as EndorsementFile;
    const keys = toYaml(shuffled).split("\n").filter((l) => /^[a-zA-Z]/.test(l)).map((l) => l.split(":")[0]);
    expect(keys).toEqual([
      "guide", "election", "status", "source", "extraSources", "fetchWith", "allowForeignSources",
      "archived", "fetchedAt", "hasReasoning", "picks",
    ]);
  });

  it("writes Y/N as plain scalars that re-parse as strings", () => {
    const y = toYaml(file);
    expect(y).toMatch(/^ {4}pick: Y$/m);
    expect(y).toMatch(/^ {4}pick: N$/m);
    const raw = parse(y) as { picks: Record<string, { pick: unknown }> };
    expect(raw.picks["prop-b"].pick).toBe("Y");
    expect(raw.picks["prop-c"].pick).toBe("N");
  });

  it("writes held after hasReasoning and before picks", () => {
    const f = { ...file, held: [{ contestId: "prop-c", pick: "N" as const, reason: "wrong-pick" as const, evidence: "Page says Yes on C." }] };
    const keys = toYaml(f).split("\n").filter((l) => /^[a-zA-Z]/.test(l)).map((l) => l.split(":")[0]);
    expect(keys.slice(-3)).toEqual(["hasReasoning", "held", "picks"]);
    expect(EndorsementFile.parse(parse(toYaml(f)))).toEqual(f);
  });

  it("does not wrap long lines", () => {
    const long = "word ".repeat(60).trim() + ".";
    const f = { ...file, picks: { "prop-b": { pick: "Y" as const, ranked: false, quotes: [{ text: long, source: "https://www.spur.org/" }] } } };
    expect(toYaml(f)).toContain(long);
  });

  it("keeps comments from the previous file on keys that remain", () => {
    const previous = [
      "# allowForeignSources: the PDF lives on the CDN",
      "guide: spur",
      "election: 2026-11",
      "status: pending",
      "source: https://www.spur.org/voter-guide/2026-11  # page also lists the June slate",
      "fetchedAt: 2026-09-01",
      "hasReasoning: false",
      "picks: {}",
      "",
    ].join("\n");
    const y = toYaml(file, { previous });
    expect(y.startsWith("# allowForeignSources: the PDF lives on the CDN\nguide: spur\n")).toBe(true);
    expect(y).toContain("source: https://www.spur.org/voter-guide/2026-11 # page also lists the June slate\n");
    expect(EndorsementFile.parse(parse(y))).toEqual(file);
  });
});

describe("shrinkWarning", () => {
  const entry: Entry = { pick: "Y", ranked: false, quotes: [] };
  const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`prop-${i}`, entry]));
  const MSG = "  !! spur: 0 picks (previous 4), file left unchanged; rerun with --force to accept";

  it("refuses to wipe existing picks", () => {
    expect(shrinkWarning("spur", many(4), {})).toBe(MSG);
  });
  it("refuses a result with fewer than half the previous picks", () => {
    expect(shrinkWarning("spur", many(5), many(2))).toBe(
      "  !! spur: 2 picks (previous 5), file left unchanged; rerun with --force to accept",
    );
  });
  it("accepts half or more", () => {
    expect(shrinkWarning("spur", many(4), many(2))).toBeNull();
    expect(shrinkWarning("spur", many(4), many(6))).toBeNull();
  });
  it("accepts anything when there were no picks before", () => {
    expect(shrinkWarning("spur", {}, {})).toBeNull();
  });
  it("accepts with force", () => {
    expect(shrinkWarning("spur", many(4), {}, { force: true })).toBeNull();
  });
});

describe("nextFile keeps every field it doesn't set", () => {
  const settings = {
    fetchFrom: "local" as const,
    fetchWith: "browser" as const,
    manual: true,
    allowForeignSources: true,
    rejectedQuotes: [{ text: "A sentence nobody wants back.", reason: "not substantive" }],
  };
  it("keeps fetchFrom, fetchWith, manual, allowForeignSources and rejectedQuotes", () => {
    const n = nextFile({ ...prev, ...settings }, picks, true, "2026-10-05");
    expect(n).toMatchObject(settings);
  });
  it("keeps a field added to the schema later", () => {
    const future = { ...prev, someFutureField: "kept" } as EndorsementFile;
    expect((nextFile(future, picks, true, "2026-10-05") as Record<string, unknown>).someFutureField).toBe("kept");
  });
  it("writes a field missing from the key order instead of dropping it", () => {
    const future = { ...prev, someFutureField: "kept" } as EndorsementFile;
    const y = toYaml(future);
    expect(y).toContain("someFutureField: kept");
    expect(y.indexOf("someFutureField")).toBeLessThan(y.indexOf("picks:"));
  });
  it("keeps fetchFrom and its inline comment through toYaml", () => {
    const before = EndorsementFile.parse({ ...prev, fetchFrom: "local" });
    const text = toYaml(before).replace("fetchFrom: local", "fetchFrom: local # blocks GitHub's runners");
    const y = toYaml(nextFile(before, picks, true, "2026-10-05"), { previous: text });
    expect(y).toContain("fetchFrom: local # blocks GitHub's runners");
  });
});
