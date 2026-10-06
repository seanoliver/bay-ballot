import { describe, expect, it } from "vitest";
import { navModel, sectionOf, spySection } from "@/lib/section-nav";
import type { PlaceGroup } from "@/lib/areas";
import type { Contest } from "@/lib/schema";

const c = (id: string) => ({ id }) as Contest;
const groups = [
  { key: "ca", heading: "California", county: null, sections: [{ name: "Federal", contests: [c("a"), c("b")] }, { name: "State", contests: [c("d")] }] },
  { key: "sf", heading: "San Francisco", county: "San Francisco", sections: [{ name: "Local measures", contests: [c("e"), c("f"), c("g")] }, { name: "State", contests: [c("h")] }] },
] as PlaceGroup[];

describe("navModel", () => {
  it("gives every place and section a unique anchor and a count", () => {
    const m = navModel(groups);
    expect(m.map((g) => [g.id, g.heading, g.count])).toEqual([
      ["place-ca", "California", 3],
      ["place-sf", "San Francisco", 4],
    ]);
    expect(m.flatMap((g) => g.sections.map((s) => [s.id, s.name, s.count, s.place]))).toEqual([
      ["section-ca-federal", "Federal", 2, "California"],
      ["section-ca-state", "State", 1, "California"],
      ["section-sf-local-measures", "Local measures", 3, "San Francisco"],
      ["section-sf-state", "State", 1, "San Francisco"],
    ]);
  });
});

describe("anchors", () => {
  it("are valid ids even when a place key has spaces and colons", () => {
    const m = navModel([{ key: "county:San Mateo", heading: "San Mateo County", county: "San Mateo", sections: [{ name: "Local candidates", contests: [c("x")] }] }] as PlaceGroup[]);
    expect(m[0].id).toBe("place-county-san-mateo");
    expect(m[0].sections[0].id).toBe("section-county-san-mateo-local-candidates");
  });
});

describe("sectionOf", () => {
  it("finds the section a contest is in", () => {
    expect(sectionOf(navModel(groups), "f")).toBe("section-sf-local-measures");
    expect(sectionOf(navModel(groups), "zzz")).toBeNull();
  });
});

describe("spySection", () => {
  const tops = (...t: number[]) => ["s1", "s2", "s3"].map((id, i) => ({ id, top: t[i] }));
  it("is the last section whose heading has passed the line", () => {
    expect(spySection(tops(100, 600, 1200), { line: 250, atBottom: false, viewport: 900 })).toBe("s1");
    expect(spySection(tops(-500, 200, 900), { line: 250, atBottom: false, viewport: 900 })).toBe("s2");
    expect(spySection(tops(-900, -300, 250), { line: 250, atBottom: false, viewport: 900 })).toBe("s3");
  });
  it("before the first heading reaches the line, it's the first section", () => {
    expect(spySection(tops(400, 900, 1500), { line: 250, atBottom: false, viewport: 900 })).toBe("s1");
  });
  it("at the bottom of the page, the last heading on screen wins even below the line", () => {
    expect(spySection(tops(-900, 100, 600), { line: 250, atBottom: true, viewport: 900 })).toBe("s3");
    expect(spySection(tops(-900, 100, 950), { line: 250, atBottom: true, viewport: 900 })).toBe("s2");
  });
  it("no sections, no answer", () => {
    expect(spySection([], { line: 250, atBottom: false, viewport: 900 })).toBeNull();
  });
});
