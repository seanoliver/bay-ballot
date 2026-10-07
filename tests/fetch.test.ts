import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBlock, fetchSource, htmlToText } from "@/pipeline/fetch";

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
