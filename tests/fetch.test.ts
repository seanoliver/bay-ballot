import { afterEach, describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";
import { contentAfterNavigation, detectBlock, fetchSource, finalStatus, htmlToText } from "@/pipeline/fetch";

const cheerioText = (html: string) => cheerio.load(html)("body").text().replace(/\s+/g, " ").trim();

describe("htmlToText", () => {
  it("drops scripts, styles and nav, keeps body text", () => {
    const html = `<html><head><style>.x{}</style></head><body><nav>Menu</nav>
      <h2>Prop B</h2><p>Vote <b>No</b>. A public bank is risky.</p><script>alert(1)</script></body></html>`;
    expect(htmlToText(html)).toBe("Prop B\nVote No. A public bank is risky.");
  });

  it("puts list items on separate lines", () => {
    expect(htmlToText("<ul><li>Prop A: Yes</li><li>Prop B: No</li></ul>")).toBe("Prop A: Yes\nProp B: No");
  });

  it("turns <br> into a line break", () => {
    expect(htmlToText("<p>Prop A<br>Yes<br/>Prop B<br>No</p>")).toBe("Prop A\nYes\nProp B\nNo");
  });

  it("separates table cells with ' | ' and rows with newlines", () => {
    const html = `<table><tr><th>Measure</th><th>Rec</th></tr><tr><td>Prop A</td><td>Yes</td></tr></table>`;
    expect(htmlToText(html)).toBe("Measure | Rec\nProp A | Yes");
  });

  it("does not split words at inline elements", () => {
    expect(htmlToText("<p>Vote <b>No</b> on <a href='#'>Prop</a>B, and un<i>believ</i>able</p>")).toBe(
      "Vote No on PropB, and unbelievable",
    );
  });

  it("collapses source newlines inside a paragraph", () => {
    expect(htmlToText("<p>Vote\n   No on\n Prop B</p>")).toBe("Vote No on Prop B");
  });

  it("decodes entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry&rsquo;s&nbsp;guide</p>")).toBe("Tom & Jerry’s guide");
  });

  it("keeps img alt text in brackets", () => {
    expect(htmlToText(`<p>Prop A <img alt="YES" src="y.png"> Prop B <img alt="" src="x.png"><img alt="NO"></p>`)).toBe(
      "Prop A [YES] Prop B [NO]",
    );
  });

  it("removes footer and svg", () => {
    expect(htmlToText("<body><p>Keep</p><svg><text>icon</text></svg><footer>Copyright</footer></body>")).toBe("Keep");
  });

  it("merges adjacent inline/unwrapped elements with no whitespace (known limitation)", () => {
    expect(htmlToText("<span>Sara Barz</span><span>Co-founder</span>")).toBe("Sara BarzCo-founder");
  });

  it("keeps header, aside and details content", () => {
    expect(
      htmlToText("<header>Guide 2026</header><aside>Side note</aside><details><summary>More</summary>Hidden text</details>"),
    ).toBe("Guide 2026\nSide note\nMore\nHidden text");
  });
});

describe("fetchSource (stubbed fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (body: string | Buffer, type: string, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(typeof body === "string" ? body : new Uint8Array(body), { status, headers: { "content-type": type } })),
    );

  it("returns text for HTML", async () => {
    stub("<p>Vote <b>Yes</b></p>", "text/html; charset=utf-8");
    expect(await fetchSource("https://x.test/a")).toEqual({ kind: "text", text: "Vote Yes" });
  });

  it("detects PDF by content-type", async () => {
    stub(Buffer.from("%PDF-1.4 junk"), "application/pdf");
    const r = await fetchSource("https://x.test/guide");
    expect(r.kind).toBe("pdf");
    if (r.kind === "pdf") {
      expect(r.base64).toBe(Buffer.from("%PDF-1.4 junk").toString("base64"));
      expect(typeof r.text).toBe("string");
    }
  });

  it("detects PDF by .pdf path", async () => {
    stub(Buffer.from("not really"), "binary/foo");
    expect((await fetchSource("https://x.test/g.pdf?v=1")).kind).toBe("pdf");
  });

  it("detects PDF by %PDF sniff on octet-stream", async () => {
    stub(Buffer.from("%PDF-1.7 body"), "application/octet-stream");
    expect((await fetchSource("https://x.test/download")).kind).toBe("pdf");
  });

  it("rejects unsupported content-types", async () => {
    stub(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    await expect(fetchSource("https://x.test/i")).rejects.toThrow("https://x.test/i: unsupported content-type image/png");
  });

  it("throws with the URL on HTTP errors", async () => {
    stub("nope", "text/html", 404);
    await expect(fetchSource("https://x.test/missing")).rejects.toThrow("https://x.test/missing -> HTTP 404");
  });

  it("includes the URL when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(fetchSource("https://x.test/down")).rejects.toThrow(/https:\/\/x\.test\/down.*fetch failed/);
  });
});

