import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSource, htmlToText } from "@/pipeline/fetch";

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
