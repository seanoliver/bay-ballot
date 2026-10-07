import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadElection } from "@/lib/data";
import { normalizePageText, pageGate, relevantChange, sourceSlug, storedText } from "@/pipeline/pagestore";

const { ballot } = loadElection(path.join(__dirname, "..", "data"), "2026-11");

describe("normalizePageText", () => {
  it("strips dates and times in common formats", () => {
    const t = normalizePageText(
      "Posted October 5, 2026 at 9:30 am\nUpdated: Oct. 6, 2026 21:30\n2026-10-05\n10/05/2026\nMonday, 5 October 2026\nYes on Prop B",
    );
    expect(t).not.toMatch(/2026|9:30|21:30|October|Oct\b|Monday/);
    expect(t).toContain("Yes on Prop B");
  });
  it("drops relative times and 'Updated …' lines", () => {
    const t = normalizePageText("3 hours ago\nUpdated 5 minutes ago\nLast updated yesterday\nWe endorse Prop C");
    expect(t).toBe("We endorse Prop C");
  });
  it("strips counters but not proposition numbers", () => {
    const t = normalizePageText("123 comments · 1.2K shares · 45 likes\nVote yes on Prop 1 and Prop 45");
    expect(t).not.toMatch(/123|1\.2K|45 likes/);
    expect(t).toContain("Vote yes on Prop 1 and Prop 45");
  });
  it("drops cookie, newsletter, subscribe and footer lines", () => {
    const t = normalizePageText(
      "We use cookies to improve your experience. Accept all\nSubscribe to our newsletter\nSign up for updates\n© 2026 GrowSF. All rights reserved.\nPrivacy Policy | Terms of Service\nNo on Prop G",
    );
    expect(t).toBe("No on Prop G");
  });
  it("collapses whitespace and drops empty lines but keeps duplicates and order", () => {
    expect(normalizePageText("  Yes   on A \n\n\nYes on A\nNo on B  ")).toBe("Yes on A\nYes on A\nNo on B");
    expect(normalizePageText("Prop A\nYES\nProp B\nYES")).toBe("Prop A\nYES\nProp B\nYES");
  });
  it("keeps the text of an 'Updated …' line, minus the date", () => {
    expect(normalizePageText("Updated Oct 5: we now recommend No on Prop G")).toBe("Updated : we now recommend No on Prop G");
  });
  it("keeps a boilerplate-looking line that carries a verdict or names a contest", () => {
    expect(normalizePageText("Yes - sign up to volunteer for Prop B")).toBe("Yes - sign up to volunteer for Prop B");
    expect(normalizePageText("Subscribe for our Prop C explainer")).toBe("Subscribe for our Prop C explainer");
  });
});

describe("relevantChange", () => {
  const page = "Our November 2026 endorsements\nYes on Prop A: Charter changes\nNo on Prop G: Sunset Dunes\nJoin us for our fall picnic";

  it("ignores date, relative-time, counter and boilerplate changes", () => {
    const old = `Posted October 1, 2026\n3 hours ago\n12 comments\n${page}\nWe use cookies.`;
    const next = `Posted October 6, 2026\n5 minutes ago\n40 comments\n${page}\nThis site uses cookies. Accept all`;
    expect(relevantChange(old, next, ballot)).toBe(false);
  });
  it("ignores breadcrumb navigation that flips between fetches", () => {
    const a = `You are here: Home Endorsements\n${page}`;
    const b = `You are here: Home Endorsements endorsements\n${page}`;
    expect(relevantChange(a, b, ballot)).toBe(false);
  });
  it("ignores an image whose alt text is just its file name", () => {
    expect(relevantChange(`[endorsements-nov2026-teal.png]\n${page}`, page, ballot)).toBe(false);
    expect(relevantChange(page, `${page}\n[Endorsement Slate 2026.JPEG]`, ballot)).toBe(false);
  });
  it("ignores whitespace-only changes and reordering", () => {
    expect(relevantChange(page, page.replace(/ /g, "  "), ballot)).toBe(false);
  });
  it("ignores unrelated text that names no contest and no endorsement", () => {
    expect(relevantChange(page, page.replace("fall picnic", "winter potluck on Saturday"), ballot)).toBe(false);
  });
  it("flags an added or removed line naming a contest", () => {
    expect(relevantChange(page, `${page}\nYes on Prop H: Muni`, ballot)).toBe(true);
    expect(relevantChange(page, page.replace("No on Prop G: Sunset Dunes\n", ""), ballot)).toBe(true);
  });
  it("flags lines naming a candidate, an alias or a surname", () => {
    expect(relevantChange(page, `${page}\nConnie Chan for Congress`, ballot)).toBe(true);
    expect(relevantChange(page, `${page}\nManohar Raju`, ballot)).toBe(true);
    expect(relevantChange(page, `${page}\nEllington has our support`, ballot)).toBe(true);
  });
  it("flags endorsement keywords", () => {
    for (const line of ["We endorse the incumbent", "Our recommendation is final", "We oppose this", "Vote no", "#1 choice", "Ranked choice slate"]) {
      expect(relevantChange(page, `${page}\n${line}`, ballot)).toBe(true);
    }
  });
  it("accepts extra aliases", () => {
    const line = "DJB will host a phone bank Saturday afternoon";
    expect(relevantChange(page, `${page}\n${line}`, ballot)).toBe(false);
    expect(relevantChange(page, `${page}\n${line}`, ballot, { "Dionjay (DJ) Brookter": ["DJB"] })).toBe(true);
  });
});

