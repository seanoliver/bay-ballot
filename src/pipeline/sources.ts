import type { EndorsementFile, Guide } from "@/lib/schema";

const host = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

/** The pages to fetch for a guide, main source first. Empty until a source is set. */
export function sourcesFor(file: EndorsementFile): string[] {
  return file.source ? [file.source, ...(file.extraSources ?? [])] : [];
}

/**
 * Every source must live on the guide's own homepage host (ignoring "www."), so an
 * aggregator or news page can't be published under the guide's name. `allowForeignSources`
 * opts a file out, e.g. for a PDF hosted on a CDN.
 */
export function checkHosts(guide: Guide, file: EndorsementFile): string[] {
  if (file.allowForeignSources) return [];
  const home = host(guide.homepage);
  return sourcesFor(file)
    .filter((url) => host(url) !== home)
    .map((url) => `${url}: host ${host(url)} is not the guide's homepage host ${home} (set allowForeignSources: true if this is intended)`);
}

export function fetchMode(file: EndorsementFile, cliBrowserFlag: boolean): "http" | "browser" {
  return file.fetchWith === "browser" || cliBrowserFlag ? "browser" : "http";
}
