import { SITE } from "./seo";

// Schema.org JSON-LD for Google Search: the site name and breadcrumb trails.

export const SITE_NAME = "Bay Ballot";

// Google reads the site name from WebSite markup on the domain's home page; `url` is that page, with its trailing slash.
export function websiteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE}/` };
}

export type Crumb = { name: string; path: string };

// One ListItem per visible breadcrumb level, then the page itself, each with an absolute URL.
export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE}${c.path}` })),
  };
}

// For a <script type="application/ld+json"> body: `<` as <, so no string in the data can close the tag.
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