describe("detectBlock", () => {
  const page = (title: string, body: string) => `<html><head><title>${title}</title></head><body>${body}</body></html>`;
  it.each([
    ["cloudflare challenge", page("Just a moment...", "<p>Enable JavaScript and cookies to continue</p>")],
    ["cloudflare block", page("Attention Required! | Cloudflare", "<h1>Sorry, you have been blocked</h1>")],
    ["akamai", page("Access Denied", "<h1>Access Denied</h1><p>You don't have permission to access this server. Reference #18.5c</p>")],
    ["incapsula", page("", "<p>Request unsuccessful. Incapsula incident ID: 123</p>")],
    ["perimeterx", page("Access to this page has been denied", "<p>Press &amp; Hold to confirm you are a human (and not a bot).</p>")],
    ["datadome", page("", "<p>Please enable JS and disable any ad blocker</p>")],
    ["distil", page("Pardon Our Interruption", "<p>As you were browsing something about your browser made us think you were a bot.</p>")],
    ["client challenge (sfchronicle.com on GitHub's runners)", page("Client Challenge", "<p>A required part of this site couldn’t load. This may be due to a browser extension, network issues, or browser settings. Please check your connection, disable any ad blockers, or try using a different browser.</p>")],
  ])("flags a %s page", (_name, html) => {
    expect(detectBlock(html)).not.toBeNull();
  });
  it("leaves real pages alone, even ones that mention access or bots", () => {
    const long = "We support Prop B because the public bank would expand access to credit. ".repeat(80);
    expect(detectBlock(page("November endorsements", `<p>Access denied to voters is wrong.</p><p>${long}</p>`))).toBeNull();
    expect(detectBlock(page("Our picks", "<h2>Prop A</h2><p>Yes</p>"))).toBeNull();
  });
});

describe("fetchSource fallbacks", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (body: string, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, headers: { "content-type": "text/html" } })));
  const challenge = "<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>";
  const real = "<html><body><h2>Prop B</h2><p>Vote No</p></body></html>";

  it("retries a 403 in the browser and returns what the browser got", async () => {
    stub("Forbidden", 403);
    const browserFetch = vi.fn(async () => ({ status: 200, html: real }));
    const attempts: unknown[] = [];
    const r = await fetchSource("https://x.test/a", { browserFetch, onAttempt: (a) => attempts.push(a) });
    expect(r).toEqual({ kind: "text", text: "Prop B\nVote No" });
    expect(browserFetch).toHaveBeenCalledOnce();
    expect(attempts).toEqual([
      { via: "http", status: 403, bytes: 9, blocked: null },
      { via: "browser", status: 200, bytes: real.length, blocked: null },
    ]);
  });

  it.each([429, 503])("retries a %i in the browser", async (status) => {
    stub("busy", status);
    const browserFetch = vi.fn(async () => ({ status: 200, html: real }));
    expect(await fetchSource("https://x.test/a", { browserFetch })).toEqual({ kind: "text", text: "Prop B\nVote No" });
  });

  it("retries a 200 bot challenge in the browser", async () => {
    stub(challenge);
    const browserFetch = vi.fn(async () => ({ status: 200, html: real }));
    expect(await fetchSource("https://x.test/a", { browserFetch })).toEqual({ kind: "text", text: "Prop B\nVote No" });
  });

  it("fails when the browser is blocked too, instead of returning the challenge as content", async () => {
    stub(challenge);
    const browserFetch = vi.fn(async () => ({ status: 200, html: challenge }));
    await expect(fetchSource("https://x.test/a", { browserFetch })).rejects.toThrow("https://x.test/a: blocked (cloudflare challenge) over http and browser");
  });

  it("reports both statuses when the browser also gets an error", async () => {
    stub("Forbidden", 403);
    const browserFetch = vi.fn(async () => ({ status: 403, html: "Forbidden" }));
    await expect(fetchSource("https://x.test/a", { browserFetch })).rejects.toThrow("https://x.test/a -> HTTP 403 (browser: HTTP 403)");
  });

  it("does not retry a 404", async () => {
    stub("nope", 404);
    const browserFetch = vi.fn();
    await expect(fetchSource("https://x.test/a", { browserFetch })).rejects.toThrow("HTTP 404");
    expect(browserFetch).not.toHaveBeenCalled();
  });

  it("checks pages fetched with the browser from the start too", async () => {
    const browserFetch = vi.fn(async () => ({ status: 200, html: challenge }));
    await expect(fetchSource("https://x.test/a", { browser: true, browserFetch })).rejects.toThrow("blocked (cloudflare challenge)");
  });
});

