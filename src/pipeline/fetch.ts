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

// Bot walls and challenge pages. Matched only on short pages or the <title>, so a real page that
// mentions "access denied" in passing is not mistaken for one.
const BLOCK_SIGNS: [string, RegExp][] = [
  ["cloudflare challenge", /just a moment\.\.\.|enable javascript and cookies to continue|cf-chl-|challenge-platform/i],
  ["cloudflare block", /attention required! \| cloudflare|sorry, you have been blocked/i],
  ["incapsula", /incapsula incident id|request unsuccessful\. incapsula/i],
  ["perimeterx", /press (?:&|&amp;) hold to confirm you are a human|px-captcha/i],
  ["datadome", /please enable js and disable any ad blocker|captcha-delivery\.com/i],
  ["distil", /pardon our interruption/i],
  ["client challenge", /^\s*client challenge\s*$|a required part of this site couldn.t load/im],
  ["access denied", /^\s*access denied\s*$|you don'?t have permission to access .* on this server/im],
  ["bot check", /verify(?:ing)? (?:that )?you are (?:a )?human|are you a robot\?/i],
];
const MAX_BLOCK_PAGE_TEXT = 1500;

/** The kind of bot wall `html` is, or null for a real page. */
export function detectBlock(html: string): string | null {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const short = text.length <= MAX_BLOCK_PAGE_TEXT;
  for (const [name, re] of BLOCK_SIGNS) {
    if (re.test(title) || (short && (re.test(text) || re.test(html)))) return name;
  }
  return null;
}

export type FetchAttempt = { via: "http" | "browser"; status: number; bytes: number; blocked: string | null };
type BrowserFetch = (url: string) => Promise<{ status: number; html: string }>;
export type FetchOptions = {
  browser?: boolean; // go straight to the browser (fetchWith: browser)
  browserFetch?: BrowserFetch;
  onAttempt?: (a: FetchAttempt) => void;
};

async function browserPage(url: string): Promise<{ status: number; html: string }> {
  const { chromium } = await import("@playwright/test");
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ userAgent: UA, locale: "en-US", extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });
    const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return { status: res?.status() ?? 200, html: await page.content() };
  } finally {
    await b.close();
  }
}

const RETRY_IN_BROWSER = new Set([403, 429, 503]);

type HttpResult =
  | { kind: "page"; fetched: Fetched; status: number; bytes: number; html?: string }
  | { kind: "error"; status: number; bytes: number };

async function fetchHttp(url: string): Promise<HttpResult> {
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
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    const m = errMsg(e);
    throw new Error(m.includes(url) ? m : `${url}: ${m}`);
  }
  if (!res.ok) return { kind: "error", status: res.status, bytes: buf.length };
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  const isPdf = type.includes("pdf") || isPdfPath(url) || buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (isPdf) {
    return { kind: "page", status: res.status, bytes: buf.length, fetched: { kind: "pdf", base64: buf.toString("base64"), text: pdfToText(buf) } };
  }
  if (!(type.startsWith("text/") || type.includes("html"))) {
    throw new Error(`${url}: unsupported content-type ${type || "(none)"}`);
  }
  const html = buf.toString("utf8");
  return { kind: "page", status: res.status, bytes: buf.length, html, fetched: { kind: "text", text: htmlToText(html) } };
}

/**
 * Fetch a guide's page. A 403/429/503 or a bot-challenge page over plain HTTP is retried in a
 * real browser; a page still blocked there is an error, never content, so it is not extracted
 * or stored.
 */
export async function fetchSource(url: string, opts: FetchOptions = {}): Promise<Fetched> {
  const browserFetch = opts.browserFetch ?? browserPage;
  const report = opts.onAttempt ?? (() => {});
  const viaBrowser = async (httpFailure: string | null): Promise<Fetched> => {
    let r: { status: number; html: string };
    try {
      r = await browserFetch(url);
    } catch (e) {
      const m = errMsg(e);
      throw new Error(httpFailure ? `${httpFailure} (browser: ${m})` : m.includes(url) ? m : `${url}: ${m}`);
    }
    const blocked = r.status >= 400 ? null : detectBlock(r.html);
    report({ via: "browser", status: r.status, bytes: Buffer.byteLength(r.html), blocked });
    if (r.status >= 400) throw new Error(httpFailure ? `${httpFailure} (browser: HTTP ${r.status})` : `${url} -> HTTP ${r.status}`);
    if (blocked) throw new Error(`${url}: blocked (${blocked})${httpFailure ? " over http and browser" : ""}`);
    return { kind: "text", text: htmlToText(r.html) };
  };

  if (opts.browser && !isPdfPath(url)) return viaBrowser(null);

  const r = await fetchHttp(url);
  if (r.kind === "error") {
    report({ via: "http", status: r.status, bytes: r.bytes, blocked: null });
    const failure = `${url} -> HTTP ${r.status}`;
    if (!RETRY_IN_BROWSER.has(r.status) || isPdfPath(url)) throw new Error(failure);
    return viaBrowser(failure);
  }
  const blocked = r.html ? detectBlock(r.html) : null;
  report({ via: "http", status: r.status, bytes: r.bytes, blocked });
  if (!blocked) return r.fetched;
  return viaBrowser(`${url}: blocked (${blocked})`);
}
