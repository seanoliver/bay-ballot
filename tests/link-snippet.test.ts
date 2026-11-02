import { describe, expect, it } from "vitest";
import { guideLinkSnippet, siteLinkSnippet } from "../src/lib/link-snippet";

const hrefOf = (html: string) => /href="([^"]*)"/.exec(html)?.[1];

describe("siteLinkSnippet", () => {
  it("links the home page with the site's description", () => {
    expect(siteLinkSnippet()).toBe('<a href="https://bayballot.com">Bay Ballot, every Bay Area voter guide side by side</a>');
  });
});

describe("guideLinkSnippet", () => {
  it("links the guide's canonical page with the exact copy", () => {
    expect(guideLinkSnippet({ guideId: "sierra-club-sf-bay", guideName: "Sierra Club SF Bay Chapter" })).toBe(
      '<a href="https://bayballot.com/guides/sierra-club-sf-bay">See how Sierra Club SF Bay Chapter compares with other Bay Area guides</a>',
    );
  });

  it("uses the canonical URL: no trailing slash, no query", () => {
    const href = hrefOf(guideLinkSnippet({ guideId: "sf-chronicle", guideName: "San Francisco Chronicle" }))!;
    expect(href).toBe("https://bayballot.com/guides/sf-chronicle");
    expect(href.endsWith("/")).toBe(false);
    expect(href).not.toContain("?");
  });

  it('escapes &, <, > and " in the guide\'s name', () => {
    const html = guideLinkSnippet({ guideId: "x", guideName: 'A & B "Guide" <x>' });
    expect(html).toContain("See how A &amp; B &quot;Guide&quot; &lt;x&gt; compares");
    expect(html).not.toContain("<x>");
    expect(html.match(/</g)).toHaveLength(2);
  });
});