describe("detectBlock on real pages with Cloudflare's script snippets", () => {
  const slate = [
    "<h1>November 2026 Endorsements</h1>",
    "<ul>",
    ...["Prop A: Yes", "Prop B: No", "Prop C: Yes", "Prop D: No", "Prop E: Yes", "Prop F: No", "Prop G: No", "Prop H: Yes",
      "Supervisor, District 8: Gary McCoy", "Supervisor, District 10: J.R. Eppler", "Assessor: Joaquín Torres",
      "Public Defender: Mano Raju", "Board of Education: Reina Tello, Ryan Hazelton, Virginia Cheung",
      "Community College Board: Jeremy Lee, Bunny McFadden, Leah LaCroix"].map((l) => `<li>${l}</li>`),
    "</ul><p>Our members voted on September 23 after candidate forums in every district of the city.</p>",
  ].join("");
  const jsd = `<script>(function(){var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.head.appendChild(a);})();</script>`;

  it("ignores the JSD beacon on a short real slate page", () => {
    const html = `<html><head><title>Endorsements</title></head><body>${slate}${jsd}</body></html>`;
    const text = cheerioText(html);
    expect(text.length).toBeGreaterThan(500);
    expect(text.length).toBeLessThan(1500);
    expect(detectBlock(html)).toBeNull();
  });
  it("does not let inline scripts make a page look like a wall", () => {
    const html = `<html><head><title>Picks</title><script>var x = "verify you are human";</script></head><body>${slate}<noscript>Enable JavaScript and cookies to continue</noscript></body></html>`;
    expect(detectBlock(html)).toBeNull();
  });
  it("still flags a real challenge by its specific markers", () => {
    expect(detectBlock(`<html><body><form id="challenge-form" action="/x"></form></body></html>`)).toBe("cloudflare challenge");
    expect(detectBlock(`<html><body><script>window._cf_chl_opt={cvId:'3'};</script></body></html>`)).toBe("cloudflare challenge");
    expect(detectBlock(`<html><body><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></body></html>`)).toBe("cloudflare challenge");
  });
});

describe("browser fallback trusts the final page", () => {
  afterEach(() => vi.unstubAllGlobals());
  const realPage = `<html><body><h1>November 2026 Endorsements</h1>${"<p>We recommend Yes on Prop C because the city needs more affordable housing in every neighborhood.</p>".repeat(25)}</body></html>`;

  it("accepts a real page even when the browser's first response was a 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Forbidden", { status: 403, headers: { "content-type": "text/html" } })));
    const browserFetch = vi.fn(async () => ({ status: 403, html: realPage }));
    const r = await fetchSource("https://x.test/a", { browserFetch });
    expect(r.kind).toBe("text");
    expect(r.text).toContain("November 2026 Endorsements");
  });
});

describe("browser helpers", () => {
  it("uses the last main-frame navigation's status (challenge solved mid-load)", () => {
    expect(finalStatus([{ status: 403, mainFrameNavigation: true }, { status: 204, mainFrameNavigation: false }, { status: 200, mainFrameNavigation: true }], 403)).toBe(200);
    expect(finalStatus([{ status: 403, mainFrameNavigation: true }, { status: 200, mainFrameNavigation: false }], 403)).toBe(403);
    expect(finalStatus([], 200)).toBe(200);
  });
  it("retries reading content when the page navigated underneath it", async () => {
    let calls = 0;
    const content = async () => {
      calls++;
      if (calls === 1) throw new Error("page.content: Execution context was destroyed, most likely because of a navigation");
      return "<html>final</html>";
    };
    const settle = vi.fn(async () => {});
    expect(await contentAfterNavigation(content, settle)).toBe("<html>final</html>");
    expect(settle).toHaveBeenCalledOnce();
  });
  it("does not swallow other errors", async () => {
    await expect(contentAfterNavigation(async () => { throw new Error("boom"); }, async () => {})).rejects.toThrow("boom");
  });
});
