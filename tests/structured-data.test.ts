import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, jsonLdHtml, SITE_NAME, websiteJsonLd } from "@/lib/structured-data";

describe("websiteJsonLd", () => {
  it("names the site Bay Ballot at the bayballot.com home page", () => {
    expect(websiteJsonLd()).toEqual({ "@context": "https://schema.org", "@type": "WebSite", name: "Bay Ballot", url: "https://bayballot.com/" });
    expect(SITE_NAME).toBe("Bay Ballot");
  });
});

describe("breadcrumbJsonLd", () => {
  const list = breadcrumbJsonLd([
    { name: "San Francisco ballot", path: "/2026-11/sf" },
    { name: "Proposition B", path: "/2026-11/prop-b" },
  ]);

  it("is a schema.org BreadcrumbList of ListItems", () => {
    expect(list["@context"]).toBe("https://schema.org");
    expect(list["@type"]).toBe("BreadcrumbList");
    expect(list.itemListElement.every((i) => i["@type"] === "ListItem")).toBe(true);
  });
  it("numbers the trail 1..n in order, with each level's name and absolute URL", () => {
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "San Francisco ballot", item: "https://bayballot.com/2026-11/sf" },
      { "@type": "ListItem", position: 2, name: "Proposition B", item: "https://bayballot.com/2026-11/prop-b" },
    ]);
  });
  it("numbers a longer trail 1..n", () => {
    const three = breadcrumbJsonLd([{ name: "a", path: "/a" }, { name: "b", path: "/b" }, { name: "c", path: "/c" }]);
    expect(three.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  });
});

describe("jsonLdHtml", () => {
  it("cannot close its script tag, and still parses back to the same data", () => {
    const data = { name: "</script><script>alert(1)</script>" };
    const html = jsonLdHtml(data);
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual(data);
  });
});
