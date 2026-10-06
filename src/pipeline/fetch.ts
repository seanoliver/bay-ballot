import { execFileSync } from "node:child_process";
import * as cheerio from "cheerio";

export type Fetched = { kind: "text"; text: string } | { kind: "pdf"; base64: string; text: string };

const BLOCKS = "p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, tr, table, section, article, header, main, aside, blockquote, pre, dl, dt, dd, figure, figcaption, form, fieldset, summary, details";

/** Keeps the page's words verbatim: extracted quotes are verified against this text. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, template, nav, footer, svg, iframe, head").remove();

  $("body *")
    .addBack("body")
    .contents()
    .each((_, node) => {
      if (node.type === "text") node.data = node.data.replace(/\s+/g, " ");
    });

  $("img").each((_, el) => {
    const alt = ($(el).attr("alt") ?? "").trim();
    $(el).replaceWith(alt ? ` [${alt}] ` : "");
  });
  $("br").replaceWith("\n");
  $("tr").each((_, tr) => {
    $(tr).children("td, th").slice(0, -1).append(" | ");
  });
  $(BLOCKS).each((_, el) => {
    $(el).prepend("\n").append("\n");
  });

  return $("body")
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// A real browser UA: some guide sites return 403/406 to bot-like or short ones.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function pdfToText(buf: Buffer): string {
  try {
    return execFileSync("pdftotext", ["-", "-"], {
      input: buf,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    }).toString("utf8");
  } catch {
    return "";
  }
}

const isPdfPath = (url: string): boolean => {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
};

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function fetchBrowser(url: string): Promise<Fetched> {
  const { chromium } = await import("@playwright/test");
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ userAgent: UA });
    const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    if (res && !res.ok()) throw new Error(`${url} -> HTTP ${res.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return { kind: "text", text: htmlToText(await page.content()) };
  } finally {
    await b.close();
  }
}

async function fetchHttp(url: string): Promise<Fetched> {
  let res: Response;
  let buf: Buffer;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    const m = errMsg(e);
    throw new Error(m.includes(url) ? m : `${url}: ${m}`);
  }
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  const isPdf = type.includes("pdf") || isPdfPath(url) || buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (isPdf) return { kind: "pdf", base64: buf.toString("base64"), text: pdfToText(buf) };
  if (!(type.startsWith("text/") || type.includes("html"))) {
    throw new Error(`${url}: unsupported content-type ${type || "(none)"}`);
  }
  return { kind: "text", text: htmlToText(buf.toString("utf8")) };
}

export async function fetchSource(url: string, opts: { browser?: boolean } = {}): Promise<Fetched> {
  if (opts.browser && !isPdfPath(url)) {
    try {
      return await fetchBrowser(url);
    } catch (e) {
      const m = errMsg(e);
      throw new Error(m.includes(url) ? m : `${url}: ${m}`);
    }
  }
  return fetchHttp(url);
}
