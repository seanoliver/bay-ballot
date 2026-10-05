import { execFileSync } from "node:child_process";
import * as cheerio from "cheerio";

export type Fetched = { kind: "text"; text: string } | { kind: "pdf"; base64: string; text: string };

const BLOCKS = "p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, tr, table, section, article, header, main, aside, blockquote, pre, dl, dt, dd, figure, figcaption, form, fieldset";

/**
 * Convert HTML to plain text, preserving the page's words verbatim (quotes are later
 * verified against this text). Whitespace in the source is collapsed to single spaces;
 * line breaks come only from block elements, <br>, and table rows.
 */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, template, nav, footer, svg, iframe, head").remove();

  // Normalize source whitespace (incl. nbsp) so only structural breaks create newlines.
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

// Some sites (sftu.org, bhdemocrats.org, sfbike.org) return 403/406 to bot-ish or short UAs,
// so use a realistic desktop Chrome UA and leave the BayBallot identifier out.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function pdfToText(buf: Buffer): string {
  try {
    return execFileSync("pdftotext", ["-layout", "-", "-"], {
      input: buf,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    }).toString("utf8");
  } catch {
    return ""; // pdftotext missing or failed; caller should warn
  }
}

export async function fetchSource(url: string, opts: { browser?: boolean } = {}): Promise<Fetched> {
  if (opts.browser) {
    const { chromium } = await import("@playwright/test");
    const b = await chromium.launch();
    try {
      const page = await b.newPage({ userAgent: UA });
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      return { kind: "text", text: htmlToText(await page.content()) };
    } finally {
      await b.close();
    }
  }
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("pdf") || new URL(url).pathname.toLowerCase().endsWith(".pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { kind: "pdf", base64: buf.toString("base64"), text: pdfToText(buf) };
  }
  return { kind: "text", text: htmlToText(await res.text()) };
}
