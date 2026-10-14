import type { EndorsementFile, Guide } from "@/lib/schema";

const host = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

export function sourcesFor(file: EndorsementFile): string[] {
  return file.source ? [file.source, ...(file.extraSources ?? [])] : [];
}

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

export function fetchOptions(
  file: EndorsementFile,
  cliBrowserFlag: boolean,
): { browser: boolean; contentSelector?: string; contentExclude?: string } {
  return { browser: fetchMode(file, cliBrowserFlag) === "browser", contentSelector: file.contentSelector, contentExclude: file.contentExclude };
}
