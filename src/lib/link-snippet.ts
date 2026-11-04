import { SITE } from "./seo";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Escapes text for an HTML attribute or element body, so a pasted snippet can't break the page it lands on. */
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** The canonical address of a guide's page: no trailing slash, no query. */
export const guideUrl = (guideId: string) => `${SITE}/guides/${encodeURIComponent(guideId)}`;

export function siteLinkSnippet(): string {
  return `<a href="${SITE}">Bay Ballot, every Bay Area voter guide side by side</a>`;
}

export function guideLinkSnippet({ guideId, guideName }: { guideId: string; guideName: string }): string {
  return `<a href="${escapeHtml(guideUrl(guideId))}">See how ${escapeHtml(guideName)} compares with other Bay Area guides</a>`;
}