describe("relevantChange: real pick changes the gate must see", () => {
  const measures = (verdicts: [string, string][]) =>
    ["Ballot measures", ...verdicts.flatMap(([title, v]) => [title, v]), "Paid for by the club"].join("\n");
  const A = "Proposition A - Charter Changes";
  const B = "Proposition B - Public Bank";
  const C = "Proposition C - Contributions to the Housing Fund";

  it("sees a bare verdict flip under its heading", () => {
    const old = measures([[A, "YES"], [B, "YES"], [C, "YES"]]);
    const next = measures([[A, "YES"], [B, "YES"], [C, "NO"]]);
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("sees two measures' verdicts swap", () => {
    const old = measures([[A, "YES"], [B, "NO"]]);
    const next = measures([[A, "NO"], [B, "YES"]]);
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("sees an 'Updated …' line that changes a recommendation", () => {
    const old = measures([[A, "YES"]]);
    const next = `Updated Oct 5: we now recommend No on Prop G\n${old}`;
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("sees a verdict change inside a line that also says 'sign up'", () => {
    const old = `${B}\nYes - sign up to volunteer\nThanks for reading`;
    const next = `${B}\nNo - sign up to volunteer\nThanks for reading`;
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("ignores a long line that only moved or lost a duplicate copy (rotating related-story widgets)", () => {
    const title = "Editorial: SF school board recommendations";
    const old = `${title}\nBy the editors\nWe back three candidates.\nMore stories\nNeurologists beg seniors: stop doing this now\n${title}\nHealth Weekly`;
    const next = `${title}\nBy the editors\nWe back three candidates.\nMore stories\nOne common item ended years of dog scratching\nHealth Weekly`;
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("irrelevant");
  });
  it("sees two long candidate lines swap order under a heading", () => {
    const head = "Board of Supervisors, District 4";
    const ell = "Theo Ellington has spent a decade building housing coalitions across the southeast of the city.";
    const djb = "Dionjay (DJ) Brookter runs a Bayview nonprofit and has served on two city commissions.";
    const old = `${head}\n${ell}\n${djb}\nThanks for reading`;
    const next = `${head}\n${djb}\n${ell}\nThanks for reading`;
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("sees 'vote for this one' become 'vote against this one' under a Prop heading", () => {
    const old = "Proposition C - Housing Fund\nWe say vote for this one, without hesitation.\nThanks for reading";
    const next = "Proposition C - Housing Fund\nWe say vote against this one, without hesitation.\nThanks for reading";
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("sees 'against' change under a contest heading even without 'vote'", () => {
    const old = "Proposition C - Housing Fund\nOur members were firmly behind it this year.\nThanks";
    const next = "Proposition C - Housing Fund\nOur members came out firmly against it this year.\nThanks";
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
  it("ignores 'against' far from any contest", () => {
    const page = "Ballot measures\nProposition C - Housing Fund\nYES\nOne\nTwo\nThree\nFour";
    expect(relevantChange(page, `${page}\nOur softball team plays against the Elks on Saturday.`, ballot)).toBe(false);
  });
  it("sees a short label change under a contest heading", () => {
    const old = `${C}\nNo position\nThanks for reading`;
    const next = `${C}\nStrong yes\nThanks for reading`;
    expect(pageGate(normalizePageText(old), normalizePageText(next), ballot)).toBe("relevant");
  });
});

describe("storedText and pageGate", () => {
  it("stores normalized HTML text", () => {
    expect(storedText({ kind: "text", text: "Yes on A\n3 hours ago" })).toBe("Yes on A");
  });
  it("stores a digest for a PDF without text, so any byte change counts", () => {
    const a = storedText({ kind: "pdf", base64: "JVBERi0xLjQ=", text: "" });
    expect(a).toMatch(/^pdf-sha256:[0-9a-f]{64}$/);
    expect(pageGate(a, storedText({ kind: "pdf", base64: "JVBERi0xLjU=", text: "" }), ballot)).toBe("relevant");
  });
  it("classifies new, same, irrelevant and relevant pages", () => {
    expect(pageGate(null, "Yes on A", ballot)).toBe("new");
    expect(pageGate("Yes on Prop A", "Yes on Prop A", ballot)).toBe("same");
    expect(pageGate("Yes on Prop A\nJoin us for the club picnic in the park", "Yes on Prop A\nJoin us for the club potluck in the park", ballot)).toBe("irrelevant");
    expect(pageGate("Yes on Prop A", "No on Prop A", ballot)).toBe("relevant");
  });
});

describe("sourceSlug", () => {
  it("makes a stable file-safe slug from host and path", () => {
    expect(sourceSlug("https://www.spur.org/voter-guide/2026-11/sf-prop-b-public-bank")).toBe("spur-org-voter-guide-2026-11-sf-prop-b-public-bank");
    expect(sourceSlug("https://sfgop.org/")).toBe("sfgop-org");
  });
  it("keeps long slugs short but distinct", () => {
    const a = sourceSlug(`https://x.org/${"a".repeat(200)}/one`);
    const b = sourceSlug(`https://x.org/${"a".repeat(200)}/two`);
    expect(a.length).toBeLessThanOrEqual(100);
    expect(a).not.toBe(b);
  });
});
