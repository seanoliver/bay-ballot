import { SITE } from "./seo";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

export const guideUrl = (guideId: string) => `${SITE}/guides/${encodeURIComponent(guideId)}`;

export function siteLinkSnippet(): string {
  return `<a href="${SITE}">Bay Ballot, every Bay Area voter guide side by side</a>`;
}

export function guideLinkSnippet({ guideId, guideName }: { guideId: string; guideName: string }): string {
  return `<a href="${escapeHtml(guideUrl(guideId))}">See how ${escapeHtml(guideName)} compares with other Bay Area guides</a>`;
}
